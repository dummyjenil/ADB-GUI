const CHUNK_STRING_POOL: u16 = 0x0001;
const CHUNK_XML_START_ELEMENT: u16 = 0x0102;
const TYPE_REFERENCE: u8 = 0x01;
const TYPE_STRING: u8 = 0x03;

pub struct StringPool {
    pub strings: Vec<String>,
}

impl StringPool {
    pub fn parse(data: &[u8], offset: usize) -> Option<Self> {
        if offset + 28 > data.len() {
            return None;
        }

        let chunk_type = u16::from_le_bytes([data[offset], data[offset + 1]]);
        if chunk_type != CHUNK_STRING_POOL {
            return None;
        }

        let header_size = u16::from_le_bytes([data[offset + 2], data[offset + 3]]) as usize;
        let string_count = u32::from_le_bytes([data[offset + 8], data[offset + 9], data[offset + 10], data[offset + 11]]) as usize;
        let flags = u32::from_le_bytes([data[offset + 16], data[offset + 17], data[offset + 18], data[offset + 19]]);
        let strings_start = u32::from_le_bytes([data[offset + 20], data[offset + 21], data[offset + 22], data[offset + 23]]) as usize;
        let is_utf8 = (flags & (1 << 8)) != 0;

        let offset_array_start = offset + header_size;
        let mut string_offsets = Vec::with_capacity(string_count);

        for i in 0..string_count {
            let pos = offset_array_start + i * 4;
            if pos + 4 > data.len() {
                break;
            }
            let off = u32::from_le_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]) as usize;
            string_offsets.push(offset + strings_start + off);
        }

        let mut strings = Vec::with_capacity(string_count);

        for s_off in string_offsets {
            if s_off >= data.len() {
                strings.push(String::new());
                continue;
            }

            if is_utf8 {
                let u16_len = data[s_off];
                let mut cur = s_off + if (u16_len & 0x80) != 0 { 2 } else { 1 };
                if cur >= data.len() {
                    strings.push(String::new());
                    continue;
                }
                let mut u8_len = data[cur] as usize;
                cur += if (u8_len & 0x80) != 0 { 2 } else { 1 };
                if (data[cur - 1] & 0x80) != 0 {
                    u8_len = ((u8_len & 0x7F) << 8) | data[cur - 1] as usize;
                }

                if cur + u8_len <= data.len() {
                    let s = String::from_utf8_lossy(&data[cur..cur + u8_len]).to_string();
                    strings.push(s);
                } else {
                    strings.push(String::new());
                }
            } else {
                if s_off + 2 > data.len() {
                    strings.push(String::new());
                    continue;
                }
                let mut u16_len = u16::from_le_bytes([data[s_off], data[s_off + 1]]) as usize;
                let mut cur = s_off + 2;
                if (u16_len & 0x8000) != 0 {
                    if cur + 2 > data.len() {
                        strings.push(String::new());
                        continue;
                    }
                    u16_len = ((u16_len & 0x7FFF) << 16) | (u16::from_le_bytes([data[cur], data[cur + 1]]) as usize);
                    cur += 2;
                }

                let byte_len = u16_len * 2;
                if cur + byte_len <= data.len() {
                    let u16_slice: Vec<u16> = data[cur..cur + byte_len]
                        .chunks_exact(2)
                        .map(|c| u16::from_le_bytes([c[0], c[1]]))
                        .collect();
                    let s = String::from_utf16_lossy(&u16_slice);
                    strings.push(s);
                } else {
                    strings.push(String::new());
                }
            }
        }

        Some(Self { strings })
    }

    pub fn get(&self, idx: usize) -> Option<&str> {
        self.strings.get(idx).map(|s| s.as_str())
    }
}

#[allow(dead_code)]
pub struct AxmlManifest {
    pub package_name: Option<String>,
    pub app_label_str: Option<String>,
    pub app_label_ref: Option<u32>,
    pub launcher_label_str: Option<String>,
    pub launcher_label_ref: Option<u32>,
}

