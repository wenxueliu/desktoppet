# 状态机规则设计文档

> 目标:支持"距离宠物中心 < 300 且持续 3s 触发动画,条件失效超过 3s 自动回归默认"这类需求。

## 一、为什么现有系统做不到

现有规则引擎是**一次性触发模型**:事件 → 匹配规则 → 执行动作 → 结束。两个缺口:

### 缺口 1:没有"状态持续时长"语义
`and` 关系(`rule-engine.js:135`)做的是**事件序列匹配**——要求 `conditions` 数组里每个 condition 匹配一个**不同的**事件,按顺序在时间窗口内出现。它是为"mouseEnter → click"这种序列设计的。

"距离<300 持续 3s"是**同一状态的保持时长**,不是事件序列。即使写 `and: [mouseMove(distance<300), mouseMove(distance<300)]`,引擎会找两个不同事件各匹配一次 = "窗口内出现过两次距离<300",鼠标中途移出又移回照样命中。

`elapsedMs` 字段只存在于 `hoverDuration`/`idleDuration` 两个**专用计时条件**,且它们计时的是"鼠标在宠物上"/"无交互",不是任意可配字段的持续时长。

### 缺口 2:没有"条件失效自动回归"机制
- 动作里没有"条件失效时执行"的反向动作。`stopAnimation` 只能被另一条规则**显式**触发。
- `scheduleIdle(durationMs)` 是固定延时回 idle,不是"条件失效后才开始计时"。
- oneshot 动画靠 `durationMs` 自动回默认;loop/keyframe 动画会一直停到被别的动作打断。

`lastTriggeredAtByRuleId`(`pet-runtime.js:86`)是唯一的 per-rule 可变状态,且只用于冷却。**没有任何"规则当前是否处于激活态"的状态跟踪。**

## 二、设计方案:状态型规则(stateful rule)

### 2.1 数据结构

在规则对象上新增一个可选字段 `state`(与 `relation` 平级):

```js
{
  id: "near-pet-greeting",
  enabled: true,
  relation: "single",
  conditions: [{
    type: "mouseMove",
    filters: [{ field: "distanceToPetCenter", operator: "<", value: 300 }],
    sustainMs: 3000             // mouseMove 条件连续成立 3s 后触发
  }],
  state: {
    exitAfterMs: 3000,          // 触发后,进入条件持续不成立 3s 后执行 exitActions
    exitActions: [              // 退出时执行(可选,缺省= stopAnimation 回默认)
      { type: "playAnimation", animation: "idle" }
    ]
  },
  actions: [{ type: "playAnimation", animation: "greet" }]
}
```

**兼容性**:`state` 字段缺省时,规则行为与现在完全一致(一次性触发)。旧 manifest/config 不受影响。

### 2.2 规则引擎改动(`rule-engine.js` + `pet-runtime.js`)

#### 进入判定(sustained)
现有 `evaluateRules` 是**无状态**的纯函数(只看 `eventHistory` + `lastTriggeredAtByRuleId`)。sustained 语义需要 per-rule 记录"进入条件已连续成立多久",这是新状态:

`pet-runtime.js` 新增 per-rule 状态表(与 `lastTriggeredAtByRuleId` 并列):
```js
const ruleState = {};  // ruleId -> { conditionTrueSince: number|null, active: boolean, becameInactiveAt: number|null }
```

每次 `evaluateEvent`:
1. 对每条带 `mouseMove` 条件且该条件配置了 `sustainMs > 0` 的规则,判定当前事件是否满足进入条件(`matchesRule` 现有逻辑)。
2. 满足 → 若 `conditionTrueSince` 为 null 则置为 `now`;若 `now - conditionTrueSince >= condition.sustainMs` 且未激活 → 触发 `actions`,置 `active=true`。
3. 不满足 → `conditionTrueSince` 清 null;若已激活,记录 `becameInactiveAt`(若尚未记录)。
4. 已激活且 `becameInactiveAt` 非空且 `now - becameInactiveAt >= exitAfterMs` → 执行 `exitActions`(或缺省 `stopAnimation`),置 `active=false`,清 `becameInactiveAt`。

**注意**:这套逻辑只在有"判定事件"到来时推进。mouseMove 由全局轮询器每 100ms 产生(见下节),足够驱动状态机;纯静止时全局轮询不发事件(`global-mouse-tracker.js:96` 位置不变则 return),需要在退出计时上单独处理(见 2.4)。

#### 退出判定依赖持续轮询
退出"超过 3s"需要即使鼠标静止也能计时。方案:`pet-runtime.js` 内部起一个低频(如 500ms)自检定时器,遍历激活态规则,若 `becameInactiveAt` 已超时则执行退出动作。这是新增的运行时定时器,与 `pet.js` 现有 `scheduleRuntimeEvents` 解耦(运行时层自治,避免 renderer 侧漏判)。

### 2.3 运行时轮询(`pet.js`)

`scheduleRuntimeEvents`(`pet.js:251`)已按 `runtimeHasCondition(type)` 决定是否武装定时器。mouseMove 不在其中——它由两条路径产生:
- 全局轮询器 `global-mouse-tracker.js`(每 100ms,位置不变不发)
- 本地 `sprite.mousemove`(节流 100ms)

