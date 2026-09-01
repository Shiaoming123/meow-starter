//! Agent 能力模块（P2：密钥安全代理）。
//!
//! 由 Cargo feature `agent` 门控。提供三个 Tauri command：
//! - set_api_key / get_api_key / delete_api_key：OS 钥匙串存取
//! - proxy_json：非流式 LLM 请求代理
//! - proxy_stream：流式 LLM 请求代理（配合 Tauri channel）
//!
//! 详见 docs/agent-integration.md 的 P2 阶段说明。

pub mod proxy;
pub mod secrets;

use tauri::ipc::Channel;

/// 保存 API Key 到系统钥匙串。
#[tauri::command]
pub fn set_api_key(service: String, account: String, secret: String) -> Result<(), String> {
    secrets::set_secret(&service, &account, &secret)
}

/// 从系统钥匙串读取 API Key。
#[tauri::command]
pub fn get_api_key(service: String, account: String) -> Result<String, String> {
    secrets::get_secret(&service, &account)
}

/// 删除系统钥匙串中的 API Key。
#[tauri::command]
pub fn delete_api_key(service: String, account: String) -> Result<(), String> {
    secrets::delete_secret(&service, &account)
}

/// 非流式 LLM 请求代理：Rust 注入 key，转发请求，返回完整响应文本。
#[tauri::command]
pub async fn proxy_json(req: proxy::ProxyRequest) -> Result<String, String> {
    proxy::proxy_json(req).await
}

/// 流式 LLM 请求代理：把 provider 的流式响应逐块发到前端 channel。
#[tauri::command]
pub async fn proxy_stream(
    req: proxy::ProxyRequest,
    on_chunk: Channel<String>,
) -> Result<(), String> {
    use futures_util::StreamExt;

    let resp = proxy::proxy_stream(req).await?;
    let mut stream = resp.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        // 每块转成字符串（LLM 流式响应通常是 UTF-8 文本）
        let text = String::from_utf8_lossy(&chunk).to_string();
        on_chunk.send(text).map_err(|e| e.to_string())?;
    }
    Ok(())
}
