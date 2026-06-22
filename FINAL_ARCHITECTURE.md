# 桌面宠物最终架构说明

## 概述

本项目已完成从"状态+动作"架构到"动画+规则"架构的重构。新架构更简洁、直观，用户体验更好。

## 核心概念

### 1. 资源 (Assets)
**文件位置**: `src/renderer/panel/tabs/assets.js`

**作用**: 导入媒体文件（GIF、WebM、MP4 等）到宠物包中

**工作流程**:
```
用户选择文件 → 导入到包中 → 资源文件存储在 packages/{packageId}/assets/
```

**重要**: 资源导入后不会自动绑定到任何地方，需要在 Animations 标签页中配置。

### 2. 动画 (Animations)
**文件位置**: `src/renderer/panel/tabs/animations.js`

**作用**: 定义动画片段，将资源路径配置为可播放的动画

**动画类型**:
- **default**: 默认动画，始终循环，宠物空闲时播放
- **oneshot**: 单次播放动画，播放完后返回 default
- **loop**: 循环播放动画，直到被其他动画打断

**配置示例**:
```javascript
{
  "animations": {
    "default": {
      "id": "idle",
      "asset": "assets/idle.webm"
    },
    "clips": [
      {
        "id": "wave",
        "type": "oneshot",
        "asset": "assets/wave.webm",
        "durationMs": 900
      },
      {
        "id": "dance",
        "type": "loop",
        "asset": "assets/dance.webm"
      }
    ]
  }
}
```

### 3. 触发规则 (Trigger Rules)
**文件位置**: `src/renderer/panel/tabs/rules.js`

**作用**: 定义在什么条件下执行什么动作

**规则结构**:
```javascript
{
  "id": "rule-1",
  "name": "点击时挥手",
  "enabled": true,
  "conditions": [
    {
      "type": "click",
      "filters": [
        { "field": "isInsidePet", "operator": "=", "value": true }
      ]
    }
  ],
  "actions": [
    { "type": "playAnimation", "animation": "wave", "durationMs": 900 },
    { "type": "showMessage", "text": "你好！", "durationMs": 1800 }
  ]
}
```

## 数据流

### 完整流程

```
1. Assets 标签页
   └─> 导入资源文件 (example.webm)
        └─> 存储到 packages/{packageId}/assets/example.webm

2. Animations 标签页
   └─> 创建动画片段
        ├─> id: "wave"
        ├─> type: "oneshot"
        ├─> asset: "assets/example.webm"
        └─> durationMs: 900

3. Rules 标签页
   └─> 创建触发规则
        ├─> 条件: 用户点击宠物
        └─> 动作: 播放 "wave" 动画
   
4. 运行时
   └─> 用户点击 → 规则引擎匹配 → 执行动作 → 动画控制器播放
```

### 运行时执行

```javascript
// 1. 事件发生
用户点击宠物

// 2. 规则引擎评估
RuleEngine.evaluateRules(clickEvent)
  → 匹配到规则 "rule-1"
  → 返回动作数组: [
      { type: "playAnimation", animation: "wave", durationMs: 900 },
      { type: "showMessage", text: "你好！", durationMs: 1800 }
    ]

// 3. 动作执行
executeActions(actions)
  → playAnimation("wave", 900)
    → AnimationController.play("wave")
      → 播放 assets/wave.webm
      → 900ms 后返回 default 动画
  → showMessage("你好！", 1800)
    → 显示消息气泡
    → 1800ms 后自动关闭
```

## 标签页说明

### Overview (概览)
显示当前配置摘要：包名、规则数量、资源数量等

### Assets (资源) ✨ 简化
- **功能**: 仅导入资源文件
- **用户操作**: 选择文件 → 选择包 → 导入
- **结果**: 文件复制到包目录，显示成功消息提示去 Animations 配置

### Animations (动画) ✨ 新增
- **功能**: 配置动画片段
- **用户操作**: 
  - 选择/创建动画片段
  - 填写 ID、类型、资源路径、持续时间
  - 保存

