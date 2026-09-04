# Windows 单文件交付与 Authenticode

> 成熟度：Portable、NSIS、MSI 的本地构建与校验链路已提供；模板默认未配置 Authenticode 证书，也不会代替开发者完成身份验证或证书采购。

这条路径面向希望先让应用可用、再逐步补齐商业发布能力的个人开发者。请把三个目标分开理解：

1. **能运行**：本地生成一个无需安装的 Portable EXE。
2. **便于分发**：把 Portable、安装包和校验和作为 GitHub Release 资产。
3. **被 Windows 识别为可信发布者**：使用公共 CA 的 Authenticode 证书签名，并持续积累 SmartScreen 信誉。

## 最快落地：先做 Portable EXE

在 Windows 开发机安装 Node.js、Rust、Tauri 前置依赖和项目依赖后运行：

```powershell
npm ci
npm run package:windows
```

输出位于 `release-artifacts/windows/<version>/`：

| 资产 | 用途 |
| --- | --- |
| `*_Portable.exe` | 单文件运行，不需要安装 |
| `*_Setup.exe` | 当前用户 NSIS 安装包 |
| `*_Installer.msi` | Windows Installer 安装包 |
| `SHA256SUMS.txt` | 三个二进制的 SHA-256 校验值 |
| `manifest.json` | 产品、版本、架构和签名状态 |

只想复核已有本地产物时运行：

```powershell
npm run package:windows:audit
```

Portable 的含义只是“应用本体无需安装”。Tauri 的 SQLite、Store 和日志仍默认写入当前用户的 AppData，而不是 EXE 旁边；若业务确实要求“U 盘带走数据”，需要另外设计数据目录和并发/备份策略，不能直接把系统数据目录改到可执行文件旁边。

Portable 直接依赖系统提供的 Microsoft Edge WebView2 Runtime。Windows 10/11 的常规环境通常已有该运行时；精简系统或旧机器应先安装 [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)。这条原始 EXE 路径只适用于不依赖 sidecar 或相邻资源文件的应用；若派生项目新增 sidecar、外部模型或必须随包分发的文件，应改用安装包或自行设计完整便携目录，不能继续承诺“一个 EXE 即可运行”。

## GitHub Release 自动发布

模板工作流在 Windows 构建完成后会：

1. 从 `src-tauri/target/release/` 复制原始应用 EXE；
2. 使用产品名生成稳定的 ASCII Portable 文件名；
3. 生成独立 `.sha256` 文件；
4. 上传到同一个 GitHub Release；
5. 再次查询 Release 资产，缺少 Portable 时令任务失败。

模板的 updater URL 仍是 `OWNER/REPO` 占位符。派生项目必须先修改仓库地址、应用标识、版本、公钥和图标，再运行严格发布检查：

```powershell
npm run release:check -- --mode=release
```

标签构建使用 `v<package version>`。即使保留手动入口，工作流也只接受从已有 tag 启动的运行，防止分支构建覆盖同版本资产。模板 Release 默认保持 draft，便于开发者在正式公开前检查产物；派生项目可以在验证成熟后改为公开发布。

## updater 签名不等于 Authenticode

- `TAURI_SIGNING_PRIVATE_KEY` 用于 Tauri updater 校验，证明更新包没有被替换。
- Authenticode 代码签名用于 Windows 验证 EXE/MSI 的发布者身份，并在文件属性与安全提示中显示发布者。

只配置 updater 私钥不会消除“发布者未知”。自签名证书也不适合公开下载：除非每台设备预先信任该根证书，否则用户体验接近未签名。

## 个人开发者怎么选

| 路径 | 适用阶段 | 现实边界 |
| --- | --- | --- |
| 未签名 Portable + SHA-256 | 自用、可信小范围测试、快速验证产品 | 成本最低，但可能出现 SmartScreen 提示 |
| 公共 CA 的 OV/EV Code Signing | GitHub 等站外公开分发 | 需要实名/组织验证与费用；现代证书通常使用 USB Token 或云 HSM |
| Microsoft Artifact Signing Public Trust | 支持地区内、希望用 Azure 托管签名的开发者 | 当前公开身份验证地区不覆盖中国大陆个人/组织 |
| Microsoft Store | 面向普通 Windows 用户 | 商店分发是微软推荐的最低警告路径，但需要账号与审核 |
| 自签名证书 | 已统一下发信任根的企业内网 | 不适合公开分发 |

不建议单纯为了“立即消除 SmartScreen”购买 EV。微软当前说明 EV 已不再自动获得即时信誉；合法新证书和新文件也可能暂时显示警告。签名解决身份与完整性，信誉还依赖稳定发布者、稳定来源和真实下载历史。

## 接入 Authenticode 的三种实现

证书采购属于外部身份与财务流程，脚手架只能预留接入位置：

1. **云 HSM / 远程签名（推荐）**：在 Tauri 的 `bundle.windows.signCommand` 中调用供应商 CLI。CI 使用 OIDC 或供应商凭据，私钥不进入仓库或 runner 文件系统。
2. **USB Token**：使用插有 Token 的自托管 Windows runner，根据 CA 提供的 KSP/SignTool 参数签名。GitHub 托管 runner 无法访问你的本地 USB Token。
3. **可导出 PFX**：仅在 CA 明确允许导出时，把 Base64 PFX 和密码分别存入 GitHub Secrets，构建时临时导入证书库；不要提交 PFX、密码或编码后的证书内容。

所有路径都应使用 CA 提供的 RFC 3161 时间戳，并验证应用 EXE、Portable、NSIS 和 MSI：

```powershell
Get-AuthenticodeSignature .\release-artifacts\windows\<version>\*.exe |
  Format-Table Path, Status, SignerCertificate, TimeStamperCertificate
signtool verify /pa /all /v .\path\to\application.exe
signtool verify /pa /all /v .\path\to\installer.msi
```

正式发布门禁至少应确认：`Status` 为 `Valid`、Subject 是预期个人或公司、包含 Code Signing EKU、证书链可信、时间戳存在、tag 与应用版本一致。没有证书时可以继续生成明确标记为 unsigned 的本地包，但不能称为已签名发布。

官方资料：

- [Microsoft：SmartScreen reputation for Windows app developers](https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation)
- [Tauri：Windows Code Signing](https://v2.tauri.app/distribute/sign/windows/)
- [Microsoft：Artifact Signing quickstart](https://learn.microsoft.com/azure/artifact-signing/quickstart)
- [Microsoft：Artifact Signing integrations](https://learn.microsoft.com/azure/artifact-signing/how-to-signing-integrations)
