use std::fs::File;
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::Path;

struct Crc32 {
    state: u32,
}

impl Crc32 {
    fn new() -> Self {
        Self { state: 0xFFFFFFFF }
    }

    fn update(&mut self, buf: &[u8]) {
        for &b in buf {
            self.state ^= b as u32;
            for _ in 0..8 {
                if self.state & 1 != 0 {
                    self.state = (self.state >> 1) ^ 0xEDB88320;
                } else {
                    self.state >>= 1;
                }
            }
        }
    }

    fn finalize(self) -> u32 {
        !self.state
    }
}

struct ZipEntryMeta {
    filename: String,
    crc32: u32,
    size: u64,
    local_header_offset: u64,
}

/// Creates a standard compliant ZIP (.apks) archive from a list of local files without external dependencies.
/// Uses STORE method (no compression) which is optimal for pre-compressed APK files.
pub fn create_apks_archive(
    entries: &[(&str, &Path)],
    output_path: &Path,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut out_file = File::create(output_path)?;
    let mut meta_entries = Vec::new();
    let mut current_offset = 0u64;

    let mut buffer = vec![0u8; 64 * 1024];

    for (arcname, src_path) in entries {
        let mut src_file = File::open(src_path)?;
        let file_size = src_file.metadata()?.len();

        let mut crc_calc = Crc32::new();
        while let Ok(n) = src_file.read(&mut buffer) {
            if n == 0 {
                break;
            }
            crc_calc.update(&buffer[..n]);
        }
        let file_crc = crc_calc.finalize();

        // Rewind source file
        src_file.seek(SeekFrom::Start(0))?;

        let name_bytes = arcname.as_bytes();
        let name_len = name_bytes.len() as u16;

        // Write Local File Header (30 bytes + name)
        let local_offset = current_offset;
        out_file.write_all(&0x04034b50u32.to_le_bytes())?; // signature
        out_file.write_all(&20u16.to_le_bytes())?; // version needed
        out_file.write_all(&0u16.to_le_bytes())?; // flags
        out_file.write_all(&0u16.to_le_bytes())?; // compression method (STORE)
        out_file.write_all(&0u16.to_le_bytes())?; // mod time
        out_file.write_all(&0u16.to_le_bytes())?; // mod date
        out_file.write_all(&file_crc.to_le_bytes())?; // crc32
        out_file.write_all(&(file_size as u32).to_le_bytes())?; // compressed size
        out_file.write_all(&(file_size as u32).to_le_bytes())?; // uncompressed size
        out_file.write_all(&name_len.to_le_bytes())?; // filename length
        out_file.write_all(&0u16.to_le_bytes())?; // extra field length
        out_file.write_all(name_bytes)?; // filename

        current_offset += 30 + name_bytes.len() as u64;

        // Stream file payload
        while let Ok(n) = src_file.read(&mut buffer) {
            if n == 0 {
                break;
            }
            out_file.write_all(&buffer[..n])?;
        }
        current_offset += file_size;

        meta_entries.push(ZipEntryMeta {
            filename: arcname.to_string(),
            crc32: file_crc,
            size: file_size,
            local_header_offset: local_offset,
        });
    }

    // Write Central Directory Headers
    let cd_start_offset = current_offset;
    for meta in &meta_entries {
        let name_bytes = meta.filename.as_bytes();
        let name_len = name_bytes.len() as u16;

        out_file.write_all(&0x02014b50u32.to_le_bytes())?; // signature
        out_file.write_all(&20u16.to_le_bytes())?; // version made by
        out_file.write_all(&20u16.to_le_bytes())?; // version needed
        out_file.write_all(&0u16.to_le_bytes())?; // flags
        out_file.write_all(&0u16.to_le_bytes())?; // compression method
        out_file.write_all(&0u16.to_le_bytes())?; // mod time
        out_file.write_all(&0u16.to_le_bytes())?; // mod date
        out_file.write_all(&meta.crc32.to_le_bytes())?; // crc32
        out_file.write_all(&(meta.size as u32).to_le_bytes())?; // compressed size
        out_file.write_all(&(meta.size as u32).to_le_bytes())?; // uncompressed size
        out_file.write_all(&name_len.to_le_bytes())?; // filename length
        out_file.write_all(&0u16.to_le_bytes())?; // extra field length
        out_file.write_all(&0u16.to_le_bytes())?; // comment length
        out_file.write_all(&0u16.to_le_bytes())?; // disk number start
        out_file.write_all(&0u16.to_le_bytes())?; // internal attributes
        out_file.write_all(&0u32.to_le_bytes())?; // external attributes
        out_file.write_all(&(meta.local_header_offset as u32).to_le_bytes())?; // relative offset
        out_file.write_all(name_bytes)?; // filename

        current_offset += 46 + name_bytes.len() as u64;
    }

    let cd_size = current_offset - cd_start_offset;
    let entry_count = meta_entries.len() as u16;

    // Write End of Central Directory Record (EOCD)
    out_file.write_all(&0x06054b50u32.to_le_bytes())?; // signature
    out_file.write_all(&0u16.to_le_bytes())?; // disk number
    out_file.write_all(&0u16.to_le_bytes())?; // start disk
    out_file.write_all(&entry_count.to_le_bytes())?; // entries on this disk
    out_file.write_all(&entry_count.to_le_bytes())?; // total entries
    out_file.write_all(&(cd_size as u32).to_le_bytes())?; // cd size
    out_file.write_all(&(cd_start_offset as u32).to_le_bytes())?; // cd offset
    out_file.write_all(&0u16.to_le_bytes())?; // comment length

    out_file.flush()?;
    Ok(())
}
