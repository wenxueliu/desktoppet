# 动画排队系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让正在播放的 oneshot/loop 动画不被后续动画请求打断，改为进入单槽等待区排队（最新者胜），active 播完后再播等待项。

**Architecture:** 在 `AnimationController` 内引入单槽 `pending` 等待区。受保护类型（oneshot 未播完 / loop）的播放请求进入等待区并覆盖旧值；active 结束时（oneshot 的 `durationMs` 定时器到点、或 loop 的循环边界定时器到点）调用 `advanceToPending()` 取出等待项或回默认。keyframe scrub 保持即时。`pet.js` 侧移除会与内部排队打架的外部 `scheduleIdle` 定时器。

**Tech Stack:** JavaScript (ESM renderer), Vitest（含 `vi.useFakeTimers`）。

## Global Constraints

- 复用现有 `durationMs` 字段作为 loop 单次循环时长；不新增字段，不改 schema/validator/面板/i18n。
- 单槽等待区，最新者胜；等待项与 active 相同 → 忽略。
- keyframe 的 `setKeyframeProgress` 连续 scrub 保持即时，不进等待区。
- 系统驱动的切换（stopAnimation / 规则退出回 default）全部走排队。
- loop 无 `durationMs` → 回退为到达时立即切换（不永久卡住）。
- 沿用现有 `logger` / `debugRulesLog` 风格加结构化调试日志。
- 全部改动集中在 `src/renderer/pet/animation-controller.js` 与 `src/renderer/pet/pet.js`；测试在 `tests/renderer/animation-controller.test.js`。
- 运行测试命令：`npm test -- animation-controller`（Vitest 按文件名过滤）。

---

## File Structure

- **Modify:** `src/renderer/pet/animation-controller.js` — 新增 `pending` 状态、`advanceToPending()`、loop 边界定时器、受保护判定；改 `playAnimation` / oneshot 定时器 / `stopAnimation` / `updateConfig` / `destroy`。
- **Modify:** `src/renderer/pet/pet.js` — `playAnimation` executor 移除外部 `scheduleIdle(options.durationMs, ...)`，改由 controller 内部推进。
- **Test:** `tests/renderer/animation-controller.test.js` — 新增排队行为测试；改写依赖旧"立即打断"语义的既有测试。

---

## Task 1: 受保护判定与 oneshot 排队（核心状态机）

**Files:**
- Modify: `src/renderer/pet/animation-controller.js`
- Test: `tests/renderer/animation-controller.test.js`

**Interfaces:**
- Consumes: 既有 `AnimationController` 构造、`clips` Map、`currentClip`、`currentState`、`clearClipEndTimer()`、`returnToDefault()`、`renderer.renderClip`。
- Produces:
  - `playAnimation(clipId, options)` — 返回 `true`（立即播放或成功入队）/ `false`（clip 不存在或空 id）。受保护时入队而非打断。
  - 私有 `_isProtected()` — 返回当前 active 是否为"受保护且未播完"（oneshot 定时器在跑 或 loop）。
  - 私有 `pending` 字段：`{ clipId, options } | null`。
  - 私有 `advanceToPending()` — 取出并播放 pending，或回 default。
  - oneshot 的 `durationMs` 定时器到点 → 调 `advanceToPending()`（替代原 `returnToDefault()`）。

- [ ] **Step 1: 写失败测试 —— oneshot 播放中来新动画进入等待区，不打断**

在 `tests/renderer/animation-controller.test.js` 的 `describe("playAnimation", ...)` 内新增（该 describe 的 `beforeEach` 已配置 `jump` oneshot 500ms、`run` loop）：

```javascript
    it("should queue a new animation while a oneshot is still playing", () => {
      vi.useFakeTimers();

      controller.playAnimation("jump"); // oneshot 500ms
      renderer.renderClip.mockClear();

      // 播放中来第二个动画 -> 进等待区，active 不变
      const result = controller.playAnimation("run");
      expect(result).toBe(true);
      expect(controller.getCurrentClip().id).toBe("jump");
      expect(controller.getCurrentState()).toBe("playing-oneshot");
      expect(renderer.renderClip).not.toHaveBeenCalled();

      // jump 播完 -> 播放等待区的 run
      vi.advanceTimersByTime(500);
      expect(controller.getCurrentClip().id).toBe("run");
      expect(controller.getCurrentState()).toBe("playing-loop");

      vi.useRealTimers();
    });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- animation-controller`
