//! Agent 能力模块（P2：密钥安全代理）。
//!
//! 由 Cargo feature `agent` 门控。提供三个 Tauri command：
//! - set_api_key / has_api_key / delete_api_key：OS 钥匙串写入、存在性检查与删除
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

/// 检查系统钥匙串中是否已配置 API Key，不返回密钥内容。
#[tauri::command]
pub fn has_api_key(service: String, account: String) -> Result<bool, String> {
    secrets::has_secret(&service, &account)
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
    on_chunk: Channel<Vec<u8>>,
) -> Result<(), String> {
    use futures_util::StreamExt;

    let resp = proxy::proxy_stream(req).await?;
    let mut stream = resp.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        on_chunk.send(chunk.to_vec()).map_err(|e| e.to_string())?;
    }
    Ok(())
}
