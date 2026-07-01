# 事件总线集成指南

## 概述

本文档说明如何将新的事件总线系统集成到现有的 `pet.js` 中，同时保持向后兼容。

## 集成策略

采用**渐进式替换**策略：
1. 在 pet.js 中引入新模块，与旧系统并行运行
2. 逐步迁移事件处理到事件总线
3. 验证功能完整性
4. 最后移除旧的 rule-engine.js

## 步骤 1：引入新模块

```javascript
// pet.js - 在文件顶部添加导入
import { EventBus } from "../../shared/event-bus.js";
import { SystemEventManager } from "./system-event-manager.js";
import { UserTriggerManager } from "./user-trigger-manager.js";
```

## 步骤 2：初始化事件总线系统

```javascript
// pet.js - 在全局变量声明后添加
let eventBus = null;
let systemEventManager = null;
let userTriggerManager = null;

function initializeEventBus() {
  // 创建事件总线
  eventBus = new EventBus();
  
  // 创建系统事件管理器
  systemEventManager = new SystemEventManager(eventBus, {
    showContextMenu: async (event) => {
      if (!window.desktopPet || !window.desktopPet.menu) return;
      try {
        await window.desktopPet.menu.openContextMenu();
      } catch (error) {
        console.error("Failed to open context menu", error);
      }
    },
    
    startWindowDrag: (event) => {
      dragStartedAt = Date.now();
      dragStartPosition = { x: event.screenX || 0, y: event.screenY || 0 };
    },
    
    updateWindowPosition: (event) => {
      // 由 petController 处理实际的窗口移动
    },
    
    endWindowDrag: (event) => {
      dragStartedAt = 0;
      dragStartPosition = null;
    },
    
    openPanel: () => {
      if (window.desktopPet && window.desktopPet.panel) {
        window.desktopPet.panel.show();
      }
    },
    
    onAppLaunch: (event) => {
      console.log('App launched');
    },
    
    onPackageLoaded: (event) => {
      console.log('Package loaded');
    }
  });
  
  // 创建用户触发器管理器
  userTriggerManager = new UserTriggerManager(eventBus, {
    playAnimation: (animId, options) => {
      playState(animId, options.asset);
      if (options.durationMs) {
        scheduleIdle(options.durationMs, options.returnToState || 'idle');
      }
    },
    
    stopAnimation: () => {
      playState('idle');
    },
    
    showMessage: (text, options) => {
      const messages = currentConfig?.interactions?.clickMessages || [];
      const displayText = text || (messages.length > 0 ? messages[Math.floor(Math.random() * messages.length)] : '');
      const duration = options?.durationMs || currentConfig?.interactions?.bubble?.durationMs || 1800;
      showMessage(displayText, duration);
    },
    
    changeDisplay: (action) => {
      if (action.type === 'setVisibility') {
        root.style.visibility = action.visible ? 'visible' : 'hidden';
      } else if (action.scale) {
        applyDisplay({ scale: action.scale });
      } else if (action.opacity) {
        applyDisplay({ opacity: action.opacity });
      }
    },
    
    resetPosition: () => {
      if (!window.desktopPet || !window.desktopPet.pet) return;
      const display = currentConfig?.display || {};
      window.desktopPet.pet.resetPosition({
        x: display.x || 80,
        y: display.y || 160
      });
    },
    
    openPanel: () => {
      if (window.desktopPet && window.desktopPet.panel) {
        window.desktopPet.panel.show();
      }
    }
  });
}
```

## 步骤 3：将 DOM 事件改为发布到事件总线

```javascript
// pet.js - 修改现有的事件监听器

// 旧代码：
sprite.addEventListener("click", handlePetClick);

// 新代码：
sprite.addEventListener("click", (event) => {
  markInteraction();
  if (interactionsPaused) {
    stopPetEvent(event);
    return;
  }
  
  // 发布到事件总线
  eventBus.emit('click', {
    target: event.target,
    screenX: event.screenX,
    screenY: event.screenY,
    timestamp: Date.now(),
    isInsidePet: true
  });
});

// 类似地修改其他事件：
sprite.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  stopPetEvent(event);
  markInteraction();
  
  eventBus.emit('rightClick', {
    target: event.target,
    screenX: event.screenX,
    screenY: event.screenY,
    timestamp: Date.now()
  });
});

sprite.addEventListener("pointerdown", (event) => {
  markInteraction();
  if (interactionsPaused || currentDisplay.locked) {
    return;
  }
  
  eventBus.emit('dragStart', {
    target: event.target,
    screenX: event.screenX,
    screenY: event.screenY,
    timestamp: Date.now()
  });
  
  petController.startDrag(event);
});

// 拖拽中
function handleDragging(event) {
  eventBus.emit('dragging', {
    screenX: event.screenX,
    screenY: event.screenY,
    timestamp: Date.now()
  });
}

// 拖拽结束
function handleDragEnd(event) {
  eventBus.emit('dragEnd', {
    screenX: event.screenX,
    screenY: event.screenY,
    timestamp: Date.now()
  });
  
  petController.endDrag(event);
}
```

## 步骤 4：加载用户触发器