Expected: FAIL —— `run` 会立即打断 `jump`（`getCurrentClip().id` 在入队时已变成 `run`）。

- [ ] **Step 3: 实现受保护判定 + 单槽入队 + advanceToPending**

在 `src/renderer/pet/animation-controller.js` 构造函数末尾（`this.clipEndTimer = null;` 之后）新增字段：

```javascript
    this.pending = null;
    this.loopStartedAt = 0;
    this.loopBoundaryTimer = null;
```

新增私有方法（放在 `clearClipEndTimer()` 附近）：

```javascript
  /**
   * 当前 active 是否受保护（不可被打断）：
   * oneshot 且其结束定时器仍在跑，或任意 loop。
   * @private
   */
  _isProtected() {
    if (this.currentState === 'playing-oneshot') {
      return this.clipEndTimer !== null;
    }
    if (this.currentState === 'playing-loop') {
      return true;
    }
    return false;
  }

  /**
   * active 结束时推进：播放等待项，或回默认。
   * @private
   */
  advanceToPending() {
    const next = this.pending;
    this.pending = null;
    if (next && this.clips.has(next.clipId)) {
      this.logger.debug('animation:advance', { to: next.clipId });
      this._playImmediate(next.clipId, next.options);
    } else {
      this.logger.debug('animation:advance', { to: 'default' });
      this.returnToDefault();
    }
  }
```

将现有 `playAnimation` 拆成"入口"和"立即播放"。把当前 `playAnimation` 方法体（从校验之后的 `this.clearClipEndTimer();` 开始的渲染逻辑）抽到新的私有方法 `_playImmediate`，`playAnimation` 改为分流。完整替换 `playAnimation` 方法为：

```javascript
  /**
   * 请求播放一个动画。若当前 active 受保护，则进入单槽等待区（最新者胜）。
   * @param {string} clipId
   * @param {object} options
   * @returns {boolean} 找到 clip 并已播放或已入队时为 true
   */
  playAnimation(clipId, options = {}) {
    if (!clipId) {
      this.logger.warn('playAnimation: clipId is required');
      return false;
    }
    if (!this.clips.has(clipId)) {
      this.logger.warn(`playAnimation: clip not found: ${clipId}`);
      return false;
    }

    if (this._isProtected()) {
      if (clipId === this.currentClip.id) {
        this.logger.debug('animation:pending:ignored-duplicate', { clipId });
        return true;
      }
      if (this.pending) {
        this.logger.debug('animation:pending:replaced', {
          from: this.pending.clipId,
          to: clipId
        });
      }
      this.pending = { clipId, options };
      this.logger.debug('animation:queue:pending', { clipId });
      return true;
    }

    this.logger.debug('animation:queue:immediate', { clipId });
    return this._playImmediate(clipId, options);
  }

  /**
   * 立即播放一个 clip（跳过排队判定）。
   * @private
   */
  _playImmediate(clipId, options = {}) {
    const clip = this.clips.get(clipId);
    if (!clip) {
      return false;
    }

    this.clearClipEndTimer();

    const playOptions = {
      loop: options.loop !== undefined ? options.loop : clip.loop,
      durationMs: options.durationMs || clip.durationMs
    };
    if (clip.greenScreen) {
      playOptions.greenScreen = clip.greenScreen;
    }

    if (clip.type === 'oneshot') {
      this.currentState = 'playing-oneshot';
    } else if (clip.type === 'loop') {
      this.currentState = 'playing-loop';
    } else if (clip.type === 'keyframe') {
      this.currentState = 'playing-keyframe';
    } else {
      this.currentState = 'default';
    }

    this.currentClip = clip;

    if (clip.type === 'keyframe') {
      this.renderer.renderClip(clip.asset, {
        ...playOptions,
        keyframe: true,
        progress: options.progress || 0,
        clipId
      });
    } else {
      this.renderer.renderClip(clip.asset, playOptions);
    }

    if (clip.type === 'oneshot') {
      const duration = playOptions.durationMs || 1000;
      this.clipEndTimer = setTimeout(() => {
        this.clipEndTimer = null;
        this.advanceToPending();
      }, duration);
    }

    return true;
  }
```

