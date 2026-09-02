//! LLM 请求流式透传代理。
//!
//! 目的：把「持有 API Key 的请求」从前端搬到 Rust 侧。
//! 前端只发「目标 provider + 模型 + 请求体（不含 key）」，
//! Rust 从钥匙串取 key，注入 Authorization 头，转发到 provider，
//! 并把流式响应原样透传回前端。
//!
//! 这样 API Key 既不在前端 bundle 里，也不经过任何中间环节。

use std::time::Duration;

use reqwest::{redirect::Policy, Url};
use serde::Deserialize;
use serde_json::Value;

const MAX_BODY_BYTES: usize = 2 * 1024 * 1024;

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProxyProvider {
    OpenAi,
    Anthropic,
}

/// 前端 -> Rust 的代理请求体
#[derive(Deserialize)]
pub struct ProxyRequest {
    /// 关闭集合：只允许内置并在 Rust 侧定义了鉴权规则的云端 provider。
    pub provider: ProxyProvider,
    /// provider 标识，用于从钥匙串取 key（如 "openai" / "anthropic"）
    pub service: String,
    /// 钥匙串里的 account 名（可选，默认取 service 同名）
    #[serde(default)]
    pub account: Option<String>,
    /// 目标 API 的完整 URL
    pub url: String,
    /// 请求体（透传给 provider 的 JSON）
    pub body: Value,
}

fn validate_target(provider: ProxyProvider, raw_url: &str) -> Result<Url, String> {
    let url = Url::parse(raw_url).map_err(|_| "代理目标 URL 无效".to_string())?;
    let expected_host = match provider {
        ProxyProvider::OpenAi => "api.openai.com",
        ProxyProvider::Anthropic => "api.anthropic.com",
    };
    let path_allowed = url.path() == "/v1" || url.path().starts_with("/v1/");
    let allowed = url.scheme() == "https"
        && url.host_str() == Some(expected_host)
        && url.port_or_known_default() == Some(443)
        && url.username().is_empty()
        && url.password().is_none()
        && url.fragment().is_none()
        && path_allowed;

    if !allowed {
        return Err("代理目标不在允许范围".to_string());
    }
    Ok(url)
}

/// 从钥匙串取 key 并注入 Authorization 头，返回构造好的 reqwest 请求。
fn build_request(req: &ProxyRequest) -> Result<reqwest::RequestBuilder, String> {
    let url = validate_target(req.provider, &req.url)?;
    let body = serde_json::to_vec(&req.body).map_err(|_| "代理请求体无法序列化".to_string())?;
    if body.len() > MAX_BODY_BYTES {
        return Err("代理请求体超过 2 MiB 上限".to_string());
    }

    let service = req.service.as_str();
    let account = req.account.as_deref().unwrap_or(service);
    let key = super::secrets::get_secret(service, account)?;

    let client = reqwest::Client::builder()
        .https_only(true)
        .redirect(Policy::none())
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| format!("无法创建代理客户端: {e}"))?;
    let builder = client.post(url).json(&req.body);

    match req.provider {
        ProxyProvider::OpenAi => Ok(builder.bearer_auth(key)),
        ProxyProvider::Anthropic => Ok(builder
            .header("x-api-key", key)
            .header("anthropic-version", "2023-06-01")),
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
    if !status.is_success() {
        return Err(format!("provider 返回错误状态码 {status}"));
    }
    let text = resp.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}

#[cfg(test)]
mod tests {
    use super::{validate_target, ProxyProvider};

    #[test]
    fn accepts_only_the_fixed_provider_origins() {
        assert!(
            validate_target(ProxyProvider::OpenAi, "https://api.openai.com/v1/responses",).is_ok()
        );
        assert!(validate_target(
            ProxyProvider::Anthropic,
            "https://api.anthropic.com/v1/messages",
        )
        .is_ok());
    }

    #[test]
    fn rejects_cross_provider_insecure_and_credentialed_targets() {
        for url in [
            "https://api.anthropic.com/v1/messages",
            "http://api.openai.com/v1/responses",
            "https://api.openai.com.evil.test/v1/responses",
            "https://user:pass@api.openai.com/v1/responses",
            "https://api.openai.com/dashboard",
        ] {
            assert!(
                validate_target(ProxyProvider::OpenAi, url).is_err(),
                "{url}"
            );
        }
    }
}