```javascript
// pet.js - 在 applyRuntime() 函数中

function applyRuntime(runtime) {
  currentConfig = runtime && runtime.config ? runtime.config : currentConfig;
  
  // 旧代码：构建 runtimeModel 和 ruleRuntime
  runtimeModel = buildRuntimeModel({
    config: currentConfig || {},
    activePackage: runtime && runtime.package ? runtime.package : null,
    defaultAssets: defaultSpriteAssets
  });
  ruleRuntime = createRuleRuntime({
    rules: runtimeModel.rules,
    actionsById: runtimeModel.actionsById
  });
  
  // 新代码：加载用户触发器到事件总线
  if (userTriggerManager && runtimeModel.rules) {
    userTriggerManager.loadTriggers(runtimeModel.rules);
  }
  
  // 其他现有代码...
  applyDisplay((currentConfig && currentConfig.display) || {});
  applyInteractionConfig((currentConfig && currentConfig.interactions) || {});
  interactionsPaused = Boolean(currentConfig && currentConfig.system && currentConfig.system.interactionsPaused);
  scheduleRuntimeEvents();
}
```

## 步骤 5：初始化流程

```javascript
// pet.js - 在 loadInitialConfig() 中初始化事件总线

async function loadInitialConfig() {
  if (!window.desktopPet) return;

  try {
    // 初始化事件总线系统
    initializeEventBus();
    
    if (window.desktopPet.pet && window.desktopPet.pet.loadRuntime) {
      applyRuntime(await window.desktopPet.pet.loadRuntime());
    } else if (window.desktopPet.config) {
      currentConfig = await window.desktopPet.config.load();

      if (currentConfig.system?.language) {
        setLocale(currentConfig.system.language);
      }

      applyRuntime({ config: currentConfig, package: null });
    }

    document.title = t("pet.title");
    settingsButton.setAttribute("aria-label", t("pet.settings"));

    // 发送生命周期事件
    eventBus.emit('appLaunch', {
      timestamp: Date.now(),
      eventSource: 'petRenderer'
    });
    
    eventBus.emit('packageLoaded', {
      timestamp: Date.now(),
      eventSource: 'petRenderer'
    });
    
    playState("idle");
  } catch (error) {
    console.error("Failed to load pet config", error);
  }
}
```

## 步骤 6：配置格式兼容

新的事件总线系统兼容现有的配置格式：

```javascript
// 现有格式（继续支持）
{
  "triggerRules": [
    {
      "id": "rule-click",
      "enabled": true,
      "relation": "single",
      "conditions": [
        {
          "type": "click",
          "filters": [
            {"field": "isInsidePet", "operator": "=", "value": true}
          ]
        }
      ],
      "actions": ["default-click", "default-random-click-message"],
      "priority": 50,
      "cooldownMs": 1000
    }
  ],
  "customActions": [
    {
      "id": "default-click",
      "type": "playAnimation",
      "state": "click",
      "durationMs": 900,
      "returnToState": "idle"
    }
  ]
}
```

## 步骤 7：测试清单

集成完成后，测试以下功能：

### 系统事件（必须正常工作）
- [ ] 右键点击宠物显示上下文菜单
- [ ] 拖拽宠物移动窗口
- [ ] 点击设置按钮打开控制面板
- [ ] 应用启动事件触发
- [ ] 素材包加载事件触发

### 用户触发器
- [ ] 点击宠物触发动画
- [ ] 点击显示随机消息气泡
- [ ] 拖拽触发拖拽动画
- [ ] 鼠标进入触发悬停动画
- [ ] 定时器触发随机动画
- [ ] AND 条件（如"鼠标进入 AND 点击"）正常工作
- [ ] 冷却时间生效
- [ ] 优先级正确（高优先级规则优先执行）

### 过滤条件
- [ ] 距离过滤（distance > 100）
- [ ] 布尔过滤（isInsidePet = true）
- [ ] 范围过滤（speed between [50, 150]）
- [ ] 集合过滤（hour in [9, 10, 11]）

### 向后兼容
- [ ] 旧的配置文件加载正常
- [ ] 旧的 customActions 格式工作正常
- [ ] 旧的 triggerRules 格式工作正常

## 步骤 8：性能验证

事件总线系统应该**提升性能**：

**旧系统（rule-engine.js）**：
- 每个事件都遍历所有规则
- mouseMove 每 30ms 评估所有规则

**新系统（EventBus）**：
- 按事件类型索引，O(1) 查找相关规则
- mouseMove 只评估监听 mouseMove 的规则

**验证方法**：
```javascript
// 在浏览器控制台中
performance.mark('start');
eventBus.emit('click', {});
performance.mark('end');
performance.measure('event-emit', 'start', 'end');
console.log(performance.getEntriesByName('event-emit')[0].duration);
```

## 步骤 9：清理旧代码（可选）

完成集成和测试后，可以移除：
- `src/shared/rule-engine.js`（被 EventBus 替代）
- `pet.js` 中旧的 `evaluateRuntimeEvent()` 逻辑
- 旧的 `ruleRuntime` 变量

**注意**：建议保留一个版本用于回退，如果发现问题可以快速恢复。

## 故障排除

### 问题：事件不触发
**检查**：
1. `eventBus.emit()` 是否被调用？
2. 触发器是否已加载？`userTriggerManager.getTriggers()`
3. 触发器是否启用？`enabled: true`
4. 条件类型是否匹配？`type: 'click'`

### 问题：系统事件被用户规则阻止
**检查**：
1. 系统事件应该有 `system: true` 标志
2. 系统事件优先级应该最高（priority: 100）
3. 需要阻止传播的系统事件应返回 `true`

### 问题：冷却时间不生效
**检查**：
1. `cooldownMs` 是否设置？
2. 检查 `userTriggerManager.getCooldownStatus(triggerId)`
3. 每次触发后是否正确记录时间？

## 迁移完成标志

当以下条件全部满足时，迁移完成：
- ✅ 所有现有功能正常工作
- ✅ 所有测试通过（244 tests）
- ✅ 性能提升或至少不降低
- ✅ 配置格式向后兼容
- ✅ 文档更新完成
