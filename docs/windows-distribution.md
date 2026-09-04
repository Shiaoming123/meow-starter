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

1. 从当前有效的 Cargo target 目录复制原始应用 EXE；
2. 使用显式配置的 ASCII 资产前缀生成稳定的 Portable 文件名；
3. 生成独立 `.sha256` 文件；
4. 上传到同一个 GitHub Release；
5. 再次查询 Release 资产，缺少 Portable 时令任务失败。

模板的 updater URL 仍是 `OWNER/REPO` 占位符。派生项目必须先修改仓库地址、应用标识、版本、公钥和图标，再运行严格发布检查：

```powershell
npm run release:check -- --mode=release
```

标签构建使用 `v<package version>`。即使保留手动入口，工作流也只接受从已有 tag 启动的运行，防止分支构建覆盖同版本资产。模板 Release 默认保持 draft，便于开发者在正式公开前检查产物；派生项目可以在验证成熟后改为公开发布。

## 发布前防错清单

把本节当作 Windows 交付变更的最小门禁。路径、名称、版本和架构都应从当前配置与构建元数据派生，不要把某次成功构建的绝对路径、二进制名或 `x64` 固化进脚本。

### 1. 路径与二进制身份

- 所有路径用 Node.js `path.resolve`、`path.join`、`path.basename` 等 API 处理。通用测试用当前宿主的 `resolve(...)` 生成绝对路径；必须验证另一平台的字符串语义时，显式使用 `path.win32` 或 `path.posix`，不要把 `D:/...` 直接当成 Linux 上的绝对路径。
- 单元测试只验证纯路径推导和清单逻辑；`signtool`、PowerShell Authenticode、NSIS/MSI 安装等真实 Windows 行为放到 Windows runner 或 Windows 本机 smoke 中。
- 构建、打包、审计、Portable staging 与 smoke 必须解析同一个 `CARGO_TARGET_DIR`。相对值以项目根目录解析；未设置时才使用 Cargo/Tauri 的默认 target 目录。
- 原始 EXE 名称使用 `tauri.conf.json` 的 `mainBinaryName`；未配置时才回退到 Cargo package 名。`productName` 是面向用户的展示名，不能假定它等于磁盘上的主二进制名。
- 打包前校验 `package.json`、`Cargo.toml`、`tauri.conf.json` 中当前产品标识、版本、identifier、架构和二进制名；审计也要重新读取当前配置，避免把旧版本目录里的合法产物误判为本次产物。
- NSIS、MSI 与 Portable 必须各自只有一个候选文件、文件名不冲突且内容摘要不相同。仅检查扩展名或 `MZ` 文件头不足以证明找对了产物；至少还要校验完整 PE 结构与当前元数据。

### 2. GitHub Actions 与 Tauri action 输入

- `uses:` 固定到经过评审的 action 版本，并以该固定版本的 README 和 `action.yml` 为输入参数的唯一依据；不要从别的 major、博客或旧项目复制相似参数名。
- 对 workflow 做静态检查：删除注释行后再判断必需步骤与输入，避免注释中的伪配置让检查误通过；条件检查应覆盖真实仓库 workflow，而不只是测试夹具。
- 对当前 `tauri-apps/tauri-action` 接口，发布 updater JSON 与自定义资产名使用 `includeUpdaterJson`、`assetNamePattern`。`uploadUpdaterJson`、`releaseAssetNamePattern` 是不同接口语义下的相似名称，不能当作等价替换；action 升级后仍须以新固定版本文档复核。
- 如果 `productName` 含非 ASCII 字符，不要依赖上传端的隐式清洗。为 `assetNamePattern` 配置显式 ASCII slug（不要使用会展开为展示名的占位符），并让 updater JSON、二进制和 `.sig` 在同一步骤按同一规则生成；生成 JSON 后再重命名资产会破坏更新地址与签名文件的对应关系。
- “该 action 使用的 Node.js runtime 即将弃用”通常指 action 自身的 JavaScript runtime，而不是应用选择的 Node.js 或 `npm ci`。定位产生警告的 `uses:` 步骤，按该 action 的发布说明升级到受支持版本并复测；单独修改 `setup-node` 的应用 Node 版本不会修复另一个 action 的 runtime。

### 3. Tag、draft 与资产完整性

- 正式工作流只接受已有的 `v<package version>` tag；`workflow_dispatch` 从分支或任意 SHA 启动时应立即失败。确认 tag、源码提交与三个版本文件一致后再构建。
- Release 保持 draft，直到每个平台的必需资产、签名状态和 smoke 结果都已复核。不要让一次矩阵任务提前公开尚未完整的 Release。
- 本地完整交付包与 GitHub Release staging 使用不同目录。后者只放准许公开的资产，避免 glob 把本地 manifest、调试文件或旧版本一起上传。
- 每个公开二进制生成独立 `.sha256`；上传后重新查询 Release 资产的 `sha256:<hex>` digest，再下载远端 `.sha256` 并与本地期望内容精确比较。只检查资产“存在”无法发现同名旧文件或错误上传。
- digest 和 `.sha256` 证明字节一致，不证明发布者身份、证书有效、SmartScreen 信誉或 updater 签名有效；这些证据必须分别验证。

### 4. Portable 的边界

- Portable 表示“不安装应用本体”，不是“所有数据都写在 EXE 旁边”。默认数据、SQLite、Store 和日志仍在用户 AppData；排障时应检查隔离后的 `APPDATA`/`LOCALAPPDATA`，不要在源码或发布目录寻找数据库。
- 原始 EXE 不包含 WebView2 Runtime。干净机器启动失败时先验证 WebView2，而不是立即把问题归为打包损坏。
- 只有完全自包含的应用才能承诺单 EXE。新增 sidecar、模型、DLL 或相邻资源后，应改为安装包或带完整目录的便携包，并增加缺失文件测试。