> 注意：oneshot 定时器回调里先把 `this.clipEndTimer = null` 再 `advanceToPending()`，保证推进期间 `_isProtected()` 不再把已结束的 oneshot 判为受保护。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- animation-controller`
Expected: 新测试 PASS。（既有依赖旧语义的测试此时可能 FAIL —— 由 Task 4 统一处理；若本步其它测试变红属预期，记录后继续。）

- [ ] **Step 5: 提交**

```bash
git add src/renderer/pet/animation-controller.js tests/renderer/animation-controller.test.js
git commit -m "feat(animation): queue oneshot playback in a single pending slot instead of interrupting"
```

---

## Task 2: 等待区"最新者胜"与忽略重复

**Files:**
- Modify: `src/renderer/pet/animation-controller.js`（无新代码，验证 Task 1 行为）
- Test: `tests/renderer/animation-controller.test.js`

**Interfaces:**
- Consumes: Task 1 的 `playAnimation` 入队逻辑、`pending` 覆盖、忽略重复。
- Produces: 无新接口，仅锁定行为。

- [ ] **Step 1: 写测试 —— 等待区最新者胜；重复被忽略**

在 `describe("playAnimation", ...)` 内新增两个测试。第一个用一个本地 controller（需要 3 个 clip：1 个 active + 2 个候选，超出该 describe `beforeEach` 提供的 `jump`/`run`）：

```javascript
    it("should replace the pending slot so the newest queued animation wins", () => {
      vi.useFakeTimers();

      const local = new AnimationController(
        {
          default: { id: "idle", asset: "idle.gif" },
          clips: [
            { id: "a", asset: "a.webm", type: "oneshot", durationMs: 500 },
            { id: "b", asset: "b.webm", type: "oneshot", durationMs: 300 },
            { id: "c", asset: "c.webm", type: "loop" }
          ]
        },
        renderer
      );

      local.playAnimation("a"); // active oneshot 500ms
      local.playAnimation("b"); // pending = b
      local.playAnimation("c"); // pending 覆盖为 c

      vi.advanceTimersByTime(500); // a 播完 -> 播 c（不是 b）
      expect(local.getCurrentClip().id).toBe("c");
      expect(local.getCurrentState()).toBe("playing-loop");

      vi.useRealTimers();
    });

    it("should ignore a queued request equal to the currently playing clip", () => {
      vi.useFakeTimers();

      controller.playAnimation("jump"); // active oneshot 500ms
      controller.playAnimation("jump"); // 与 active 相同 -> 忽略，不入队

      // 无 pending：jump 播完后回 default（而非重播 jump）
      vi.advanceTimersByTime(500);
      expect(controller.getCurrentState()).toBe("default");
      expect(controller.getCurrentClip().id).toBe("idle");

      vi.useRealTimers();
    });