对 sustained 规则,这两条已足够驱动进入判定。**无需新增 mouseMove 轮询源**。退出判定的"静止超时"由 2.2 的运行时内部定时器兜底。

### 2.4 面板编辑器改动

| 文件 | 改动 |
|---|---|
| `panel-state.js` `buildRuleFromForm`(`:376-415`) | 读写 `condition.sustainMs` 和 `state.exitAfterMs/exitActions` |
| `rule-condition-editor.js` | 当前**每 condition 只能编一个 filter**(`:57`)。mouseMove 条件高级设置里显示持续成立时间 |
| `tabs/rules.js` `renderRuleEditor`(`:87`) | 当条件包含 mouseMove 时,显示"退出动作"区块;持续时长在 mouseMove 条件卡片内 |
| `i18n.js` en+zh | 新增 `rules.conditionSustainMs.*`、`rules.exitAfterMs.*`、`rules.exitActions.*` 等 |

### 2.5 校验改动

`manifest-validator.js:77-104` `validateCondition` 当前只校验 `type/filters`。新增:
- `mouseMove` 条件的 `sustainMs`(若存在)必须是正数
- `state.exitAfterMs`(若存在)必须是正数
- `state.exitActions` 每个走现有 `validateAction`

### 2.6 与现有冷却/优先级的交互

- sustained 规则触发后置 `active=true`,**冷却不再适用**(激活期间不应被冷却拦截)。在 `isCoolingDown`(`rule-engine.js:89`)前置:`active` 态规则跳过冷却检查。
- 优先级:sustained 规则触发时仍参与 `evaluateRules` 的优先级排序。激活期间,它应"占用"动画通道——其他低优先级规则的动作不应打断它。需在 `pet-runtime.js` 返回动作前判断:若有 sustained 规则处于激活态且当前事件非其退出信号,则压制其他规则的动作。

## 三、实现步骤(建议顺序)

1. **运行时状态机**(`pet-runtime.js`):新增 `ruleState` 表 + 进入/退出判定逻辑 + 内部超时定时器。单测覆盖:持续成立触发、中途失效清零、退出超时回归、激活期间不被冷却拦截。 ✅ 已完成
   - 实现细节:`evaluateRules` 已排除 sustained 规则(避免它们走一次性路径重复触发);新增导出 `eventMatchesRule` 供 runtime 独立判定进入条件;退出动作缺省 `[{type:"stopAnimation"}]`;`exitAfterMs <= 0` 时规则激活后不自动退出(需显式配置);后台 500ms 定时器仅在至少一条 sustained 规则激活时启用,鼠标静止也能推进退出超时。
2. **规则引擎适配**(`rule-engine.js`):`evaluateRules` 暴露 sustained 规则的激活态,让 runtime 能压制冲突规则。单测在 `rule-engine.test.js`。 ✅ 已完成(sustained 规则在 `evaluateRules` 中被排除;runtime 通过 `hasActiveStateful` 压制非 sustained 规则)
3. **校验**(`manifest-validator.js`):`state` 字段校验。单测在 `manifest-validator.test.js`。 ⬜ 待做
4. **面板**(`panel-state.js` + `rule-condition-editor.js` + `tabs/rules.js`):表单读写 + UI。单测在 `panel-state.test.js`/`rules-tab.test.js`。 ✅ 已完成
   - 实现细节:`inline-action-editor.js` 的 `renderInlineActionEditor`/`renderSingleInlineAction` 增加 `scope` 参数("actions"|"exitActions"),行和容器都带 `data-scope`;`rules.js` 在"执行动作"区块后新增同级"退出动作"区块(仅对 mouseMove 条件显示,含 exitAfterMs 输入 + 退出动作列表);`rule-condition-editor.js` 在 mouseMove 条件的高级设置里新增 `condition.sustainMs`;`form-handlers.js` 的 `readInlineActionsFromForm` 按 scope 读取、`readRuleConditionsFromForm` 读取 condition-level sustainMs;`buildRuleFromForm` 把持续时间写入 `condition.sustainMs`,把退出配置写入 `state:{exitAfterMs,exitActions}`;`event-handlers.js` 的 add/remove/action-type/condition-type 切换都按 scope 和 mouseMove 条件显示正确列表;`i18n.js` en+zh 新增 `rules.exitActions(+Hint)`、`rules.conditionSustainMs(+Hint+Placeholder)`、`rules.exitAfterMs(+Hint+Placeholder)`。
5. **i18n**(`i18n.js` en+zh)。 ✅ 已完成(见第 4 步)

## 四、风险与权衡

- **复杂度上升**:规则引擎从无状态变有状态,`evaluateRules` 的纯函数性质被打破。需谨慎保持旧规则路径无副作用。
- **退出动作的语义**:退出时若 `exitActions` 缺省走 `stopAnimation`,会回到 default 动画——与 oneshot 自动回默认行为一致,符合直觉。
- **静止超时兜底定时器**:增加一个常驻 500ms 定时器,开销可忽略,但需确保 interactionsPaused 时暂停。
- **多 sustained 规则互斥**:若两条 sustained 规则同时激活,按优先级取其一,另一条进入判定暂停——需在 runtime 明确语义。

## 五、不在本方案内

- 不扩展"每 condition 多 filter"(当前单 filter 已满足本需求,留作后续)。
- 不改 hoverDuration/idleDuration 的计时字段(它们语义固定,不通用化)。