### 5. 两种签名与证书路径

- Tauri updater 私钥签的是更新元数据/更新包；Authenticode 证书签的是 Windows EXE/MSI。前者通过不代表文件属性会显示可信发布者，后者也不能代替 updater 校验。
- 云 HSM/远程签名、USB Token、自托管 runner 或允许导出的 PFX 是不同接入路径。先根据 CA 的交付方式选择实现，再写 `signCommand`；不要假定购买证书后一定能拿到可复制的 PFX。
- PFX、密码、Token PIN、云签名凭据与 updater 私钥只进入 secret manager。日志可以记录证书 Subject、Thumbprint、时间戳和验证状态，但不得打印私钥或秘密值。

## 按症状排障

| 症状 | 先确认 | 修复方向 |
| --- | --- | --- |
| 找不到原始 EXE，或 Portable 其实是安装器 | 有效 `CARGO_TARGET_DIR`、profile、`mainBinaryName`、候选文件数量和 PE 元数据 | 让构建与 staging 共用同一 target 解析函数；不要按展示名或固定 `target/release` 猜路径 |
| 本地审计通过，Release 却是旧文件 | tag 指向、draft 资产列表、staging 目录、远端 digest 与下载后的 `.sha256` | 停止公开；清空并重建隔离 staging，重新上传后逐项比对内容 |
| `latest.json` 指向不存在的文件，或找不到对应 `.sig` | 固定 action 版本支持的输入名、`assetNamePattern`、展示名是否含非 ASCII、上传后是否重命名 | 改用该版本真实输入；统一 ASCII 资产规则，重新生成 JSON/签名/资产，不手工改名 |
| Portable 首次运行后“没有数据” | 隔离的 `APPDATA`/`LOCALAPPDATA` 与应用 identifier | 按系统数据目录验证持久化；只有明确设计便携数据模式时才改数据位置 |
| 干净 Windows 无法启动 | WebView2、sidecar/相邻资源、架构、完整 PE 与 Authenticode 状态 | 安装或引导 WebView2；有外部依赖时改用完整包；按目标架构重建 |
| 文件显示“未知发布者” | `Get-AuthenticodeSignature`/`signtool verify`，而不是 updater `.sig` | 接入公共 CA Authenticode 与时间戳；没有证书时明确标记 unsigned |
| `npm ci` 长时间没有新日志 | 进程是否仍在运行、网络/registry、runner CPU/磁盘、最终退出码 | 慢但仍运行不等于失败；保留足够超时并观察。只有非零退出、明确 `npm ERR!` 或超时才进入失败处理 |
| `npm ci` 明确失败 | 第一条根因、lockfile 同步、registry/代理/认证、磁盘空间 | 修复 lockfile 或环境；仅对已确认的瞬时网络故障做有限重试，不在 Release job 用 `npm install` 偷改 lockfile |
| Actions 报 Node runtime 弃用警告 | 警告对应的具体 `uses:` action 与固定版本 | 查该 action 的版本说明并升级、复测；不要把依赖安装变慢或应用 Node 版本当作同一故障 |

## 事故修复顺序

1. 保持 Release 为 draft，暂停公开与覆盖上传，记录失败 job、tag、提交和当前资产列表。
2. 先分类失败阶段：依赖安装、源码/版本门禁、编译、打包、staging、上传、摘要、签名或运行时 smoke。警告与非零退出分开记录。
3. 复核有效 Cargo target、`mainBinaryName`、tag 和 action 固定版本输入；只重建受影响的平台产物。
4. 将准许发布的文件复制到新的隔离 staging，生成本地 SHA-256，并完成 PE、元数据、重复内容与 Authenticode 检查。
5. 上传到 draft 后重新查询远端 digest、下载 checksum 并逐字节核对；updater 发布还要确认 JSON、资产名和 `.sig` 的对应关系。
6. 在隔离 AppData 的 Windows 环境做启动/持久化 smoke，并在干净环境验证 WebView2 与所有外部资源前置条件。
7. 所有平台证据齐全后才公开 Release；仍有未知项时保留 draft，并把未验证边界写进交接记录。

建议把以下命令及其退出码保存在发布证据中：

```powershell
npm ci
npm test
npm run check:docs
npm run release:check -- --mode=release
npm run package:windows
npm run package:windows:audit
npm run smoke:windows-package
```

模板占位符尚未替换时，严格 release 检查失败是正确结果；不能为了“跑绿”降低为 template 模式。`npm ci` 的等待时间、Actions runtime 警告与真正失败也应分别记录，避免错误重试掩盖根因。

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

- [tauri-action v0：`action.yml` 输入定义](https://github.com/tauri-apps/tauri-action/blob/v0/action.yml)
- [GitHub Actions：JavaScript action 的 `runs.using` runtime](https://docs.github.com/actions/reference/workflows-and-actions/metadata-syntax#runs-for-javascript-actions)
- [Microsoft：SmartScreen reputation for Windows app developers](https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation)
- [Tauri：Windows Code Signing](https://v2.tauri.app/distribute/sign/windows/)
- [Microsoft：Artifact Signing quickstart](https://learn.microsoft.com/azure/artifact-signing/quickstart)
- [Microsoft：Artifact Signing integrations](https://learn.microsoft.com/azure/artifact-signing/how-to-signing-integrations)
