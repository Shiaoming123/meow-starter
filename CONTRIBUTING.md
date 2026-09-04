# 贡献指南

感谢你考虑为这个模板做出贡献！本模板的目标是降低「每个桌面 App 项目从零搭工程」的重复成本，任何能让它更开箱即用的改动都欢迎。

## 开发环境

参见 [README](./README.md) 的「环境要求」，确保本地已安装 Node.js 22+、npm 10+ 与 Rust 1.77.2+。

## 分支策略

- `main` 为保护分支，只接受通过 Pull Request 的合并。
- 功能开发从 `main` 切出 `feat/xxx`，缺陷修复用 `fix/xxx`。

## 提交规范

提交信息采用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
feat: 新增 xxx
fix: 修复 xxx
docs: 更新文档
chore: 构建 / 依赖调整
refactor: 重构（无功能变化）
```

## Pull Request 流程

1. Fork 本仓库并切出功能分支。
2. 确保 `npm run build` 与 `npm run tauri dev` 正常。
3. 提交 PR，并填写 PR 模板中的检查清单。
4. 至少一次 review 通过后合并。

`README.md` 是 GitHub 默认英文版，`README.zh-CN.md` 是中文版。修改任一 README 时，必须在同一个 PR 中同步另一语言，并保持功能声明、成熟度、命令和链接一致。

### 发布与 Windows 交付类 PR

修改 Release workflow、Tauri 打包、updater、Windows 资产命名或签名接入时，先阅读 [Windows 单文件交付与 Authenticode](./docs/windows-distribution.md) 的“发布前防错清单”和“按症状排障”。PR 至少应附上：

- `npm run check:docs` 与 `npm run release:check` 的结果；准备正式发布的派生项目使用 `npm run release:check -- --mode=release`。
- 涉及脚本逻辑时的 `npm test`，并说明 Windows/POSIX 路径、`CARGO_TARGET_DIR` 与 `mainBinaryName` 的覆盖情况。
- Windows 产物变化时的 `npm run package:windows:audit` 结果；签名或运行时变化还要附对应的 Authenticode 或 smoke 证据。
- workflow action 的固定版本及其输入来源；对照该版本的 README/`action.yml`，不要凭相似参数名推断。

不要在 PR、日志或测试夹具中放入真实证书路径、PFX 内容、密码、Token PIN、云签名凭据或 updater 私钥。

## 报告问题

- 功能请求与可复现的缺陷，请使用 Issue 模板。
- 安全相关漏洞请走 [SECURITY.md](./SECURITY.md) 的私下披露渠道，**不要**通过公开 Issue 报告。

## 代码风格

- Rust：以 `cargo fmt` 输出为准。
- TypeScript / Vue：以项目现有风格为准，提交前自行 `npm run typecheck`。
