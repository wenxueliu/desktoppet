# 用户手册 - 如何制作桌面宠物包

本指南将帮助你创建自定义桌面宠物包，让你的桌面拥有独一无二的宠物。

## 目录

1. [宠物包结构](#宠物包结构)
2. [创建步骤](#创建步骤)
3. [manifest.json 详解](#manifestjson-详解)
4. [状态和动画](#状态和动画)
5. [规则和行为](#规则和行为)
6. [导入宠物包](#导入宠物包)
7. [常见问题](#常见问题)

## 宠物包结构

宠物包是一个 `.petpack` 文件（实际上是 ZIP 格式），包含以下内容：

```
my-cute-pet.petpack
├── manifest.json          # 必需：清单文件，定义宠物的所有信息
├── idle/                  # 状态目录
│   ├── frame1.gif
│   └── frame2.gif
├── walk/
│   └── walking.webm
├── drag/
│   └── dragging.png
├── click/
│   └── clicked.gif
└── sounds/                # 可选：音效文件
    └── meow.mp3
```

### 支持的文件格式

**图片和视频：**
- `.gif` - 支持动画
- `.webp` - 静态或动画
- `.webm` - 视频动画（推荐）
- `.mp4` / `.mov` - 视频动画
- `.png` - 静态图片
- `.svg` - 矢量图形

**音频：**
- `.mp3`
- `.wav`
- `.ogg`

### 文件限制

- 单个文件最大：50 MB
- 导入总大小：200 MB
- 最多文件数：256 个

## 创建步骤

### 第 1 步：准备素材

1. **设计你的宠物形象** - 可以手绘、使用绘图软件，或从网上找素材（注意版权）
2. **制作动画帧** - 为不同状态创建动画（至少需要 `idle` 状态）
3. **导出为支持的格式** - 推荐使用 `.webm` 或 `.gif`

**推荐尺寸：**
- 小型宠物：64x64 到 128x128 像素
- 中型宠物：128x128 到 256x256 像素
- 大型宠物：256x256 到 512x512 像素

### 第 2 步：组织文件结构

创建一个文件夹，按状态分类存放资源：

```bash
mkdir my-pet
cd my-pet
mkdir idle walk drag click
```

将对应的动画文件放入相应目录。

### 第 3 步：创建 manifest.json

在宠物包根目录创建 `manifest.json`：

```json
{
  "id": "my-cute-cat",
  "name": "我的可爱猫咪",
  "version": "1.0.0",
  "author": "你的名字",
  "description": "一只可爱的橘猫",
  "states": {
    "idle": {
      "assets": ["idle/frame1.gif", "idle/frame2.gif"],
      "frameDuration": 1000,
      "loop": true
    },
    "walk": {
      "assets": ["walk/walking.webm"],
      "loop": true
    },
    "drag": {
      "assets": ["drag/dragging.png"]
    },
    "click": {
      "assets": ["click/clicked.gif"],
      "frameDuration": 100
    }
  }
}
```

### 第 4 步：打包

将所有文件打包为 ZIP，然后重命名为 `.petpack`：

**macOS/Linux:**
```bash
zip -r my-cute-cat.petpack *
```

**Windows:**
```powershell
Compress-Archive -Path * -DestinationPath my-cute-cat.petpack
```

或使用图形界面的压缩软件，创建 ZIP 后改扩展名为 `.petpack`。

## manifest.json 详解

### 基本信息

```json
{
  "id": "unique-pet-id",        // 必需：唯一标识符，建议使用 kebab-case
  "name": "宠物显示名称",         // 必需：显示给用户的名称
  "version": "1.0.0",            // 必需：版本号（语义化版本）
  "author": "作者名",             // 推荐：创作者信息
  "description": "宠物描述",      // 推荐：简短描述
  "homepage": "https://...",     // 可选：项目主页
  "license": "MIT"               // 可选：许可证
}
```

### 状态定义

每个宠物至少需要一个 `idle` 状态。常见状态包括：

- `idle` - 闲置状态（必需）
- `walk` - 行走状态
- `drag` - 被拖拽时
- `click` - 被点击时
- `sleep` - 睡觉
- `play` - 玩耍
- 自定义状态...

```json
{
  "states": {
    "idle": {
      "assets": ["path/to/asset.gif"],     // 资源文件路径（相对于 manifest.json）
      "frameDuration": 1000,                // 每帧持续时间（毫秒）
      "loop": true,                         // 是否循环播放
      "scale": 1.0,                         // 缩放比例（0.1 - 3.0）
      "opacity": 1.0                        // 透明度（0.0 - 1.0）
    }
  }
}
```

**多帧动画示例：**
```json
{
  "idle": {
    "assets": ["idle/1.png", "idle/2.png", "idle/3.png"],
    "frameDuration": 200,
    "loop": true
  }
}
```

## 状态和动画

### 动画类型

1. **序列帧动画** - 多个静态图片按顺序播放
2. **GIF 动画** - 使用 GIF 的内置动画
3. **视频动画** - 使用 WebM/MP4 视频文件（最流畅）

### 动画最佳实践

✅ **推荐：**
- 使用 `.webm` 格式的视频获得最佳性能
- 保持文件大小合理（单个文件 < 5MB）
- 使用透明背景（PNG/WebM/GIF）
- 序列帧数量：3-10 帧为宜

❌ **避免：**
- 过大的文件（影响加载速度）
- 过高的帧率（浪费资源）
- 不必要的高分辨率

## 规则和行为

你可以在 manifest.json 中定义规则，让宠物自动执行动作。

### 基本规则结构

```json
{
  "rules": [
    {
      "id": "idle-to-walk",
      "trigger": {
        "type": "interval",
        "intervalMs": 10000
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

### 触发器类型

#### 1. 定时触发
```json
{
  "trigger": {
    "type": "interval",
    "intervalMs": 5000    // 每 5 秒触发一次
  }
}
```

#### 2. 点击触发
```json
{
  "trigger": {
    "type": "onClick"
  }
}
```

#### 3. 双击触发
```json
{
  "trigger": {
    "type": "onDoubleClick"
  }
}
```

#### 4. 拖拽触发
```json
{
  "trigger": {
    "type": "onDragStart"    // 或 "onDragEnd"
  }
}
```

#### 5. 悬停触发
```json
{
  "trigger": {
    "type": "onHoverEnter",   // 或 "onHoverLeave"
    "durationMs": 2000        // 悬停多久后触发
  }
}
```

### 动作类型

#### 1. 切换状态
```json
{
  "type": "setState",
  "state": "walk",
  "duration": 3000     // 持续 3 秒后返回之前状态
}
```

#### 2. 显示气泡
```json
{
  "type": "showBubble",
  "text": "喵~ 🐱",
  "duration": 2000
}
```

#### 3. 播放音效
```json
{
  "type": "playSound",
  "sound": "sounds/meow.mp3"
}
```

#### 4. 设置透明度
```json
{
  "type": "setOpacity",
  "opacity": 0.5,
  "duration": 1000
}
```

#### 5. 执行系统命令（高级）
```json
{
  "type": "executeCommand",
  "command": "open https://example.com"
}
```

### 完整示例

```json
{
  "id": "interactive-cat",
  "name": "互动猫咪",
  "version": "1.0.0",
  "author": "Your Name",
  "states": {
    "idle": {
      "assets": ["idle.gif"],
      "loop": true
    },
    "walk": {
      "assets": ["walk.webm"],
      "loop": true
    },
    "happy": {
      "assets": ["happy.gif"]
    }
  },
  "rules": [
    {
      "id": "random-walk",
      "trigger": {
        "type": "interval",
        "intervalMs": 10000
      },
      "actions": [
        {
          "type": "setState",
          "state": "walk",
          "duration": 3000
        }
      ]
    },
    {
      "id": "pet-response",
      "trigger": {
        "type": "onClick"
      },
      "actions": [
        {
          "type": "setState",
          "state": "happy",
          "duration": 1000
        },
        {
          "type": "playSound",
          "sound": "sounds/purr.mp3"
        },
        {
          "type": "showBubble",
          "text": "喵~ ❤️",
          "duration": 2000
        }
      ]
    }
  ]
}
```

## 导入宠物包

1. 启动 Desktop Pet 应用
2. 点击宠物右上角的 `...` 按钮
3. 在控制面板中选择 **"素材包"** 标签
4. 点击 **"导入素材包"** 按钮
5. 选择你的 `.petpack` 文件
6. 导入完成后，在 **"外观"** 标签中选择新导入的状态资源

## 常见问题

### Q: 为什么我的宠物包导入失败？

**可能原因：**
1. `manifest.json` 格式错误 - 使用 JSON 验证器检查
2. 文件路径不匹配 - 确保 manifest 中的路径与实际文件路径一致
3. 文件大小超限 - 压缩图片或使用更高效的格式
4. 缺少必需字段 - 至少需要 `id`, `name`, `version`, `states`

### Q: 动画不播放或卡顿？

**解决方法：**
1. 检查 `frameDuration` 设置是否合理
2. 确认 `loop: true` 已设置（如果需要循环）
3. 减小文件大小或降低分辨率
4. 使用 `.webm` 格式替代大尺寸 GIF

### Q: 如何让宠物透明背景？

使用支持透明通道的格式：
- PNG（完全支持）
- GIF（支持，但边缘可能有锯齿）
- WebM（支持，需要 VP8/VP9 编码）

### Q: 可以使用多个宠物包吗？

可以！你可以导入多个宠物包，然后在控制面板中：
1. 为不同状态选择不同宠物包的资源
2. 混合使用多个宠物包的规则
3. 创建自定义规则组合不同素材

### Q: 如何分享我的宠物包？

1. 确保你有素材的使用权限
2. 在 manifest.json 中注明作者和许可证
3. 直接分享 `.petpack` 文件
4. 可以上传到社区平台供他人下载

### Q: 宠物包可以包含脚本吗？

**不可以。** 出于安全考虑，宠物包只能包含静态资源和声明式的规则定义，不能执行任意 JavaScript 代码。

## 技巧和建议

### 制作精美动画

1. **使用参考** - 观察真实动物或其他动画作品
2. **保持一致性** - 风格、尺寸、色调保持统一
3. **添加细节** - 眨眼、尾巴摆动等小动作增加生动感
4. **测试预览** - 导入前在本地预览动画效果

### 优化性能

1. **压缩资源** - 使用工具压缩图片和视频
2. **合理分辨率** - 桌面宠物不需要 4K 分辨率
3. **控制帧数** - 动画帧数 8-15 fps 已足够流畅
4. **避免过大文件** - 单个资源控制在 5MB 以内

### 创意玩法

- 🎨 **主题系列** - 创建节日主题、季节主题宠物
- 🎮 **游戏角色** - 制作你喜欢的游戏角色宠物
- 🐾 **真实宠物** - 用你自己宠物的照片制作专属宠物包
- 🤖 **机器人/科技风** - 像素风、赛博朋克主题
- 📺 **动漫角色** - 二次元人物桌面宠物

## 示例宠物包下载

（未来可以在这里添加社区宠物包链接）

## 获取帮助

- 查看完整技术文档：`docs/requirements/desktop-client-prd.md`
- 提交 Issue：[GitHub Issues](https://github.com/...)
- 社区讨论：[Discord/论坛链接]

---

祝你创作愉快！🎨✨