pub fn parse_manifest(data: &[u8]) -> Option<AxmlManifest> {
    if data.len() < 8 {
        return None;
    }

    let magic = u16::from_le_bytes([data[0], data[1]]);
    if magic != 0x0003 {
        return None;
    }

    let header_size = u16::from_le_bytes([data[2], data[3]]) as usize;
    let mut offset = header_size;
    let mut string_pool = None;

    let mut package_name = None;
    let mut app_label_str = None;
    let mut app_label_ref = None;
    let mut launcher_label_str = None;
    let mut launcher_label_ref = None;

    let mut current_activity_str = None;
    let mut current_activity_ref = None;

    while offset + 8 <= data.len() {
        let chunk_type = u16::from_le_bytes([data[offset], data[offset + 1]]);
        let chunk_size = u32::from_le_bytes([data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]]) as usize;
        if chunk_size == 0 {
            break;
        }

        if chunk_type == CHUNK_STRING_POOL {
            string_pool = StringPool::parse(data, offset);
        } else if chunk_type == CHUNK_XML_START_ELEMENT {
            if let Some(ref sp) = string_pool {
                if offset + 30 <= data.len() {
                    let name_idx = u32::from_le_bytes([data[offset + 20], data[offset + 21], data[offset + 22], data[offset + 23]]) as usize;
                    let attr_start = u16::from_le_bytes([data[offset + 24], data[offset + 25]]) as usize;
                    let attr_size = u16::from_le_bytes([data[offset + 26], data[offset + 27]]) as usize;
                    let attr_count = u16::from_le_bytes([data[offset + 28], data[offset + 29]]) as usize;

                    let tag_name = sp.get(name_idx).unwrap_or("");
                    let mut a_off = offset + 16 + attr_start;

                    for _ in 0..attr_count {
                        if a_off + 20 > data.len() {
                            break;
                        }

                        let a_name_idx = u32::from_le_bytes([data[a_off + 4], data[a_off + 5], data[a_off + 6], data[a_off + 7]]) as usize;
                        let raw_val_idx = u32::from_le_bytes([data[a_off + 8], data[a_off + 9], data[a_off + 10], data[a_off + 11]]) as usize;
                        let val_type = data[a_off + 15];
                        let val_data = u32::from_le_bytes([data[a_off + 16], data[a_off + 17], data[a_off + 18], data[a_off + 19]]);

                        let attr_name = sp.get(a_name_idx).unwrap_or("");

                        if tag_name == "manifest" && attr_name == "package" {
                            package_name = sp.get(raw_val_idx).map(|s| s.to_string());
                        }

                        if tag_name == "application" && attr_name == "label" {
                            if val_type == TYPE_STRING {
                                app_label_str = sp.get(val_data as usize).map(|s| s.to_string());
                            } else if val_type == TYPE_REFERENCE || (val_data & 0xFF000000) != 0 {
                                app_label_ref = Some(val_data);
                            }
                        }

                        if tag_name == "activity" && attr_name == "label" {
                            if val_type == TYPE_STRING {
                                current_activity_str = sp.get(val_data as usize).map(|s| s.to_string());
                            } else if val_type == TYPE_REFERENCE || (val_data & 0xFF000000) != 0 {
                                current_activity_ref = Some(val_data);
                            }
                        }

                        if tag_name == "category" && attr_name == "name" {
                            let cat_name = sp.get(raw_val_idx).or_else(|| sp.get(val_data as usize)).unwrap_or("");
                            if cat_name == "android.intent.category.LAUNCHER" {
                                if current_activity_str.is_some() {
                                    launcher_label_str = current_activity_str.clone();
                                }
                                if current_activity_ref.is_some() {
                                    launcher_label_ref = current_activity_ref;
                                }
                            }
                        }

                        a_off += attr_size;
                    }
                }
            }
        }

        offset += chunk_size;
    }

    Some(AxmlManifest {
        package_name,
        app_label_str,
        app_label_ref,
        launcher_label_str,
        launcher_label_ref,
    })
}
