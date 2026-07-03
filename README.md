# Desktop Pet

一个跨平台的 Electron 桌面宠物客户端，支持导入 `.petpack` 素材包，用动画剪辑和规则引擎配置点击、拖拽、鼠标移动、定时、番茄钟等互动行为。

## 功能特性

- 自定义素材包：导入/导出 `.petpack`，素材保存在本地用户数据目录。
- 动画系统：默认动画 + oneshot / loop / keyframe 动画剪辑，支持 GIF、WebP、WebM、MP4、MOV、PNG、SVG。
- 规则引擎：用条件、过滤器、优先级、冷却、执行策略和退出动作组合行为。
- 全局鼠标互动：支持距离、方向、角度进度、接近/远离等参数，可驱动关键帧动画。
- 控制面板：管理素材、动画、规则、显示、系统、日志和语言。
- 实时生效：面板保存配置后主进程持久化并广播运行时更新，宠物窗口无需重启。
- 安全机制：Context Isolation、路径安全校验、文件大小限制、ZIP bomb 防护、符号链接拒绝。
- 双语界面：中文和英文。

## 快速开始

```bash
npm install
npm run dev
```

常用命令：

```bash
npm test
npm run test:watch
npm run test:e2e
npm run test:e2e:ci
npm run build
npm run pack
npm run dist
```

## 项目结构

```text
desktop-pet/
├── src/
│   ├── main/                 # Electron 主进程、窗口、IPC、托盘、全局鼠标追踪
│   │   ├── main.js
│   │   ├── ipc.js
│   │   ├── windows.js
│   │   ├── global-mouse-tracker.js
│   │   └── services/         # config-store、asset-store、petpack、logger
│   ├── preload/              # contextBridge API
│   ├── renderer/
│   │   ├── pet/              # 宠物窗口、动画、媒体渲染、规则运行时
│   │   └── panel/            # 控制面板模块化 UI
│   └── shared/               # schema、规则引擎、校验、i18n、工具
├── tests/
├── docs/
└── dist/
```

更完整的架构说明见 [docs/architecture/current-architecture.md](docs/architecture/current-architecture.md)。

## Petpack 格式

`.petpack` 是 ZIP 文件，根目录包含 `manifest.json` 和素材文件：

```text
my-pet.petpack
├── manifest.json
└── assets/
    ├── idle.svg
    ├── click.gif
    └── follow.webm
```

当前 manifest 使用 `schemaVersion`、`packageId` 和 `animations`：

```json
{
  "schemaVersion": 1,
  "packageId": "my-pet",
  "name": "My Pet",
  "version": "1.0.0",
  "animations": {
    "default": {
      "id": "11111111-1111-4111-8111-111111111111",
      "name": "Idle",
      "asset": "assets/idle.svg",
      "type": "default"
    },
    "clips": [
      {
        "id": "22222222-2222-4222-8222-222222222222",
        "name": "Click",
        "asset": "assets/click.gif",
        "type": "oneshot",
        "durationMs": 900
      }
    ]
  },
  "triggerRules": [
    {
      "id": "click-greeting",
      "name": "Click greeting",
      "enabled": true,
      "conditions": [
        {
          "type": "click",
          "filters": [{ "field": "isInsidePet", "operator": "=", "value": true }]
        }
      ],
      "priority": 50,
      "cooldownMs": 1000,
      "actions": [
        { "type": "playAnimation", "animation": "22222222-2222-4222-8222-222222222222", "durationMs": 900 },
        { "type": "showMessage", "text": "Hi there!", "durationMs": 1800 }
      ]
    }
  ]
}
```

制作说明见 [docs/USER_GUIDE.md](docs/USER_GUIDE.md)。

## 规则引擎

规则由 `conditions` 和 `actions` 组成。当前支持的条件类型包括：

- 指针：`click`、`doubleClick`、`rightClick`、`mouseEnter`、`mouseLeave`、`mouseMove`、`mouseStill`
- 拖拽：`dragStart`、`dragging`、`dragEnd`
- 时长：`hoverDuration`、`idleDuration`
- 定时：`timer`、`randomTimer`
- 系统：`appLaunch`、`packageLoaded`、`pomodoroComplete`

过滤器支持 `=`、`!=`、`>`、`>=`、`<`、`<=`、`between`、`in`、`notIn`。规则按 `priority` 从高到低执行，默认第一条命中规则会停止继续匹配；把 `stopOnMatch` 设为 `false` 可以让后续命中规则继续追加动作。

当前支持的动作类型包括：

- `blank`
- `playAnimation`
- `setKeyframeProgress`
- `showMessage`
- `randomMessage`
- `changeScale`
- `changeOpacity`
- `movePet`
- `pomodoroTimer`
- `hidePet`
- `showPet`
- `resetPosition`
- `openPanel`

## 控制面板

控制面板由 6 个长期标签页组成：

- Overview：当前包、动画/规则/素材统计、运行时状态和最近事件。
- Assets：导入、替换、删除素材，导入/导出 petpack。
- Animations：配置默认动画和 oneshot / loop / keyframe 剪辑。
- Rules：编辑条件、过滤器、执行动作、退出条件、退出动作和冲突提示。
- Display：缩放、透明度、置顶、穿透、锁定、位置重置。
- System：语言、开机启动、日志设置和日志查看。

模块化细节见 [docs/panel-architecture.md](docs/panel-architecture.md)。

## 安全机制

- Renderer 进程启用 Context Isolation，禁用 Node Integration。
- Preload 只暴露受控 API，IPC handler 返回 `{ ok, error? }` 风格结果。
- Petpack 导入拒绝绝对路径、反斜杠、URL scheme、`.`/`..` 片段和符号链接。
- 单文件最大 50 MB，单包最大 200 MB，ZIP entry 最多 256 个。
- Manifest 校验动画资源引用、条件字段、动作类型和动作到动画的引用。
- 配置写入、包安装、导出均采用临时文件/目录 + 原子替换。

## 配置和日志

配置保存在 Electron `userData` 目录：

- macOS：`~/Library/Application Support/Desktop Pet/config.json`
- Windows：`%APPDATA%\Desktop Pet\config.json`
- Linux：`~/.config/Desktop Pet/config.json`

日志由 `src/main/services/logger.js` 管理，可在控制面板 System 标签页调整级别并查看日志文件。

## 相关文档

- [当前架构](docs/architecture/current-architecture.md)
- [控制面板架构](docs/panel-architecture.md)
- [用户手册](docs/USER_GUIDE.md)
- [产品需求文档](docs/requirements/desktop-client-prd.md)
- [状态型规则设计](docs/stateful-rules-design.md)
- [事件总线历史设计](docs/architecture/event-bus-design.md)
- [发布清单](docs/release/client-release-checklist.md)

## 许可证

本项目采用 GPL-3.0 许可证，详见 [LICENSE](LICENSE)。
