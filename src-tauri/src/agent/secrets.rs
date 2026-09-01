//! OS 钥匙串密钥存取。
//!
//! 用 keyring crate 把 API Key 存进系统钥匙串：
//! - macOS → Keychain
//! - Windows → Credential Manager
//! - Linux → Secret Service
//!
//! 密钥永不落盘到应用数据目录，也绝不出现在前端 bundle。

use keyring::Entry;

const SERVICE: &str = "meow-starter";

/// 保存密钥到钥匙串。`service` 用于区分不同 provider（如 "openai" / "anthropic"）。
pub fn set_secret(service: &str, account: &str, secret: &str) -> Result<(), String> {
    let entry = Entry::new(&format!("{SERVICE}:{service}"), account).map_err(|e| e.to_string())?;
    entry.set_password(secret).map_err(|e| e.to_string())
}

/// 从钥匙串读取密钥。
pub fn get_secret(service: &str, account: &str) -> Result<String, String> {
    let entry = Entry::new(&format!("{SERVICE}:{service}"), account).map_err(|e| e.to_string())?;
    entry.get_password().map_err(|e| e.to_string())
}

/// 删除密钥。
pub fn delete_secret(service: &str, account: &str) -> Result<(), String> {
    let entry = Entry::new(&format!("{SERVICE}:{service}"), account).map_err(|e| e.to_string())?;
    entry.delete_credential().map_err(|e| e.to_string())
}
