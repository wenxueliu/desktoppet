# 动画持续时间修复总结

## 修复的问题

### 问题 1：循环动画会自动停止
**症状**：用户在规则中添加了播放循环动画（loop）的动作，但动画播放一段时间后会自动返回默认动画。

**原因**：`executeRuntimeAction` 在执行 `playAnimation` 动作时，无论动画类型如何，都会调用 `scheduleIdle()` 安排返回默认动画的定时器。

**解决方案**：
1. 在 `buildRuntimeModel` 中导出 `clipById`（动画 ID 到配置的映射）
2. 修改 `executeRuntimeAction` 函数，检查动画类型：
   - **循环动画（loop）**：不调用 `scheduleIdle()`，让动画持续播放
   - **单次动画（oneshot）**：照常调用 `scheduleIdle()`，播放完返回默认动画

### 问题 2：规则动作中不应该设置动画时长
**症状**：用户在创建动画时已经设置了 `durationMs`（对于单次动画），但在规则的 `playAnimation` 动作中又要重复设置持续时间，容易造成混淆。

**原因**：UI 设计不合理，将动画配置和规则配置混淆。

**解决方案**：
1. **单次动画（oneshot）**：
   - 在规则动作编辑器中显示只读的持续时间（禁用的输入框）
   - 提示"持续时间在动画设置中已定义"
   - 保存时从动画配置中读取 `durationMs`，而不是从表单

2. **循环动画（loop）**：
   - 不显示持续时间字段
   - 显示提示："循环动画会持续播放，直到被其他动作停止"

3. **默认动画（default）**：
   - 同循环动画处理，显示循环提示

## 文件变更

### 1. src/renderer/pet/pet-runtime.js
```javascript
// 导出 clipById 用于动画类型检查
export function buildRuntimeModel(...) {
  // ...
  return {
    // ...
    clipById,  // 新增
  };
}

// 检查动画类型，决定是否调用 scheduleIdle
export function executeRuntimeAction(action, effects, clipById) {
  // ...
  case "playAnimation": {
    const animId = action.animation || ...;
    const clip = clipById ? clipById.get(animId) : null;
    const isLoopAnimation = clip && clip.type === "loop";

    effects.playState(animId, action.assetUrl);

    // 只为非循环动画安排返回默认动画
    if (!isLoopAnimation) {
      effects.scheduleIdle(durationMs || 900, action.returnToState);
    }
    return true;
  }
}
```

### 2. src/renderer/pet/pet.js
```javascript
// 传入 clipById
const handled = executeRuntimeAction(action, effects, runtimeModel.clipById);
```

### 3. src/renderer/panel/components/inline-action-editor.js
```javascript
// 根据动画类型显示不同的 UI
if (type === "playAnimation") {
  // 检查选中动画的类型
  const selectedAnim = allClips.find(clip => clip.id === selectedAnimId);
  const isOneshotAnim = selectedAnim && selectedAnim.type === "oneshot";

  // 单次动画：显示只读的持续时间
  if (isOneshotAnim) {
    return `<input type="number" disabled value="${animDuration}">`;
  }
  // 循环动画：显示提示
  else {
    return `<small class="info-hint">循环动画会持续播放...</small>`;
  }
}
```

### 4. src/renderer/panel/handlers/event-handlers.js
```javascript
// 监听动画选择器变化，动态切换 UI
if (event.target.dataset.role === "animation-selector") {
  const animType = selectedOption.dataset.type;
  // 根据类型显示/隐藏不同的提示
  if (animType === "oneshot") {
    // 显示持续时间提示
  } else {
    // 显示循环提示
  }
}
```

### 5. src/renderer/panel/handlers/form-handlers.js
```javascript
// 从动画配置读取持续时间，而不是从表单
function readInlineActionsFromForm(form, config) {
  // ...
  if (type === 'playAnimation') {
    const clip = clipById.get(action.animation);
    // 只为单次动画设置 durationMs
    if (clip && clip.type === "oneshot" && clip.durationMs) {
      action.durationMs = clip.durationMs;
    }
    // 循环动画不设置 durationMs
  }
}
```

### 6. tests/renderer/pet-runtime.test.js
```javascript
// 新增测试：验证循环动画不会自动返回
it("does not schedule idle return for loop animations", () => {
  const clipById = new Map([
    ["loop-anim", { id: "loop-anim", type: "loop" }],
    ["oneshot-anim", { id: "oneshot-anim", type: "oneshot", durationMs: 900 }]
  ]);

  // 循环动画不应该调用 scheduleIdle
  executeRuntimeAction({ type: "playAnimation", animation: "loop-anim" }, effects, clipById);
  expect(effects.scheduleIdle).not.toHaveBeenCalled();

  // 单次动画应该调用 scheduleIdle
  executeRuntimeAction({ type: "playAnimation", animation: "oneshot-anim" }, effects, clipById);
  expect(effects.scheduleIdle).toHaveBeenCalledWith(900, undefined);
});
```

### 7. src/shared/i18n.js
```javascript
// 新增翻译键
"rules.actionParams.durationHint": "持续时间在动画设置中已定义。",
"rules.actionParams.loopHint": "循环动画会持续播放，直到被其他动作停止。",
```

### 8. src/renderer/panel/panel.css
```css
/* 新增信息提示样式 */
.info-hint {
  display: block;
  padding: 8px 10px;
  background: var(--accent-soft);
  border-left: 3px solid var(--accent);
  border-radius: 4px;
  color: var(--text);
  font-size: 12px;
  line-height: 1.4;
}
```

## 用户体验改进

### 之前
1. 用户创建循环动画，持续时间留空
2. 在规则中添加 `playAnimation` 动作，选择循环动画
3. **困惑**：需要填写持续时间吗？填多少？
4. 填写后，动画播放指定时间就停止了 ❌

### 之后
1. 用户创建循环动画，持续时间留空
2. 在规则中添加 `playAnimation` 动作，选择循环动画
3. **清晰**：看到提示"循环动画会持续播放，直到被其他动作停止"
4. 不需要填写持续时间
5. 动画持续循环播放 ✅

## 测试结果

所有 292 个单元测试通过 ✅

## 向后兼容性

- 旧规则中如果为循环动画设置了 `durationMs`，现在会被忽略（正确行为）
- 单次动画的 `durationMs` 现在从动画配置读取，而不是从规则读取
- 如果规则保存时动画配置发生变化，会自动使用最新的持续时间

## 相关问题

用户提到的"休息状态"（idleDuration）规则没有触发的问题，这是另一个独立的问题，需要确保：
1. 规则条件类型设置为 `idleDuration`
2. 在条件的 filter 中设置 `elapsedMs` 字段来指定检查间隔（例如 5000ms）

这个问题可以通过改进 UI 引导来解决，让用户更容易配置定时器类型的条件。
