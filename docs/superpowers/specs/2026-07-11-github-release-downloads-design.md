# GitHub Release 自动打包与下载入口设计

## 目标

当仓库推送 `v*` 版本标签时，在 GitHub Actions 中分别构建 macOS 和 Windows 安装包。两个平台都构建成功后，工作流创建对应的 GitHub Release，并上传可被稳定链接访问的 `.dmg` 与 `.exe`。现有落地页和 README 提供最新版本的直接下载入口。

## 发布触发与版本

- 工作流监听形如 `v0.1.0` 的 `v*` 标签推送。
- 应用版本继续来自 `package.json`；发布前由维护者确保标签版本与 `package.json` 一致。
- GitHub Release 使用标签名称作为版本标识，并由自动化工作流创建。

## 构建架构

新增一个发布工作流，包含三个职责清晰的阶段：

1. macOS runner 安装依赖、运行应用构建，并用 Electron Builder 生成 DMG。
2. Windows runner 安装依赖、运行应用构建，并用 Electron Builder 生成 NSIS EXE。
3. 发布任务等待两个构建任务成功，下载两个临时 artifact，创建 GitHub Release 并上传安装包。

打包任务使用原生操作系统 runner，避免跨平台打包所需的 Wine、签名工具和格式支持差异。发布任务依赖两个平台任务，因此任一平台失败时都不会创建只有部分资产的 Release。

## Release 资产命名

Electron Builder 为发布产物使用不含版本号的固定名称：

- `Desktop-Pet-mac.dmg`
- `Desktop-Pet-windows.exe`

GitHub Release 允许不同 Release 重复使用相同资产名，因此固定名称可以支持永久的 latest-download URL：

- `https://github.com/duzexu/desktop-pet/releases/latest/download/Desktop-Pet-mac.dmg`
- `https://github.com/duzexu/desktop-pet/releases/latest/download/Desktop-Pet-windows.exe`

该命名只用于最终安装包；Actions 内部临时 artifact 可以按平台分别命名，避免下载和解压时发生冲突。

## 现有落地页集成

不新增页面，不改变当前七屏叙事结构。只修改最后一屏 `#new-home` 的 CTA 区域：

- 增加“下载 macOS”和“下载 Windows”两个同级主按钮。
- 两个按钮直接指向对应的 latest-download URL。
- 原有“查看 GitHub”保留为视觉权重较低的次级文字链接。
- 桌面宽度下按钮并列；空间不足时允许换行，移动端纵向排列。
- 沿用现有黑白配色、粗体字体、直角形态、箭头图标与交互反馈，不引入新的视觉系统或额外 JavaScript。

## README 集成

README 的项目简介区域增加三个入口：

- 下载 macOS
- 下载 Windows
- 查看全部 Releases

macOS 与 Windows 链接直接使用固定资产名的 latest-download URL；全部 Releases 指向仓库的 Releases 页面，便于查看历史版本与发布说明。

## 错误处理与安全性

- GitHub Actions 使用最小必需的 `contents: write` 权限创建 Release。
- 使用 `npm ci` 保证依赖与锁文件一致。
- 任一平台安装、构建或打包失败都会阻止发布任务运行。
- Release 创建失败或资产上传失败时工作流明确失败，不把部分成功报告为完整发布。
- 当前设计不加入代码签名、公证或自动版本修改；这些可在获得证书与发布要求后单独设计。

## 测试与验证

新增或扩展静态测试，验证：

- 发布工作流监听 `v*` 标签。
- 工作流包含 macOS、Windows 构建环境和 Release 写权限。
- Electron Builder 配置生成约定的固定资产名。
- 落地页包含两个 latest-download URL 和对应按钮文案。
- README 包含两个直接下载链接和 Releases 页面链接。

本地验证运行单元测试、落地页构建和 Electron renderer 构建。GitHub 托管 runner 的跨平台安装包生成只能在推送测试标签或手动复用工作流逻辑后完成最终验证；首次正式发布前应使用预发布标签检查 DMG、EXE 是否能安装和启动。

## 不在本次范围内

- Apple Developer ID 签名与 notarization。
- Windows Authenticode 签名。
- 自动生成 changelog 或 Release Notes 的定制模板。
- 在落地页进行操作系统自动识别。
- 保留旧格式产物名的兼容链接。
