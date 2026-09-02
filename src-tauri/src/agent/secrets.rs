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
const MAX_IDENTIFIER_BYTES: usize = 64;
const MAX_SECRET_BYTES: usize = 16 * 1024;

fn validate_identifier(value: &str, label: &str) -> Result<(), String> {
    let valid = !value.is_empty()
        && value.len() <= MAX_IDENTIFIER_BYTES
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'));
    if !valid {
        return Err(format!(
            "{label} 必须为 1–{MAX_IDENTIFIER_BYTES} 位 ASCII 字母、数字、点、下划线或连字符"
        ));
    }
    Ok(())
}

fn entry(service: &str, account: &str) -> Result<Entry, String> {
    validate_identifier(service, "service")?;
    validate_identifier(account, "account")?;
    Entry::new(&format!("{SERVICE}:{service}"), account).map_err(|e| e.to_string())
}

/// 保存密钥到钥匙串。`service` 用于区分不同 provider（如 "openai" / "anthropic"）。
pub fn set_secret(service: &str, account: &str, secret: &str) -> Result<(), String> {
    if secret.is_empty() || secret.len() > MAX_SECRET_BYTES {
        return Err(format!("secret 必须为 1–{MAX_SECRET_BYTES} 字节"));
    }
    entry(service, account)?
        .set_password(secret)
        .map_err(|e| e.to_string())
}

/// 从钥匙串读取密钥。
pub fn get_secret(service: &str, account: &str) -> Result<String, String> {
    entry(service, account)?
        .get_password()
        .map_err(|e| e.to_string())
}

/// 只返回存在性，不把密钥内容交给 WebView。
pub fn has_secret(service: &str, account: &str) -> Result<bool, String> {
    match entry(service, account)?.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(error) => Err(error.to_string()),
    }
}

/// 删除密钥。
pub fn delete_secret(service: &str, account: &str) -> Result<(), String> {
    entry(service, account)?
        .delete_credential()
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::validate_identifier;

    #[test]
    fn accepts_portable_secret_identifiers() {
        assert!(validate_identifier("openai", "service").is_ok());
        assert!(validate_identifier("team.default-1", "account").is_ok());
    }

    #[test]
    fn rejects_empty_oversized_or_unsafe_secret_identifiers() {
        for value in ["", "../openai", "with space", "slash/name"] {
            assert!(validate_identifier(value, "service").is_err(), "{value}");
        }
        assert!(validate_identifier(&"x".repeat(65), "service").is_err());
    }
}