```

- [ ] **Step 2: 运行测试确认结果**

Run: `npm test -- animation-controller`
Expected: 这两个测试 PASS（Task 1 已实现覆盖与忽略重复逻辑）。若 FAIL，说明 Task 1 逻辑有缺口，修正 `animation-controller.js` 后再继续。

- [ ] **Step 3: 提交**

```bash
git add tests/renderer/animation-controller.test.js
git commit -m "test(animation): cover latest-wins queue replacement and duplicate-ignore"
```

---

## Task 3: loop 循环边界切换（按 durationMs 对齐）

**Files:**
- Modify: `src/renderer/pet/animation-controller.js`
- Test: `tests/renderer/animation-controller.test.js`

**Interfaces:**
- Consumes: Task 1 的 `pending`、`advanceToPending()`、`_playImmediate()`、新增字段 `loopStartedAt` / `loopBoundaryTimer`。
- Produces:
  - loop 播放时记录 `loopStartedAt = Date.now()`。
  - 当 active 是 loop 且有等待项入队时，安排 `loopBoundaryTimer` 在下一个 `durationMs` 边界调 `advanceToPending()`；loop 无 `durationMs` → 立即 `advanceToPending()`。
  - `clearClipEndTimer()` 一并清理 `loopBoundaryTimer`。

- [ ] **Step 1: 写失败测试 —— loop 在循环边界才切换；无 durationMs 立即切换**

在 `describe("playAnimation", ...)` 内新增：

```javascript
    it("should switch a loop to the pending clip at the next cycle boundary", () => {
      vi.useFakeTimers();

      const local = new AnimationController(
        {
          default: { id: "idle", asset: "idle.gif" },
          clips: [
            { id: "spin", asset: "spin.webm", type: "loop", durationMs: 1000 },
            { id: "hit", asset: "hit.webm", type: "oneshot", durationMs: 200 }
          ]
        },
        renderer
      );

      local.playAnimation("spin"); // loop, cycle 1000ms, loopStartedAt=0
      vi.advanceTimersByTime(300);  // 循环内 300ms

      local.playAnimation("hit");   // 入队；应在 t=1000 边界切换
      expect(local.getCurrentClip().id).toBe("spin"); // 尚未切换

      vi.advanceTimersByTime(699);  // t=999
      expect(local.getCurrentClip().id).toBe("spin"); // 仍是 spin

      vi.advanceTimersByTime(1);    // t=1000 边界
      expect(local.getCurrentClip().id).toBe("hit");
      expect(local.getCurrentState()).toBe("playing-oneshot");

      vi.useRealTimers();
    });

    it("should switch a loop immediately when it has no durationMs", () => {
      const local = new AnimationController(
        {
          default: { id: "idle", asset: "idle.gif" },
          clips: [
            { id: "spin", asset: "spin.webm", type: "loop" }, // 无 durationMs
            { id: "hit", asset: "hit.webm", type: "oneshot", durationMs: 200 }
          ]
        },
        renderer
      );

      local.playAnimation("spin");
      local.playAnimation("hit"); // 无 durationMs -> 立即切换
      expect(local.getCurrentClip().id).toBe("hit");
    });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- animation-controller`
Expected: FAIL —— 第一个测试里 `hit` 入队后无边界定时器，永远不会切换（`spin` 是 loop，Task 1 只入队不推进）。

- [ ] **Step 3: 实现 loop 边界定时器**

在 `_playImmediate` 中，播放 loop 时记录起始时间。将 `_playImmediate` 里设置状态的 loop 分支改为同时记录 `loopStartedAt`。把这段：

```javascript
    } else if (clip.type === 'loop') {
      this.currentState = 'playing-loop';
    } else if (clip.type === 'keyframe') {
```

替换为：

```javascript
    } else if (clip.type === 'loop') {
      this.currentState = 'playing-loop';
      this.loopStartedAt = Date.now();
    } else if (clip.type === 'keyframe') {
```

在 `playAnimation` 的入队分支里，写入 `pending` 之后、`return true` 之前，追加 loop 边界调度。把这段：

```javascript
      this.pending = { clipId, options };
      this.logger.debug('animation:queue:pending', { clipId });
      return true;
```

替换为：

```javascript
      this.pending = { clipId, options };
      this.logger.debug('animation:queue:pending', { clipId });
      this._scheduleLoopBoundary();
      return true;
```

新增私有方法（放在 `advanceToPending()` 附近）：

```javascript
  /**
   * 当 active 为 loop 且有等待项时，在下一个循环边界推进到等待项。
   * loop 无 durationMs -> 立即推进。已安排过则不重复安排。
   * @private
   */
  _scheduleLoopBoundary() {
    if (this.currentState !== 'playing-loop') {
      return;
    }
    if (this.loopBoundaryTimer) {
      return; // 已在等边界
    }
    const cycleMs = this.currentClip && this.currentClip.durationMs;
    if (!cycleMs || cycleMs <= 0) {
      this.advanceToPending();
      return;
    }
    const elapsed = Date.now() - this.loopStartedAt;
    const remaining = cycleMs - (elapsed % cycleMs);
    this.logger.debug('animation:loop:boundary-scheduled', { cycleMs, remaining });
    this.loopBoundaryTimer = setTimeout(() => {
      this.loopBoundaryTimer = null;
      this.advanceToPending();
    }, remaining);
  }
```

在 `clearClipEndTimer()` 里一并清理边界定时器。把：

```javascript
  clearClipEndTimer() {
    if (this.clipEndTimer) {
      clearTimeout(this.clipEndTimer);
      this.clipEndTimer = null;
    }
  }
```

替换为：

```javascript
  clearClipEndTimer() {
    if (this.clipEndTimer) {
      clearTimeout(this.clipEndTimer);
      this.clipEndTimer = null;
    }
    if (this.loopBoundaryTimer) {
      clearTimeout(this.loopBoundaryTimer);
      this.loopBoundaryTimer = null;
    }
  }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- animation-controller`
Expected: 两个新测试 PASS。

- [ ] **Step 5: 提交**

```bash
git add src/renderer/pet/animation-controller.js tests/renderer/animation-controller.test.js
git commit -m "feat(animation): switch looping clips to the queued animation at the cycle boundary"
```

---

## Task 4: stopAnimation 走排队 + updateConfig/destroy 清理 + keyframe 即时验证 + 修订既有测试

**Files:**
- Modify: `src/renderer/pet/animation-controller.js`
- Test: `tests/renderer/animation-controller.test.js`

**Interfaces:**
- Consumes: Task 1–3 的全部。
- Produces:
  - `stopAnimation()` —— 若 active 受保护，则把"回 default"作为等待项入队（loop 走边界、oneshot 等播完）；否则即时回 default。
  - `updateConfig()` —— 若 active 或 pending 的 clip 被删除，清空 `pending` 并安全回 default。
  - `destroy()` —— 清空 `pending` 与所有定时器（含 `loopBoundaryTimer`，已由 `clearClipEndTimer` 覆盖）。
  - `setKeyframeProgress()` —— 保持即时（不入队），并在切换前清空 `pending`。

- [ ] **Step 1: 写失败测试 —— stopAnimation 对 loop 走边界；keyframe 即时；updateConfig 清 pending**

在对应 describe 内新增/修改。首先在 `describe("stopAnimation", ...)` 内新增：

```javascript
    it("should stop a looping clip at its cycle boundary when it has durationMs", () => {
      vi.useFakeTimers();

      const local = new AnimationController(
        {
          default: { id: "idle", asset: "idle.gif" },
          clips: [{ id: "spin", asset: "spin.webm", type: "loop", durationMs: 1000 }]
        },
        renderer
      );

      local.playAnimation("spin");
      vi.advanceTimersByTime(400);

      local.stopAnimation(); // 受保护的 loop -> 边界处回 default
      expect(local.getCurrentClip().id).toBe("spin"); // 尚未停

      vi.advanceTimersByTime(600); // t=1000 边界
      expect(local.getCurrentState()).toBe("default");
      expect(local.getCurrentClip().id).toBe("idle");

      vi.useRealTimers();
    });
```

在 `describe("updateConfig", ...)` 内新增：

```javascript
    it("should clear a pending clip that was removed by updateConfig", () => {
      vi.useFakeTimers();

      const local = new AnimationController(
        {
          default: { id: "idle", asset: "idle.gif" },
          clips: [
            { id: "a", asset: "a.webm", type: "oneshot", durationMs: 500 },
            { id: "b", asset: "b.webm", type: "loop" }
          ]
        },
        renderer
      );

      local.playAnimation("a"); // active oneshot
      local.playAnimation("b"); // pending = b

      // 删除 b（保留 a），pending 应被清空
      local.updateConfig({
        default: { id: "idle", asset: "idle.gif" },
        clips: [{ id: "a", asset: "a.webm", type: "oneshot", durationMs: 500 }]
      });

      vi.advanceTimersByTime(500); // a 播完 -> 无有效 pending -> 回 default
      expect(local.getCurrentState()).toBe("default");
      expect(local.getCurrentClip().id).toBe("idle");

      vi.useRealTimers();
    });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- animation-controller`
Expected: FAIL —— `stopAnimation` 当前对 loop 立即回 default（不走边界）；`updateConfig` 不清 `pending`。

- [ ] **Step 3: 实现 stopAnimation 排队、updateConfig/keyframe 清理**

替换 `stopAnimation()`：

```javascript
  /**
   * 停止当前动画回到默认。受保护的 active 走排队（loop 到边界、oneshot 等播完）。
   */
  stopAnimation() {
    if (this.currentState === 'default') {
      return;
    }
    if (this._isProtected()) {
      this.pending = null; // 回 default 作为空等待项
      this.logger.debug('animation:stop:queued', { from: this.currentClip.id });
      this._scheduleLoopBoundary(); // loop 走边界；oneshot 由其定时器推进
      return;
    }
    this.clearClipEndTimer();
    this.returnToDefault();
  }
```

> oneshot 受保护时，`pending=null` 后其 `clipEndTimer` 到点会调 `advanceToPending()` → 回 default，符合预期。loop 受保护时靠 `_scheduleLoopBoundary()` 在边界回 default。

在 `setKeyframeProgress()` 开头（`this.clearClipEndTimer();` 之后）清空 pending，保证 scrub 即时且不残留等待项。把：

```javascript
    this.clearClipEndTimer();
    this.currentState = 'playing-keyframe';
```

替换为：

```javascript
    this.clearClipEndTimer();
    this.pending = null;
    this.currentState = 'playing-keyframe';
```

在 `updateConfig()` 末尾的"当前 clip 不存在则回 default"逻辑前后，加入 pending 校验。把：

```javascript
    // If current clip no longer exists, return to default
    if (!this.clips.has(this.currentClip.id)) {
      this.returnToDefault();
    }
```

替换为：

```javascript
    // 等待项 clip 已被删除 -> 清空等待区
    if (this.pending && !this.clips.has(this.pending.clipId)) {
      this.logger.debug('animation:pending:cleared-on-config', { clipId: this.pending.clipId });
      this.pending = null;
    }

    // 当前 clip 已被删除 -> 回默认（并清理定时器）
    if (!this.clips.has(this.currentClip.id)) {
      this.clearClipEndTimer();
      this.pending = null;
      this.returnToDefault();
    }
```

在 `destroy()` 里清空 pending。把：

```javascript
  destroy() {
    this.clearClipEndTimer();
    this.clips.clear();
    this.currentClip = null;
    this.currentState = null;
  }
```

替换为：

```javascript
  destroy() {
    this.clearClipEndTimer();
    this.pending = null;
    this.clips.clear();
    this.currentClip = null;
    this.currentState = null;
  }
```

- [ ] **Step 4: 修订依赖旧"立即打断"语义的既有测试**

以下既有测试断言的是旧的即时打断行为，需按队列语义改写。逐个替换：

**(a)** 替换 `"should cancel previous oneshot timer when playing new animation"`（旧：重播同一 oneshot 打断自己）。改为验证同一 oneshot 被忽略重复：

```javascript
    it("should ignore replaying the same oneshot while it is still playing", () => {
      vi.useFakeTimers();

      controller.playAnimation("jump"); // 500ms
      vi.advanceTimersByTime(200);
      controller.playAnimation("jump"); // 同 active -> 忽略，不重置计时

      vi.advanceTimersByTime(300); // 距首次 500ms
      expect(controller.getCurrentState()).toBe("default");

      vi.useRealTimers();
    });
```

**(b)** 替换 `describe("state queries")` 中 `"should report isPlayingOneshot correctly"`：原来靠 `playAnimation("run")` 立即打断 `jump`。改为播完后再切：

```javascript
    it("should report isPlayingOneshot correctly", () => {
      vi.useFakeTimers();
      const local = new AnimationController(
        {
          default: { id: "idle", asset: "idle.gif" },
          clips: [
            { id: "jump", asset: "jump.webm", type: "oneshot", durationMs: 500 },
            { id: "run", asset: "run.webm", type: "loop" }
          ]
        },
        renderer
      );
      expect(local.isPlayingOneshot()).toBe(false);

      local.playAnimation("jump");
      expect(local.isPlayingOneshot()).toBe(true);

      local.stopAnimation();           // 排队回 default
      vi.advanceTimersByTime(500);     // jump 播完 -> default
      local.playAnimation("run");      // 现在可立即播 loop
      expect(local.isPlayingOneshot()).toBe(false);
      vi.useRealTimers();
    });
```

**(c)** 替换 `"should report isPlayingLoop correctly"`：原来靠 `playAnimation("jump")` 立即打断 `run`（loop）。改为对 loop 用 `stopAnimation` 且无 `durationMs`（立即回 default）后再切：

```javascript
    it("should report isPlayingLoop correctly", () => {
      const local = new AnimationController(
        {
          default: { id: "idle", asset: "idle.gif" },
          clips: [
            { id: "jump", asset: "jump.webm", type: "oneshot", durationMs: 500 },
            { id: "run", asset: "run.webm", type: "loop" } // 无 durationMs
          ]
        },
        renderer
      );
      expect(local.isPlayingLoop()).toBe(false);

      local.playAnimation("run");
      expect(local.isPlayingLoop()).toBe(true);

      local.stopAnimation(); // loop 无 durationMs -> 立即回 default
      expect(local.isPlayingLoop()).toBe(false);
    });
```

**(d)** 替换 `describe("integration scenarios")` 的 `"should handle click -> drag -> stop sequence"`（原假设 drag 立即打断 click）。改为队列语义：

```javascript
    it("should queue drag while click plays, then reach default via stop", () => {
      vi.useFakeTimers();

      controller.playAnimation("click"); // oneshot 800ms
      controller.playAnimation("drag");  // 入队（不打断 click）
      expect(controller.getCurrentClip().id).toBe("click");

      vi.advanceTimersByTime(800);       // click 播完 -> drag(loop)
      expect(controller.isPlayingLoop()).toBe(true);

      controller.stopAnimation();        // drag 无 durationMs -> 立即回 default
      expect(controller.getCurrentState()).toBe("default");

      vi.useRealTimers();
    });
```

**(e)** 替换 `"should handle rapid animation switches"`（原假设最后一个立即生效）。改为：active 保护 + 等待区最新者胜：

```javascript
    it("should handle rapid animation switches via the queue (latest wins)", () => {
      vi.useFakeTimers();

      controller.playAnimation("click"); // active oneshot 800ms
      controller.playAnimation("wave");  // pending=wave
      controller.playAnimation("drag");  // pending 覆盖为 drag
      expect(controller.getCurrentClip().id).toBe("click");

      vi.advanceTimersByTime(800);       // click 播完 -> drag
      expect(controller.getCurrentClip().id).toBe("drag");
      expect(controller.isPlayingLoop()).toBe(true);

      vi.useRealTimers();
    });
```

**(f)** 替换 `"should handle oneshot -> oneshot sequence"`（原假设第二个 oneshot 打断第一个）。改为排队：

```javascript
    it("should handle oneshot -> queued oneshot sequence", () => {
      vi.useFakeTimers();

      controller.playAnimation("click"); // 800ms
      controller.playAnimation("wave");  // 入队 1200ms
      expect(controller.getCurrentClip().id).toBe("click");

      vi.advanceTimersByTime(800);       // click 完 -> wave 开始
      expect(controller.getCurrentClip().id).toBe("wave");
      expect(controller.getCurrentState()).toBe("playing-oneshot");

      vi.advanceTimersByTime(1200);      // wave 完 -> default
      expect(controller.getCurrentState()).toBe("default");

      vi.useRealTimers();
    });
```

**(g)** `"should scrub keyframe clips through renderer progress"`（constructor describe 内，line ~77）保持不变即可（keyframe 即时，未受排队影响）。**验证**它仍 PASS。

- [ ] **Step 5: 运行全部动画测试确认通过**

Run: `npm test -- animation-controller`
Expected: 全部 PASS（新旧测试一致按队列语义）。

- [ ] **Step 6: 提交**

```bash
git add src/renderer/pet/animation-controller.js tests/renderer/animation-controller.test.js
git commit -m "feat(animation): route stopAnimation through the queue; clear pending on config/destroy; update tests to queue semantics"
```

---

## Task 5: pet.js 集成 —— 移除与内部排队打架的外部 scheduleIdle

**Files:**
- Modify: `src/renderer/pet/pet.js:872-881`
- Test: 手动 + 既有回归（`npm test`）

**Interfaces:**
- Consumes: 新的 `AnimationController.playAnimation`（内部自行推进回 default/pending）。
- Produces: `playAnimation` executor 不再调用 `scheduleIdle(options.durationMs, ...)`，避免外部定时器强制回 idle 与内部排队冲突。

- [ ] **Step 1: 阅读当前 executor**

Run: `sed -n '872,881p' src/renderer/pet/pet.js`（仅供人工核对；实际改动见下）
当前内容：

```javascript
    playAnimation: (animId, options) => {
      if (animationController && animationController.hasClip(animId)) {
        animationController.playAnimation(animId, options);
        if (options.durationMs) {
          scheduleIdle(options.durationMs, options.returnToState || "idle");
        }
      } else {
        debugRulesLog("action:playAnimation:missingClip", { animId });
      }
    },
```

- [ ] **Step 2: 移除外部 scheduleIdle，交由 controller 内部推进**

将上述块替换为：

```javascript
    playAnimation: (animId, options) => {
      if (animationController && animationController.hasClip(animId)) {
        // 由 AnimationController 内部排队/定时推进决定何时回默认，
        // 不再用外部 scheduleIdle 强制回 idle（会与队列打架）。
        animationController.playAnimation(animId, options);
        debugRulesLog("action:playAnimation:queued", {
          animId,
          durationMs: options.durationMs
        });
      } else {
        debugRulesLog("action:playAnimation:missingClip", { animId });
      }
    },
```

- [ ] **Step 3: 运行完整测试套件确认无回归**

Run: `npm test`
Expected: 全绿。若 `pet.js` 相关测试引用了旧的 `scheduleIdle` 行为，按队列语义修正（预期无：`scheduleIdle` 仍被其它路径使用，函数本身保留）。

- [ ] **Step 4: 确认 scheduleIdle 仍被其它调用者使用（避免留下未使用符号）**

Run: `grep -n "scheduleIdle" src/renderer/pet/pet.js`
Expected: 仍有定义（`function scheduleIdle`）与导出/其它调用；`playAnimation` executor 内已无调用。若 grep 显示 `scheduleIdle` 已完全无调用者，则从导出与定义处一并移除并说明；否则保留。

- [ ] **Step 5: 提交**

```bash
git add src/renderer/pet/pet.js
git commit -m "feat(pet): let AnimationController own return-to-default instead of external scheduleIdle"
```

---

## Task 6: 端到端验证与文档回填

**Files:**
- Modify: 无代码；可选更新 spec 状态。
- Test: `npm test`、`npm run dev` 手动验证。

- [ ] **Step 1: 运行全部单元测试**

Run: `npm test`
Expected: 全绿。

- [ ] **Step 2: 用 verify 技能驱动真实应用手动验证**

启动 `npm run dev`，构造场景：
1. 触发一个较长的 oneshot（如点击动画），在其播放中再触发另一个动画 → 观察第一个不被打断、第二个在其后播放。
2. 播放中连续触发两个不同动画 → 只有最后一个在 active 播完后播放。
3. 拖拽（loop）过程中触发点击动画 → loop 在其循环边界后切换到点击动画（若拖拽 clip 配了 `durationMs`）。

记录观察结果。

- [ ] **Step 3: 更新 spec 状态为已实现**

编辑 `docs/superpowers/specs/2026-07-08-animation-queue-design.md` 顶部 `状态：已确认，待实现` → `状态：已实现`。

```bash
git add docs/superpowers/specs/2026-07-08-animation-queue-design.md
git commit -m "docs: mark animation queue spec as implemented"
```

---

## Self-Review

**Spec coverage:**
- 单槽等待区 / 最新者胜 → Task 1、2 ✓
- oneshot 按 durationMs 播完切换 → Task 1 ✓
- loop 按 durationMs 对齐循环边界切换、无 durationMs 立即切 → Task 3 ✓
- keyframe scrub 即时例外 → Task 4 Step 3（清 pending）+ Step 4(g) 验证 ✓
- 系统切换（stopAnimation/规则退出回 default）走排队 → Task 4 ✓
- 忽略重复动画 → Task 1 + Task 2 ✓
- config 热更新删除 clip → 清 pending、安全回 default → Task 4 ✓
- destroy 清理 → Task 4 ✓
- 调试日志 → Task 1/3/4 各 `logger.debug` ✓
- pet.js 移除外部 scheduleIdle → Task 5 ✓
- 复用 durationMs、不新增字段 → 全程未改 schema/面板/i18n ✓
- 死字段 interruptCurrent 已在 spec 阶段清理（已提交）✓

**Placeholder scan:** 无 TBD/TODO；所有代码步骤含完整代码块。Task 2 Step 1 含"草稿→替换为最终 it"的说明，最终测试代码完整自洽。

**Type consistency:** `_isProtected()`、`advanceToPending()`、`_playImmediate()`、`_scheduleLoopBoundary()`、`pending`、`loopStartedAt`、`loopBoundaryTimer` 命名在 Task 1/3/4 间一致；`playAnimation` 返回 `boolean` 一致；`clearClipEndTimer()` 扩展后覆盖两个定时器，被 `_playImmediate`/`stopAnimation`/`updateConfig`/`destroy` 复用一致。
