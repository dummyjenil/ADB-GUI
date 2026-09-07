use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

const EOCD_SIGNATURE: u32 = 0x06054b50;
const CD_SIGNATURE: u32 = 0x02014b50;
const LOCAL_SIGNATURE: u32 = 0x04034b50;

#[allow(dead_code)]
pub struct ZipEntry {
    pub name: String,
    pub compression_method: u16,
    pub compressed_size: u64,
    pub uncompressed_size: u64,
    pub local_header_offset: u64,
}

pub struct ApkZipReader {
    file: File,
    pub entries: Vec<ZipEntry>,
}

impl ApkZipReader {
    pub fn open<P: AsRef<Path>>(path: P) -> std::io::Result<Self> {
        let mut file = File::open(path)?;
        let file_len = file.seek(SeekFrom::End(0))?;
        if file_len < 22 {
            return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "File too small for ZIP"));
        }

        // Search for EOCD in last 65KB + 22 bytes
        let search_size = std::cmp::min(file_len, 65557) as usize;
        let search_start = file_len - search_size as u64;
        file.seek(SeekFrom::Start(search_start))?;

        let mut buf = vec![0u8; search_size];
        file.read_exact(&mut buf)?;

        let mut eocd_pos = None;
        for i in (0..search_size.saturating_sub(21)).rev() {
            let sig = u32::from_le_bytes([buf[i], buf[i + 1], buf[i + 2], buf[i + 3]]);
            if sig == EOCD_SIGNATURE {
                eocd_pos = Some(search_start + i as u64);
                break;
            }
        }

        let eocd_offset = eocd_pos.ok_or_else(|| {
            std::io::Error::new(std::io::ErrorKind::InvalidData, "EOCD signature not found")
        })?;

        file.seek(SeekFrom::Start(eocd_offset))?;
        let mut eocd_buf = [0u8; 22];
        file.read_exact(&mut eocd_buf)?;

        let _total_records = u16::from_le_bytes([eocd_buf[10], eocd_buf[11]]) as usize;
        let cd_size = u32::from_le_bytes([eocd_buf[12], eocd_buf[13], eocd_buf[14], eocd_buf[15]]) as u64;
        let cd_offset = u32::from_le_bytes([eocd_buf[16], eocd_buf[17], eocd_buf[18], eocd_buf[19]]) as u64;

        file.seek(SeekFrom::Start(cd_offset))?;
        let mut cd_buf = vec![0u8; cd_size as usize];
        file.read_exact(&mut cd_buf)?;

        let mut entries = Vec::with_capacity(4);
        let mut cur = 0;

        while cur + 46 <= cd_buf.len() {
            let sig = u32::from_le_bytes([cd_buf[cur], cd_buf[cur + 1], cd_buf[cur + 2], cd_buf[cur + 3]]);
            if sig != CD_SIGNATURE {
                break;
            }

            let comp_method = u16::from_le_bytes([cd_buf[cur + 10], cd_buf[cur + 11]]);
            let comp_size = u32::from_le_bytes([cd_buf[cur + 20], cd_buf[cur + 21], cd_buf[cur + 22], cd_buf[cur + 23]]) as u64;
            let uncomp_size = u32::from_le_bytes([cd_buf[cur + 24], cd_buf[cur + 25], cd_buf[cur + 26], cd_buf[cur + 27]]) as u64;
            let fname_len = u16::from_le_bytes([cd_buf[cur + 28], cd_buf[cur + 29]]) as usize;
            let extra_len = u16::from_le_bytes([cd_buf[cur + 30], cd_buf[cur + 31]]) as usize;
            let comment_len = u16::from_le_bytes([cd_buf[cur + 32], cd_buf[cur + 33]]) as usize;
            let local_offset = u32::from_le_bytes([cd_buf[cur + 42], cd_buf[cur + 43], cd_buf[cur + 44], cd_buf[cur + 45]]) as u64;

            cur += 46;
            if cur + fname_len > cd_buf.len() {
                break;
            }

            let fname_bytes = &cd_buf[cur..cur + fname_len];
            if fname_bytes == b"AndroidManifest.xml" || fname_bytes == b"resources.arsc" {
                let name = String::from_utf8_lossy(fname_bytes).to_string();
                entries.push(ZipEntry {
                    name,
                    compression_method: comp_method,
                    compressed_size: comp_size,
                    uncompressed_size: uncomp_size,
                    local_header_offset: local_offset,
                });
            }

            cur += fname_len + extra_len + comment_len;
        }

        Ok(Self { file, entries })
    }

    pub fn extract_file(&mut self, filename: &str) -> std::io::Result<Option<Vec<u8>>> {
        let entry = match self.entries.iter().find(|e| e.name == filename) {
            Some(e) => e,
            None => return Ok(None),
        };

        self.file.seek(SeekFrom::Start(entry.local_header_offset))?;
        let mut local_buf = [0u8; 30];
        self.file.read_exact(&mut local_buf)?;

        let sig = u32::from_le_bytes([local_buf[0], local_buf[1], local_buf[2], local_buf[3]]);
        if sig != LOCAL_SIGNATURE {
            return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "Invalid Local File Header"));
        }

        let fname_len = u16::from_le_bytes([local_buf[26], local_buf[27]]) as u64;
        let extra_len = u16::from_le_bytes([local_buf[28], local_buf[29]]) as u64;
        let data_offset = entry.local_header_offset + 30 + fname_len + extra_len;

        self.file.seek(SeekFrom::Start(data_offset))?;
        let mut raw_data = vec![0u8; entry.compressed_size as usize];
        self.file.read_exact(&mut raw_data)?;

        match entry.compression_method {
            0 => Ok(Some(raw_data)), // Stored (Uncompressed)
            8 => {
                // Deflated
                match miniz_oxide::inflate::decompress_to_vec(&raw_data) {
                    Ok(decompressed) => Ok(Some(decompressed)),
                    Err(_) => Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "Decompression failed")),
                }
            }
            _ => Err(std::io::Error::new(std::io::ErrorKind::Unsupported, "Unsupported compression method")),
        }
    }
}
