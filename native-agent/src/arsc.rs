use super::axml::StringPool;

const CHUNK_STRING_POOL: u16 = 0x0001;
const CHUNK_TABLE: u16 = 0x0002;
const CHUNK_TABLE_PACKAGE: u16 = 0x0200;
const CHUNK_TABLE_TYPE: u16 = 0x0201;

const TYPE_REFERENCE: u8 = 0x01;
const TYPE_STRING: u8 = 0x03;
const FLAG_SPARSE: u8 = 0x01;
const FLAG_COMPLEX: u16 = 0x0001;

struct ArscPackage {
    id: u32,
    #[allow(dead_code)]
    name: String,
    type_chunks: Vec<usize>,
}

pub struct ArscParser<'a> {
    data: &'a [u8],
    global_strings: Option<StringPool>,
    packages: Vec<ArscPackage>,
}

impl<'a> ArscParser<'a> {
    pub fn parse(data: &'a [u8]) -> Option<Self> {
        if data.len() < 12 {
            return None;
        }

        let table_type = u16::from_le_bytes([data[0], data[1]]);
        if table_type != CHUNK_TABLE {
            return None;
        }

        let header_size = u16::from_le_bytes([data[2], data[3]]) as usize;
        let mut offset = header_size;
        let mut global_strings = None;
        let mut packages = Vec::new();

        if offset + 8 <= data.len() {
            let c_type = u16::from_le_bytes([data[offset], data[offset + 1]]);
            let c_size = u32::from_le_bytes([data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]]) as usize;
            if c_type == CHUNK_STRING_POOL {
                global_strings = StringPool::parse(data, offset);
                offset += c_size;
            }
        }

        while offset + 8 <= data.len() {
            let c_type = u16::from_le_bytes([data[offset], data[offset + 1]]);
            let c_size = u32::from_le_bytes([data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]]) as usize;
            if c_size == 0 {
                break;
            }

            if c_type == CHUNK_TABLE_PACKAGE && offset + 284 <= data.len() {
                let pkg_id = u32::from_le_bytes([data[offset + 8], data[offset + 9], data[offset + 10], data[offset + 11]]);
                let name_bytes = &data[offset + 12..offset + 12 + 256];
                let u16_name: Vec<u16> = name_bytes.chunks_exact(2).map(|c| u16::from_le_bytes([c[0], c[1]])).collect();
                let pkg_name = String::from_utf16_lossy(&u16_name).trim_matches('\0').to_string();

                let h_size = u16::from_le_bytes([data[offset + 2], data[offset + 3]]) as usize;
                let mut sub_off = offset + h_size;
                let mut type_chunks = Vec::new();
                let end_pkg = std::cmp::min(offset + c_size, data.len());

                while sub_off + 8 <= end_pkg {
                    let s_type = u16::from_le_bytes([data[sub_off], data[sub_off + 1]]);
                    let s_size = u32::from_le_bytes([data[sub_off + 4], data[sub_off + 5], data[sub_off + 6], data[sub_off + 7]]) as usize;
                    if s_size == 0 {
                        break;
                    }

                    if s_type == CHUNK_TABLE_TYPE {
                        type_chunks.push(sub_off);
                    }
                    sub_off += s_size;
                }

                packages.push(ArscPackage {
                    id: pkg_id,
                    name: pkg_name,
                    type_chunks,
                });
            }

            offset += c_size;
        }

        Some(Self {
            data,
            global_strings,
            packages,
        })
    }

    pub fn resolve_string(&self, res_id: u32) -> Option<String> {
        let target_pkg = ((res_id >> 24) & 0xFF) as u32;
        let target_type = ((res_id >> 16) & 0xFF) as u8;
        let target_entry = (res_id & 0xFFFF) as u32;

        for pkg in &self.packages {
            if pkg.id != target_pkg && pkg.id != 0 {
                continue;
            }

            for &t_off in &pkg.type_chunks {
                if t_off + 20 > self.data.len() {
                    continue;
                }

                let type_id = self.data[t_off + 8];
                let flags = self.data[t_off + 9];
                if type_id != target_type {
                    continue;
                }

                let entry_count = u32::from_le_bytes([self.data[t_off + 12], self.data[t_off + 13], self.data[t_off + 14], self.data[t_off + 15]]);
                let entries_start = u32::from_le_bytes([self.data[t_off + 16], self.data[t_off + 17], self.data[t_off + 18], self.data[t_off + 19]]) as usize;
                let h_len = u16::from_le_bytes([self.data[t_off + 2], self.data[t_off + 3]]) as usize;
                let table_start = t_off + h_len;

                let mut entry_abs = None;

                if (flags & FLAG_SPARSE) != 0 {
                    for k in 0..entry_count {
                        let sp_pos = table_start + k as usize * 4;
                        if sp_pos + 4 > self.data.len() {
                            break;
                        }
                        let s_idx = u16::from_le_bytes([self.data[sp_pos], self.data[sp_pos + 1]]) as u32;
                        let s_off4 = u16::from_le_bytes([self.data[sp_pos + 2], self.data[sp_pos + 3]]) as usize;
                        if s_idx == target_entry {
                            entry_abs = Some(t_off + entries_start + (s_off4 * 4));
                            break;
                        }
                    }
                } else if target_entry < entry_count {
                    let pos = table_start + target_entry as usize * 4;
                    if pos + 4 <= self.data.len() {
                        let off_rel = u32::from_le_bytes([self.data[pos], self.data[pos + 1], self.data[pos + 2], self.data[pos + 3]]);
                        if off_rel != 0xFFFFFFFF {
                            entry_abs = Some(t_off + entries_start + off_rel as usize);
                        }
                    }
                }

                if let Some(abs) = entry_abs {
                    if abs + 16 <= self.data.len() {
                        let e_flags = u16::from_le_bytes([self.data[abs + 2], self.data[abs + 3]]);
                        if (e_flags & FLAG_COMPLEX) == 0 {
                            let v_type = self.data[abs + 11];
                            let v_data = u32::from_le_bytes([self.data[abs + 12], self.data[abs + 13], self.data[abs + 14], self.data[abs + 15]]);

                            if v_type == TYPE_STRING {
                                if let Some(ref gs) = self.global_strings {
                                    if let Some(s) = gs.get(v_data as usize) {
                                        return Some(s.to_string());
                                    }
                                }
                            } else if v_type == TYPE_REFERENCE && v_data != res_id {
                                if let Some(s) = self.resolve_string(v_data) {
                                    return Some(s);
                                }
                            }
                        }
                    }
                }
            }
        }

        None
    }
}