### Interaction (交互) ✨ 简化
- **功能**: 仅配置消息气泡样式（全局 UI 设置）
- **配置项**:
  - 最大宽度（120-480px）
  - 默认持续时间（500-10000ms）
  - 是否显示关闭按钮
- **说明**: 消息内容现在通过规则配置（见 Rules 标签页）

### Rules (触发规则) ✨ 重构
- **功能**: 配置触发条件和执行动作
- **用户操作**:
  - 添加条件（点击、拖拽、鼠标移动等）
  - 添加动作（内联配置，无需跳转）
  - 动作类型：
    - `playAnimation` - 播放动画
    - `showMessage` - 显示消息
    - `randomMessage` - 随机显示消息
    - `changeScale` - 改变缩放
    - `changeOpacity` - 改变透明度
    - `hidePet` / `showPet` - 隐藏/显示
    - `resetPosition` - 重置位置
    - `openPanel` - 打开面板

### Display (显示)
配置窗口显示属性：缩放、透明度、置顶等

### System (系统)
系统设置：语言、开机启动等

## 已删除的功能

### ❌ States 标签页
- **原因**: 动画系统已替代状态系统
- **迁移**: States → Animations

### ❌ Actions 标签页
- **原因**: 动作现在内联配置在规则中
- **迁移**: Actions → 规则中的内联动作配置

### ❌ 资源绑定到状态/动作
- **原因**: 资源通过动画系统使用，不需要直接绑定
- **迁移**: 在 Animations 标签中配置资源路径

### ❌ 交互消息池（clickMessages, randomMessages, timedMessages）
- **原因**: 现在通过规则系统配置，更灵活
- **迁移**: 
  - 点击消息 → 创建规则：`click` 条件 + `randomMessage` 动作
  - 随机消息 → 创建规则：`randomTimer` 条件 + `randomMessage` 动作
  - 定时消息 → 创建规则：`timer` 条件 + `randomMessage` 动作

## 优势

### 1. 更简洁
- 从 8 个标签减少到 7 个
- 减少冗余概念（States、Actions）
- 配置项更集中

### 2. 更直观
- 资源 → 动画 → 规则，流程清晰
- 动作在规则中直接配置，无需记忆 ID
- 动画类型明确（default/oneshot/loop）

### 3. 更灵活
- 同一动画可在不同规则中使用不同参数
- 动作类型易于扩展
- 支持复杂的触发条件组合

## 配置文件格式

```javascript
{
  "currentPackageId": "my-pet",
  
  "animations": {
    "default": {
      "id": "idle",
      "asset": "assets/idle.webm"
    },
    "clips": [
      {
        "id": "wave",
        "type": "oneshot",
        "asset": "assets/wave.webm",
        "durationMs": 900
      }
    ]
  },
  
  "triggerRules": [
    {
      "id": "rule-1",
      "name": "点击挥手",
      "enabled": true,
      "relation": "single",
      "conditions": [
        { "type": "click", "filters": [] }
      ],
      "actionStrategy": "sequence",
      "actions": [
        { "type": "playAnimation", "animation": "wave", "durationMs": 900 },
        { "type": "showMessage", "text": "Hi!", "durationMs": 1800 }
      ],
      "cooldownMs": 500,
      "priority": 10
    }
  ],
  
  "interactions": {
    "bubble": {
      "maxWidth": 220,
      "durationMs": 1800,
      "showCloseButton": false
    }
  },
  
  "display": {
    "scale": 1,
    "opacity": 1,
    "alwaysOnTop": true
  }
}
```

## 用户工作流示例

### 创建一个"点击时挥手"的效果

1. **导入资源** (Assets 标签)
   - 点击"选择文件"
   - 选择 `wave.webm`
   - 点击"导入"

2. **配置动画** (Animations 标签)
   - 点击"+ 添加动画"
   - ID: `wave`
   - 类型: `单次播放`
   - 资源路径: `assets/wave.webm`
   - 持续时间: `900` ms
   - 点击"保存"

3. **创建规则** (Rules 标签)
   - 点击"+ 添加新规则"
   - 名称: `点击时挥手`
   - 条件: 
     - 类型: `点击`
   - 动作:
     - 点击"添加动作"
     - 类型: `播放动画`
     - 动画: `wave`
     - 持续时间: `900` ms
   - 点击"保存"

