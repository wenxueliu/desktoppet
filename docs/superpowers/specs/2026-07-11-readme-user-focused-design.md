# 面向普通用户的 README 精简设计

## 目标

将根目录 `README.md` 从技术说明文档调整为普通用户的项目入口。用户应能快速理解 Desktop Pet 是什么、主要能力、如何启动、去哪里查看使用说明；实现细节由独立文档承接。

目标长度约为 100–130 行，不以严格行数为验收条件，优先保证信息完整和易读。

## README 保留内容

README 按以下顺序组织：

1. 项目名称、封面和一句话介绍。
2. 面向用户的主要功能。
3. 快速开始，包括环境要求、安装依赖和启动命令。
4. 基本使用入口，包括打开控制面板、导入 Petpack 和调整互动规则。
5. 精简的常用命令，仅保留启动、测试和构建入口。
6. 文档导航，区分用户文档与开发者文档。
7. 赞助信息和许可证。

README 不展开 Electron 进程模型、IPC、Petpack manifest 完整示例、动画队列语义、规则匹配算法、安全实现、配置存储结构或模块级项目目录。

## 文档拆分

新增 `docs/DEVELOPMENT.md` 作为开发者入口，集中放置：

- 开发环境和 npm 命令。
- 简要项目目录。
- Electron 三进程模型。
- 核心数据流与主要技术文档链接。
- 测试与构建说明。

现有文档继续承担各自职责：

- `docs/USER_GUIDE.md`：普通用户和创作者使用说明、Petpack 制作与导入。
- `docs/architecture/current-architecture.md`：当前系统架构和实现细节。
- `docs/panel-architecture.md`：控制面板模块设计。
- `docs/stateful-rules-design.md`：状态型规则设计。
- `docs/release/client-release-checklist.md`：发布流程。

不复制已有文档中的大段内容。开发者入口只提供必要概览和链接，以减少多处内容不同步的风险。

## 链接与兼容性

保留现有封面、赞助图片和许可证链接。README 中所有相对链接均从仓库根目录解析；`docs/DEVELOPMENT.md` 内的链接按其所在目录使用正确的相对路径。

本次只调整 Markdown 文档，不修改应用代码、配置格式、构建脚本或运行行为。

## 验证

完成后执行以下检查：

- 检查 README 长度和标题层级。
- 检查 README 与 `docs/DEVELOPMENT.md` 中的本地 Markdown 链接是否指向存在的文件。
- 搜索迁移后的技术主题，确认 README 不再包含大段实现细节。
- 检查 Git diff，确保不触碰工作区中已有的无关改动。
