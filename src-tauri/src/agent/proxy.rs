//! LLM 请求流式透传代理。
//!
//! 目的：把「持有 API Key 的请求」从前端搬到 Rust 侧。
//! 前端只发「目标 provider + 模型 + 请求体（不含 key）」，
//! Rust 从钥匙串取 key，注入 Authorization 头，转发到 provider，
//! 并把流式响应原样透传回前端。
//!
//! 这样 API Key 既不在前端 bundle 里，也不经过任何中间环节。

use serde::Deserialize;
use serde_json::Value;

/// 前端 -> Rust 的代理请求体
#[derive(Deserialize)]
pub struct ProxyRequest {
    /// provider 标识，用于从钥匙串取 key（如 "openai" / "anthropic"）
    pub service: String,
    /// 钥匙串里的 account 名（可选，默认取 service 同名）
    #[serde(default)]
    pub account: Option<String>,
    /// 目标 API 的完整 URL
    pub url: String,
    /// 鉴权头类型：bearer（默认）或 api-key（自定义头名）
    #[serde(default)]
    pub auth_type: Option<String>,
    /// 请求体（透传给 provider 的 JSON）
    pub body: Value,
}

/// 从钥匙串取 key 并注入 Authorization 头，返回构造好的 reqwest 请求。
fn build_request(req: &ProxyRequest) -> Result<reqwest::RequestBuilder, String> {
    let service = req.service.as_str();
    let account = req.account.as_deref().unwrap_or(service);
    let key = super::secrets::get_secret(service, account)?;

    let client = reqwest::Client::new();
    let builder = client.post(&req.url).json(&req.body);

    match req.auth_type.as_deref().unwrap_or("bearer") {
        "bearer" => Ok(builder.bearer_auth(key)),
        "api-key" => Ok(builder.header("Authorization", key)),
        header => Ok(builder.header(header, key)),
    }
}

/// 流式代理：把 provider 的响应流逐块转发。
/// 返回 `reqwest::Response`，前端通过 Tauri 的 channel 消费 body 流。
pub async fn proxy_stream(req: ProxyRequest) -> Result<reqwest::Response, String> {
    let builder = build_request(&req)?;
    let resp = builder.send().await.map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        return Err(format!("provider 返回错误状态码 {status}"));
    }
    Ok(resp)
}

/// 非流式代理：读完整响应体后返回字符串。
/// 用于需要完整结果的一次性调用（如获取模型列表）。
pub async fn proxy_json(req: ProxyRequest) -> Result<String, String> {
    let builder = build_request(&req)?;
    let resp = builder.send().await.map_err(|e| e.to_string())?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        return Err(format!("provider 返回错误（{status}）：{text}"));
    }
    Ok(text)
}
