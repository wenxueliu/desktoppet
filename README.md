# Desktop Pet

一个跨平台的 Electron 桌面宠物客户端，支持加载自定义素材包，通过规则引擎实现丰富的交互行为。

[English](#english-version) | [中文](#中文版本)

## 中文版本

### 功能特性

- 🎨 **自定义素材包** - 支持导入/导出 .petpack 格式的素材包
- 🎭 **多状态动画** - 支持 idle、walk、drag 等多种状态
- 🎯 **规则引擎** - 基于触发器和动作的灵活行为系统
- 🖱️ **窗口交互** - 拖拽、点击、悬停等交互支持
- ⚙️ **控制面板** - 可视化配置界面
- 🌍 **多语言支持** - 支持中文和英文界面切换
- 🔒 **安全机制** - 路径遍历防护、文件大小限制、ZIP bomb 防护
- 📦 **跨平台** - 支持 macOS、Windows、Linux

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 运行测试

```bash
# 单元测试
npm test

# E2E 测试
npm run test:e2e

# CI 环境（无头环境）
npm run test:e2e:ci
```

### 构建和打包

```bash
# 构建渲染进程
npm run build

# 打包应用（不生成安装包）
npm run pack

# 生成安装包
npm run dist
```

## 项目结构

```
desktop-pet/
├── src/
│   ├── main/              # 主进程
│   │   ├── main.js        # 应用入口
│   │   ├── ipc.js         # IPC 通信处理
│   │   ├── windows.js     # 窗口管理
│   │   ├── menu.js        # 菜单构建
│   │   ├── tray.js        # 系统托盘
│   │   └── services/      # 服务层
│   │       ├── config-store.js   # 配置管理
│   │       ├── asset-store.js    # 资源管理
│   │       └── petpack.js        # 素材包管理
│   ├── preload/           # 预加载脚本
│   │   ├── pet-preload.js
│   │   └── panel-preload.js
│   ├── renderer/          # 渲染进程
│   │   ├── pet/           # 宠物窗口
│   │   └── panel/         # 控制面板
│   └── shared/            # 共享模块
│       ├── defaults.js            # 默认配置
│       ├── manifest-validator.js  # 清单校验
│       ├── rule-engine.js         # 规则引擎
│       ├── event-context.js       # 事件上下文
│       └── action-runner.js       # 动作执行器
├── tests/                 # 测试文件
├── docs/                  # 文档
└── dist/                  # 构建输出
```

## 素材包格式

素材包是一个 ZIP 文件（扩展名 .petpack），包含以下结构：

```
my-pet.petpack
├── manifest.json          # 必需：清单文件
├── idle/                  # 状态目录
│   ├── frame1.gif
│   └── frame2.gif
├── walk/
│   └── animation.webm
└── drag/
    └── dragging.png
```

### manifest.json 示例

```json
{
  "id": "my-pet",
  "name": "我的宠物",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "宠物描述",
  "states": {
    "idle": {
      "assets": ["idle/frame1.gif", "idle/frame2.gif"],
      "frameDuration": 1000
    },
    "walk": {
      "assets": ["walk/animation.webm"],
      "loop": true
    }
  }
}
```

详细的清单文件规范请参考 [docs/requirements/desktop-client-prd.md](docs/requirements/desktop-client-prd.md)。

## 规则引擎

规则引擎支持基于触发器的行为定义：

### 触发器类型
- `interval` - 定时触发
- `onClick` - 点击触发
- `onDoubleClick` - 双击触发
- `onDragStart` / `onDragEnd` - 拖拽触发
- `onHoverEnter` / `onHoverLeave` - 悬停触发

### 动作类型
- `setState` - 切换状态
- `playSound` - 播放音效
- `showBubble` - 显示气泡
- `setOpacity` - 设置透明度
- `executeCommand` - 执行系统命令

### 规则示例

```json
{
  "rules": [
    {
      "id": "idle-walk-cycle",
      "trigger": {
        "type": "interval",
        "intervalMs": 5000
      },
      "actions": [
        {
          "type": "setState",
          "state": "walk",
          "duration": 3000
        }
      ]
    }
  ]
}
```

## 安全机制

- ✅ Context Isolation 启用
- ✅ Node Integration 禁用
- ✅ 路径遍历防护
- ✅ 符号链接检测
- ✅ 文件大小限制（单个 50MB，导入总计 200MB）
- ✅ ZIP bomb 防护
- ✅ IPC 通道白名单
- ✅ 文件类型白名单

## 配置文件

配置存储在用户数据目录：
- **macOS**: `~/Library/Application Support/Desktop Pet/config.json`
- **Windows**: `%APPDATA%\Desktop Pet\config.json`
- **Linux**: `~/.config/Desktop Pet/config.json`

## 开发指南

### 添加新的 IPC 通道

1. 在 `src/main/ipc.js` 的 `ALLOWED_CHANNELS` 中添加通道名
2. 实现对应的处理逻辑
3. 在预加载脚本中暴露 API
4. 添加单元测试

### 添加新的状态

1. 在素材包的 `manifest.json` 中定义状态
2. 添加对应的资源文件
3. 在规则中使用 `setState` 动作切换

### 调试技巧

```bash
# 启用开发者工具
npm run dev

# 查看日志
# macOS/Linux
tail -f ~/Library/Logs/Desktop\ Pet/main.log

# Windows
type %USERPROFILE%\AppData\Roaming\Desktop Pet\logs\main.log
```

## 测试

项目包含完整的测试套件：
- **117 个单元测试** - 覆盖主进程、渲染进程、共享模块
- **E2E 测试** - Electron 应用启动和基本渲染测试

测试框架：
- Vitest - 单元测试
- Playwright - E2E 测试

## 语言切换

应用支持中文和英文两种语言：

1. 打开控制面板（点击宠物右上角的 `...` 按钮）
2. 进入 **系统** 标签页
3. 在 **语言** 下拉菜单中选择语言
4. 点击 **保存** 按钮
5. 界面将自动切换到所选语言

默认语言：
- 首次启动时，应用会根据系统语言自动选择（中文系统默认中文，其他默认英文）
- 可随时在设置中更改

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

本项目采用 GPL-3.0 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 相关文档

- [产品需求文档](docs/requirements/desktop-client-prd.md)
- [用户手册（中文）](docs/USER_GUIDE.md)
- [发布清单](docs/release/client-release-checklist.md)
- [实施计划](docs/superpowers/plans/)
