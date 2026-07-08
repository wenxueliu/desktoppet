# 动画排队系统设计（不打断正在播放的动画）

日期：2026-07-08
状态：已确认，待实现

## 背景与问题

当前 `AnimationController.playAnimation()` 会**立即**切换动画：它清除任何挂起的定时器并直接换掉当前 clip。因此第二个动画请求会**打断**正在播放的第一个动画，没有任何排队或保护机制。

用户诉求：
- 第一个动画正在播放时，不能被后来的动画打断。
- 第二个动画请求进入"等待区"排队。
- 若第二个还在等待时第三个又来了，则**丢弃第二个**、由第三个顶替。
- 第一个自然播完后，播放等待区里的（最新的）那一个。

即：等待区**只有一个槽位，最新者胜**。

## 已确认的决策

1. **适用范围**：`oneshot` 和 `loop` 都受"不打断 + 排队"保护。
2. **结束判定**：按 `durationMs` 计时判定 oneshot 播完（沿用现有机制）。
3. **loop 切换时机**：按 loop clip 的 `durationMs`（复用现有字段，表示单次循环时长）对齐——有等待项时，等当前循环走到 `durationMs` 边界再切换。
4. **系统驱动的切换**：全部走排队（不设 `force` 逃生口），唯一即时例外见下。
5. **重复动画**：等待项与正在播放的是同一动画时，**忽略**（不重复排队）。
6. **循环时长来源**：复用现有 `durationMs` 字段，不新增字段。创建/编辑 loop clip 时，`durationMs` 沿用面板已有的自动填值逻辑（GIF 通过 `getAssetDurationMs` 探测帧延迟总和；视频可探测；SVG/PNG 或探测失败则留给用户手动填，回退默认值）。用户可随时手动覆盖。

## 架构

改动集中在 `src/renderer/pet/animation-controller.js`，配套小改 `src/renderer/pet/pet.js`。

### 单槽等待区（pending slot）

`AnimationController` 内新增状态：
- `pending`：`{ clipId, options } | null`，最多 1 个待播项。
- loop 周期对齐所需：`loopStartedAt`（loop 开始播放的时间戳）、`loopBoundaryTimer`（到边界切换的定时器）。

### `playAnimation(clipId, options)` 新逻辑

1. clip 不存在 → 警告并返回 false（不变）。
2. 判断当前 active 是否**受保护且未播完**：
   - active 是 `oneshot` 且其 `durationMs` 定时器仍在跑 → 受保护。
   - active 是 `loop` → 受保护（loop 无自然终点）。
3. 若**不受保护**（active 是 `default` / `keyframe`，或 oneshot 已播完）→ 立即播放（走现有渲染路径）。
4. 若**受保护**：
   - 若请求的 `clipId` 与当前 active 相同 → 忽略（记 `animation:pending:ignored-duplicate`）。
   - 否则写入 `pending`（覆盖旧值，若有旧值记 `animation:pending:replaced`）。
   - 若 active 是 `loop` 且有 `durationMs` → 安排 `loopBoundaryTimer` 在下一个循环边界调用 `advanceToPending()`；无 `durationMs` → 立即 `advanceToPending()`。
   - 返回一个标识（如 `{ queued: true }`）。

### `advanceToPending()`（新增私有方法）

active 结束时调用（oneshot 定时器到点、或 loop 边界定时器到点）：
- 若 `pending` 非空 → 取出并播放它（清空 pending）。
- 若 `pending` 为空 → `returnToDefault()`。

### 定时器改造

- **oneshot**：`durationMs` 定时器到点从调用 `returnToDefault()` 改为调用 `advanceToPending()`。
- **loop**：播放 loop 时记录 `loopStartedAt`。有等待项时按
  `remaining = durationMs - ((now - loopStartedAt) % durationMs)`
  安排 `loopBoundaryTimer`。
- 所有新定时器在 `clearClipEndTimer()` / clip 切换 / `destroy()` 时清理。

### keyframe 即时例外

`setKeyframeProgress()` **保持即时**，不进等待区。理由：它由全局鼠标连续 scrub 驱动（实时跟随鼠标角度），是"连续更新"而非"一次离散动画播放"；排队会让宠物对鼠标失去响应。此例外在实现与本 spec 中显式标注。

