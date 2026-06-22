# Panel Architecture

## 目录结构

```
src/renderer/panel/
├── panel.js (165行)                    # 主入口：初始化、路由、事件绑定
├── state.js (35行)                     # 全局状态管理
├── panel-state.js (508行)              # 配置 CRUD 和表单构建器
│
├── ui/                                  # UI 工具层
│   ├── banner.js (43行)                # 横幅消息显示
│   ├── header.js (24行)                # 页面头部组件
│   ├── tabs.js (30行)                  # 标签页导航
│   └── utils.js (115行)                # HTML 工具函数
│
├── tabs/                                # 标签页视图层（8个标签页）
│   ├── overview.js (52行)              # 概览仪表板
│   ├── assets.js (208行)               # 资源管理、导入导出
│   ├── states.js (117行)               # 状态绑定编辑器
│   ├── actions.js (117行)              # 自定义动作编辑器
│   ├── interaction.js (86行)           # 交互消息和气泡设置
│   ├── rules.js (173行)                # 触发规则编辑器
│   ├── display.js (68行)               # 显示设置
│   └── system.js (50行)                # 系统设置和语言
│
├── components/                          # 可复用组件层
│   ├── rule-condition-editor.js (101行) # 规则条件编辑器
│   ├── rule-action-selector.js (34行)   # 动作选择器
│   └── condition-browser.js (45行)      # 条件类型浏览器
│
└── handlers/                            # 事件处理层
    ├── form-handlers.js (282行)        # 表单提交处理
    ├── asset-handlers.js (252行)       # 资源和 Petpack 操作
    └── event-handlers.js (230行)       # 点击和变更事件处理
```

## 数据流

```
┌─────────────────────────────────────────────────────────────┐
│                        panel.js                              │
│  - 初始化 DOM 引用                                            │
│  - 加载配置                                                   │
│  - 绑定全局事件监听器                                         │
└────────────────┬────────────────────────────────────────────┘
                 │
    ┌────────────┴────────────┐
    │                         │
    ▼                         ▼
┌─────────┐            ┌──────────────┐
│ state.js│            │ panel-state.js│
│ (状态)  │            │ (配置操作)    │
└────┬────┘            └──────┬───────┘
     │                        │
     │    ┌───────────────────┘
     │    │
     ▼    ▼
┌─────────────────────────────────────────┐
│              render()                    │
│  根据 activeTab 调用对应的标签页渲染器   │
└────────────┬────────────────────────────┘
             │
    ┌────────┴────────┬──────────┬─────────┐
    ▼                 ▼          ▼         ▼
┌─────────┐      ┌─────────┐  ...     ┌─────────┐
│overview │      │ assets  │          │ system  │
│ .js     │      │ .js     │          │ .js     │
└─────────┘      └────┬────┘          └─────────┘
                      │
              ┌───────┴───────┐
              ▼               ▼
        ┌──────────┐    ┌──────────┐
        │components│    │    ui    │
        └──────────┘    └──────────┘
```

## 事件流

```
用户交互
   │
   ├─ 标签切换 ──────────► handleTabClick ──► 更新 state.activeTab ──► render()
   │
   ├─ 表单提交 ──────────► handleFormSubmit ──► form-handlers.js ──► saveConfig() ──► render()
   │
   ├─ 按钮点击 ──────────► handleClickAction ──┬─► event-handlers.js
   │                                          └─► asset-handlers.js
   │
   └─ 输入变更 ──────────► handleChange/handleInput ──► 实时更新 UI
```

## 模块职责

### 核心层 (Core)
- **panel.js**: 应用入口，负责初始化和事件路由
- **state.js**: 全局状态容器
- **panel-state.js**: 配置数据的 CRUD 操作

### 视图层 (View)
- **tabs/*.js**: 各标签页的渲染逻辑，接收 state 和 config，返回 HTML 字符串
- **components/*.js**: 可复用的 UI 组件

### 工具层 (Utility)
- **ui/utils.js**: HTML 转义、属性辅助函数
- **ui/banner.js**: 全局消息提示
- **ui/header.js**: 通用页面头部
- **ui/tabs.js**: 标签导航栏

### 控制层 (Controller)
- **handlers/form-handlers.js**: 处理所有表单提交
- **handlers/asset-handlers.js**: 处理资源相关操作
- **handlers/event-handlers.js**: 处理 UI 交互事件

## 设计模式

### 1. 依赖注入
所有渲染函数和处理器都通过参数接收依赖，不直接访问全局变量：

```javascript
// ✅ Good: 依赖注入
export function renderOverview(config) {
  return `<div>${config.packageId}</div>`;
}

// ❌ Bad: 全局依赖
export function renderOverview() {
  return `<div>${state.config.packageId}</div>`;
}
```

### 2. 单向数据流
数据流向清晰：

```
User Action → Event Handler → Update State → Render → Update DOM
```

### 3. 模块化组合
主文件只负责组装，具体逻辑由各模块实现：

```javascript
// panel.js 中的组装
const views = {
  overview: () => renderOverview(state.config),
  assets: () => renderAssets(state, state.config, states),
  // ...
};
```

## 扩展指南

### 添加新标签页

1. 在 `tabs/` 下创建新文件 `my-tab.js`
2. 实现渲染函数：
   ```javascript
   export function renderMyTab(state, config) {
     return `<div>My Tab Content</div>`;
   }
   ```
3. 在 `panel.js` 中注册：
   ```javascript
   import { renderMyTab } from "./tabs/my-tab.js";
   
   const views = {
     // ...
     myTab: () => renderMyTab(state, state.config)
   };
   ```
4. 在 `ui/tabs.js` 的 TABS 数组中添加标签项

### 添加新组件

1. 在 `components/` 下创建 `my-component.js`
2. 导出渲染函数：
   ```javascript
   export function renderMyComponent(props) {
     return `<div>${props.title}</div>`;
   }
   ```
3. 在需要的标签页中导入使用

### 添加新事件处理

1. 在相应的 handler 文件中添加函数
2. 在 `panel.js` 的事件监听器中调用

## 性能考虑

- **渲染优化**: 每个标签页独立渲染，切换时不需要重新渲染其他标签页
- **事件委托**: 使用根元素的事件监听器，避免为每个按钮单独绑定
- **懒加载潜力**: 未来可以改为动态 import，按需加载标签页代码

## 测试策略

- **单元测试**: 每个渲染函数和处理器都可独立测试
- **集成测试**: 测试 panel.js 的事件路由和状态管理
- **E2E 测试**: 测试完整的用户交互流程