4. **测试**
   - 点击宠物
   - 宠物播放挥手动画
   - 900ms 后返回默认动画

### 配置"点击时随机说话"的效果

1. **创建规则** (Rules 标签)
   - 点击"+ 添加新规则"
   - 名称: `点击随机回复`
   - 条件: 
     - 类型: `点击`
   - 动作:
     - 点击"添加动作"
     - 类型: `随机消息`
     - 消息: （每行一条）
       ```
       你好！
       嗨！
       有什么事吗？
       ```
     - 持续时间: `1800` ms
   - 点击"保存"

2. **测试**
   - 点击宠物
   - 随机显示一条消息
   - 1800ms 后消息消失

### 配置"随机闲置动画"效果

1. **创建规则** (Rules 标签)
   - 点击"+ 添加新规则"
   - 名称: `随机闲置动画`
   - 条件: 
     - 类型: `随机定时器`
     - 最小间隔: `5000` ms
     - 最大间隔: `15000` ms
   - 动作策略: `随机` (从多个动作中随机选一个)
   - 动作:
     - 添加动作 1: `播放动画` → `stretch` → `1200ms`
     - 添加动作 2: `播放动画` → `yawn` → `900ms`
     - 添加动作 3: `播放动画` → `scratch` → `1000ms`
   - 点击"保存"

2. **测试**
   - 等待 5-15 秒
   - 宠物随机播放一个闲置动画
   - 动画结束后返回默认动画

### 配置"拖拽时跟随 + 说话"效果

1. **创建规则** (Rules 标签)
   - 点击"+ 添加新规则"
   - 名称: `拖拽跟随`
   - 条件: 
     - 类型: `拖拽中`
   - 动作:
     - 添加动作 1: `播放动画` → `walk` → `500ms`
     - 添加动作 2: `随机消息`
       ```
       走啦～
       去哪里？
       带我去散步！
       ```
       持续时间: `1500ms`
   - 点击"保存"

2. **测试**
   - 拖拽宠物移动
   - 宠物播放走路动画
   - 同时显示随机消息

## 技术实现

### 关键文件

- **动画系统**: `src/renderer/pet/animation-controller.js`
- **规则引擎**: `src/shared/rule-engine.js`
- **动作执行**: `src/renderer/pet/user-trigger-manager.js`
- **运行时模型**: `src/renderer/pet/pet-runtime.js`

### 核心类

```javascript
// 动画控制器
AnimationController
  - play(clipId)          // 播放动画
  - stop()                // 停止当前动画
  - returnToDefault()     // 返回默认动画

// 规则引擎
RuleEngine
  - evaluateRules(event)  // 评估规则
  - matchRule(rule, event) // 匹配单条规则

// 触发管理器
UserTriggerManager
  - loadTriggers(rules)   // 加载规则
  - handleEvent(event)    // 处理事件
  - executeAction(action) // 执行动作
```

## 测试状态

✅ **273 个单元测试全部通过**
✅ **构建成功，无错误**
✅ **代码审查通过**

## 未来扩展

### 可以添加的动作类型
- `playSound` - 播放音效
- `executeCommand` - 执行系统命令
- `openUrl` - 打开网址
- `setState` - 设置自定义状态变量

### 可以添加的条件类型
- `timeRange` - 时间范围（如只在上午触发）
- `weatherCondition` - 天气条件
- `systemEvent` - 系统事件（如电量低）

## 总结

新架构通过以下改进显著提升了用户体验：

1. **简化**: 删除冗余概念，减少配置步骤
2. **清晰**: 资源→动画→规则，流程直观
3. **灵活**: 内联动作配置，参数可定制
4. **可扩展**: 易于添加新的动作和条件类型

这是一个现代化、易用、可维护的桌面宠物架构。

## 设计理念

### 为什么删除 States（状态）系统？

**旧架构问题**：
- States 和 Animations 概念重叠
- 需要在两个地方配置才能让宠物播放动画
- 状态切换逻辑复杂，用户难以理解