> 注：`playAnimation` 播放一个 `keyframe` 类型 clip（离散触发）时，按上文规则 3——keyframe 不属于受保护类型，故立即播放；这与 `setKeyframeProgress` 的连续 scrub 是两条独立路径。

## pet.js 集成

- `initializeActionExecutor` 中的 `playAnimation` executor：不再由外部 `scheduleIdle(options.durationMs, ...)` 强制回 idle。改由 controller 在 active 播完后 `advanceToPending()` 决定去向，避免外部定时器与内部排队打架。
- `stopAnimation()` / 规则退出回 default：按"全部走排队"，作为一个待播项进入等待区（而非强制即时）。

## 数据结构变更

**无需新增字段**。loop 的循环时长复用现有的 `durationMs` 字段（对 oneshot 表示总播放时长，对 loop 表示单次循环时长）。

自动填值沿用面板现有逻辑（`getPositiveDurationMs(formClip.durationMs) || getAssetDurationMs(formAsset) || 回退`）：
- **GIF**：`getAssetDurationMs`（`src/main/services/asset-store.js`）已能解析帧延迟总和，作为循环时长的自动默认值。
- **视频**（webm/mp4/mov）：`getAssetDurationMs` 目前仅处理 `.gif`。若希望视频也自动填，可扩展其用 ffprobe（项目已依赖 ffmpeg）读取时长，或在面板用 `<video>.duration` 探测。此为可选增强，非本功能必需。
- **SVG / PNG 或探测失败**：留空，由用户手动填（沿用现有回退默认值）。

`animation-controller.js` 的 `normalizeClip` 已携带 `durationMs`，无需改动字段结构。

## 边界情况

- **等待槽覆盖**：动画2 等待时动画3 来 → 丢弃2、留3，记 `animation:pending:replaced`。
- **重复动画**：等待项与 active 相同 → 忽略，记 `animation:pending:ignored-duplicate`。
- **config 热更新**（`updateConfig`）：若 active 或 pending 的 clip 被删除 → 清空 pending 并安全回 default。
- **loop 无 `durationMs`**：回退为到达时立即切换（不能永久卡住）。
- **destroy**：清理 pending 与所有定时器（含 `loopBoundaryTimer`）。

## 调试日志

沿用现有 `debugRulesLog` / logger 风格，在关键决策点加结构化日志：
- `animation:queue:immediate`（立即播放）
- `animation:queue:pending`（进入等待区）
- `animation:pending:replaced`（覆盖旧等待项）
- `animation:pending:ignored-duplicate`（忽略重复）
- `animation:advance`（active 播完取等待项 / 回 default）
- `animation:loop:boundary-scheduled`（安排 loop 边界切换）

## 测试（扩展 `tests/renderer/animation-controller.test.js`）

- oneshot 播放中来新动画 → 新动画进等待槽、active 不变；`durationMs` 到点后播等待项。
- 等待槽"最新者胜"：连续两个新请求，只播最后一个（第一个被丢弃）。
- oneshot 播放中来相同动画 → 忽略。
- loop + `durationMs`：等待项在循环边界才切换；无 `durationMs` 时立即切换。
- keyframe scrub（`setKeyframeProgress`）不受排队影响，保持即时。
- 等待项 / active 的 clip 被 `updateConfig` 删除 → 清空 pending、安全回 default。
- `destroy` 清理所有定时器。

## 附带清理（已完成）

- 删除 `src/shared/defaults.js` 中 `default-dragging` 规则的死字段 `interruptCurrent: true`（运行时无任何代码读取；其原始语义为事件传播控制，已被 `stopOnMatch` 取代）。

## 非目标（YAGNI）

- 不做多槽队列（等待区固定 1 槽）。
- 不做基于媒体真实 `ended` 事件的结束判定（统一按 `durationMs` 计时）。
- 不引入 `force`/`interrupt` 逃生口。keyframe 的连续 scrub 通过独立方法 `setKeyframeProgress` 保持即时；`playAnimation` 播放非受保护类型（default/keyframe）时本就立即生效，无需额外逃生口。
