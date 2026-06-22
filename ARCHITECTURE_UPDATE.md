# 架构更新：内联动作配置

## 概述

本次更新将触发规则系统从"引用式动作配置"重构为"内联动作配置"，简化了架构并提升了用户体验。

## 主要变化

### 1. 删除的功能

- ❌ **Actions 标签页** (`src/renderer/panel/tabs/actions.js`) - 完全移除
- ❌ **customActions 配置** - 不再需要单独的动作列表
- ❌ **动作 ID 引用** - 规则不再通过 ID 引用动作
- ❌ **Assets 中的自定义动作绑定** - 资源只能绑定到状态（idle/click/drag）

### 2. 新增的功能

✅ **内联动作编辑器** (`src/renderer/panel/components/inline-action-editor.js`)
- 支持 9 种动作类型的动态表单
- 实时切换动作类型时重建参数区域
- 添加/删除动作功能

✅ **randomMessage 动作类型**
- 从消息数组中随机选择一条显示
- 格式：`{ type: "randomMessage", messages: ["msg1", "msg2"], durationMs: 1800 }`

### 3. 支持的动作类型

| 动作类型 | 参数 | 说明 |
|---------|------|------|
| `playAnimation` | `animation`, `durationMs` | 播放指定动画 |
| `showMessage` | `text`, `durationMs` | 显示固定消息 |
| `randomMessage` | `messages[]`, `durationMs` | 随机显示一条消息 |
| `changeScale` | `scale` | 改变缩放 (0.25-4) |
| `changeOpacity` | `opacity` | 改变透明度 (0-1) |
| `hidePet` | - | 隐藏宠物 |
| `showPet` | - | 显示宠物 |
| `resetPosition` | - | 重置位置 |
| `openPanel` | - | 打开面板 |

## 数据格式变化

### 旧格式（已废弃）

```javascript
// 配置文件
{
  customActions: [
    { id: "wave", type: "playAnimation", animation: "wave", durationMs: 900 }
  ],
  triggerRules: [
    {
      id: "rule-1",
      conditions: [...],
      actions: ["wave"]  // 引用动作 ID
    }
  ]
}
```

### 新格式

```javascript
// 配置文件
{
  triggerRules: [
    {
      id: "rule-1",
      conditions: [...],
      actions: [
        { type: "playAnimation", animation: "wave", durationMs: 900 }  // 内联动作对象
      ]
    }
  ]
}
```

## 受影响的文件

### 新建文件
- `src/renderer/panel/components/inline-action-editor.js` - 内联动作编辑器组件

### 主要修改
- `src/renderer/panel/tabs/rules.js` - 使用内联动作编辑器
- `src/renderer/panel/tabs/assets.js` - 删除自定义动作绑定
- `src/renderer/panel/handlers/form-handlers.js` - 处理内联动作表单
- `src/renderer/panel/handlers/asset-handlers.js` - 简化资源绑定
- `src/renderer/panel/handlers/event-handlers.js` - 添加内联动作事件处理
- `src/renderer/panel/panel-state.js` - 删除动作相关函数
- `src/renderer/panel/panel.js` - 删除 getActions 和 actions 视图
- `src/renderer/panel/ui/tabs.js` - 从标签列表移除 actions
- `src/renderer/pet/pet-runtime.js` - 简化运行时模型
- `src/shared/i18n.js` - 更新翻译

### 删除文件
- `src/renderer/panel/tabs/actions.js` - Actions 标签页

### 测试更新
- `tests/renderer/panel-state.test.js` - 删除动作测试，更新规则测试
- `tests/renderer/pet-runtime.test.js` - 更新运行时测试

## 迁移指南

### 对于用户

⚠️ **不兼容变更**：旧配置文件无法直接使用，需要手动迁移。

#### 迁移步骤：

1. **导出旧规则**：记录触发规则中引用的动作 ID
2. **找到对应动作**：在 Actions 标签中查看每个 ID 对应的动作配置
3. **重建规则**：
   - 在 Rules 标签中编辑规则
   - 点击"添加动作"
   - 选择动作类型并填写参数
   - 保存规则

#### 示例：

**旧配置（Actions 标签）：**
```
ID: wave
Type: playAnimation
Animation: wave
Duration: 900ms
```

**旧规则（Rules 标签）：**
```
Actions: [wave]
```

**新规则（Rules 标签）：**
```
Actions:
  1. [播放动画 ▾]
     动画: [wave ▾]
     持续时间: [900] ms
```

### 对于开发者

#### 读取规则动作

```javascript
// 旧代码
const actionIds = rule.actions;  // ["wave", "jump"]
const actions = actionIds.map(id => actionsById[id]);

// 新代码
const actions = rule.actions;  // [{ type: "playAnimation", animation: "wave" }, ...]
```

#### 创建规则

```javascript
// 旧代码
const rule = {
  id: "rule-1",
  conditions: [...],
  actions: ["wave", "jump"]
};

// 新代码
const rule = {
  id: "rule-1",
  conditions: [...],
  actions: [
    { type: "playAnimation", animation: "wave", durationMs: 900 },
    { type: "showMessage", text: "Hello!", durationMs: 1800 }
  ]
};
```

## 架构优势

### 简化性
- ✅ 减少一个标签页（从 8 个减少到 7 个）
- ✅ 消除 ID 引用，无需在两个地方配置
- ✅ 减少配置文件复杂度

### 直观性
- ✅ 用户在规则中直接看到动作配置
- ✅ 无需记住动作 ID
- ✅ 无需在标签间切换

### 灵活性
- ✅ 同一动作可在多个规则中使用不同参数
- ✅ 支持更多动作类型
- ✅ 易于扩展新动作类型

## 测试状态

✅ **所有测试通过**: 273 个单元测试
✅ **构建成功**: Vite 构建无错误
✅ **类型正确**: 无语法错误

## 后续工作

1. **文档更新**：更新用户手册，说明新的规则配置方式
2. **迁移工具**：可选：创建配置文件迁移脚本
3. **UI 优化**：改进内联动作编辑器的用户体验
4. **性能测试**：验证大量规则时的性能表现

## 参考

- Plan 文档: `.claude/plans/tidy-wiggling-cookie.md`
- 原始需求: "整合触发规则可以播放动画，也可以同时显示消息"
- 完成日期: 2026-06-22