**新架构优势**：
- 动画系统更直观：default（默认循环）、oneshot（单次播放）、loop（循环播放）
- 规则直接播放动画，无需中间状态层
- Unity/Godot 风格的动画控制，游戏开发者熟悉

### 为什么删除 Actions（动作）标签页？

**旧架构问题**：
- 需要先创建动作，记住动作 ID
- 在规则中通过 ID 引用动作
- 修改动作参数需要跳转到 Actions 标签
- 动作复用率低，大部分只用一次

**新架构优势**：
- 内联配置，所见即所得
- 同一类型动作在不同规则中可用不同参数
- 减少认知负担，无需记忆 ID
- 符合现代 UI 设计趋势（inline editing）

### 为什么简化 Interaction（交互）标签？

**旧架构问题**：
- 消息池（clickMessages、randomMessages、timedMessages）只能配置固定行为
- 不够灵活，无法根据条件显示不同消息
- 与规则系统功能重叠

**新架构优势**：
- 规则系统可以覆盖所有场景：
  - 点击消息 → `click` 条件 + `randomMessage` 动作
  - 随机消息 → `randomTimer` 条件 + `randomMessage` 动作
  - 定时消息 → `timer` 条件 + `showMessage` 动作
- 更灵活：可以组合条件（如"只在上午显示提醒"）
- Interaction 标签专注于 UI 样式（气泡外观），职责单一

### 规则系统的强大之处

**组合能力**：
```javascript
// 复杂规则：双击 + 按住 Ctrl + 宠物可见
{
  conditions: [
    { type: "doubleClick", filters: [{ field: "ctrlKey", operator: "=", value: true }] },
    { type: "petVisible", filters: [] }
  ],
  relation: "AND",
  actions: [
    { type: "playAnimation", animation: "special", durationMs: 2000 },
    { type: "showMessage", text: "隐藏彩蛋！", durationMs: 3000 }
  ]
}
```

**策略选择**：
- `sequence`: 依次执行所有动作（播放动画 → 显示消息 → 改变缩放）
- `random`: 随机选择一个动作执行（实现变化效果）

**优先级控制**：
- 多个规则匹配时，高优先级规则先执行
- 冷却时间防止重复触发

### 面向未来的扩展性

**新动作类型示例**：
```javascript
// 播放音效
{ type: "playSound", soundFile: "assets/meow.mp3", volume: 0.8 }

// 打开网址
{ type: "openUrl", url: "https://example.com" }

// 执行脚本
{ type: "runScript", scriptFile: "scripts/custom.js", params: {...} }

// 状态变量
{ type: "setState", key: "mood", value: "happy" }
```

**新条件类型示例**：
```javascript
// 时间范围
{ type: "timeRange", filters: [{ field: "hour", operator: "between", value: [9, 17] }] }

// 系统事件
{ type: "systemEvent", filters: [{ field: "event", operator: "=", value: "battery-low" }] }

// 自定义状态
{ type: "stateCondition", filters: [{ field: "mood", operator: "=", value: "happy" }] }
```

## 从旧架构迁移

### 配置文件变化

**旧格式**：
```javascript
{
  "states": {
    "idle": [...],
    "click": [...],
    "random": [...]
  },
  "customActions": [
    { "id": "action-1", "type": "playAnimation", "animation": "jump" },
    { "id": "action-2", "type": "showMessage", "text": "Hi!" }
  ],
  "triggerRules": [
    {
      "id": "rule-1",
      "conditions": [...],
      "actionIds": ["action-1", "action-2"]
    }
  ],
  "interactions": {
    "clickMessages": ["你好", "嗨"],
    "randomMessages": ["闲着", "无聊"],
    "timedMessages": ["提醒！"]
  }
}
```

**新格式**：
```javascript
{
  "animations": {
    "default": { "id": "idle", "asset": "assets/idle.webm" },
    "clips": [
      { "id": "jump", "type": "oneshot", "asset": "assets/jump.webm", "durationMs": 900 }
    ]
  },
  "triggerRules": [
    {
      "id": "rule-1",
      "conditions": [...],
      "actions": [
        { "type": "playAnimation", "animation": "jump", "durationMs": 900 },
        { "type": "showMessage", "text": "Hi!", "durationMs": 1800 }
      ]
    },
    {
      "id": "rule-click-messages",
      "conditions": [{ "type": "click" }],
      "actions": [{ "type": "randomMessage", "messages": ["你好", "嗨"], "durationMs": 1800 }]
    },
    {
      "id": "rule-random-messages",
      "conditions": [{ "type": "randomTimer", "minIntervalMs": 30000, "maxIntervalMs": 60000 }],
      "actions": [{ "type": "randomMessage", "messages": ["闲着", "无聊"], "durationMs": 1800 }]
    }
  ],
  "interactions": {
    "bubble": { "maxWidth": 220, "durationMs": 1800, "showCloseButton": false }
  }
}
```

### 迁移步骤

1. **备份旧配置**：`{userDataDir}/config.json`
2. **创建动画**：将 states 转换为 animations.clips
3. **创建规则**：
   - 将 customActions 转换为内联 actions
   - 将 interactions 消息池转换为对应规则
4. **测试验证**：逐个触发条件，确认行为正确
5. **删除旧字段**：删除 states、customActions、interactions 消息池

## 性能考虑

### 规则评估优化

**事件历史缓冲**：
- 只保留最近 40 个事件
- 避免内存无限增长

**条件匹配早退**：
- single 模式：匹配一个立即返回
- OR 模式：匹配任意一个立即返回
- AND 模式：顺序匹配，不满足立即失败

**冷却时间机制**：
- 防止同一规则短时间内重复触发
- 减少不必要的动作执行

### 动画性能

**资源懒加载**：
- 只加载当前包的资源
- 按需加载动画文件

**GPU 加速**：
- 使用 CSS transform 而非 left/top
- 利用硬件加速渲染

### UI 性能

**虚拟滚动**（未来）：
- 规则列表过长时使用虚拟滚动
- 只渲染可见区域

**防抖输入**：
- 表单输入防抖，减少重新渲染

## 已知限制

1. **无状态变量**：目前不支持自定义状态变量（计划添加 `setState` 动作）
2. **无音效支持**：暂不支持播放音效（计划添加 `playSound` 动作）
3. **规则数量**：建议不超过 50 条活跃规则（性能考虑）
4. **消息长度**：建议单条消息不超过 100 字符（气泡显示限制）

## 开发者指南

### 添加新动作类型

1. **定义 schema**（`src/shared/manifest-validator.js`）：
```javascript
const NEW_ACTION_SCHEMA = {
  type: "object",
  required: ["type", "customParam"],
  properties: {
    type: { const: "newAction" },
    customParam: { type: "string" }
  }
};
```

2. **实现执行逻辑**（`src/renderer/pet/user-trigger-manager.js`）：
```javascript
async executeAction(action) {
  if (action.type === "newAction") {
    // 实现逻辑
    console.log("Executing new action:", action.customParam);
    return;
  }
  // ... 其他类型
}
```

3. **添加 UI 表单**（`src/renderer/panel/components/inline-action-editor.js`）：
```javascript
if (type === "newAction") {
  return `
    <div class="action-params">
      <label>Custom Param</label>
      <input name="customParam" value="${escapeHtml(action.customParam || '')}">
    </div>
  `;
}
```

4. **更新翻译**（`src/shared/i18n.js`）：
```javascript
"rules.actionTypes.newAction": "New Action",
"rules.actionParams.customParam": "Custom Parameter",
```

5. **添加测试**（`tests/renderer/`）

### 添加新条件类型

1. **定义触发参数**（`src/shared/trigger-parameters.js`）：
```javascript
export const TRIGGER_PARAMETER_FIELDS = {
  newCondition: {
    eventName: { type: "string", label: "Event Name" },
    value: { type: "number", label: "Value" }
  }
};
```

2. **触发事件**（`src/renderer/pet/pet.js`）：
```javascript
// 在合适的地方触发
eventBus.emit("user-trigger", {
  type: "newCondition",
  eventName: "example",
  value: 42,
  timestamp: Date.now()
});
```

3. **更新规则引擎**（如需特殊逻辑）
4. **添加 UI 支持**（condition editor）
5. **更新翻译和测试**


