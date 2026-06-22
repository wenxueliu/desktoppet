/**
 * Internationalization (i18n) system for Desktop Pet
 */

const translations = {
  en: {
    // Common
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.add": "Add",
    "common.remove": "Remove",
    "common.edit": "Edit",
    "common.import": "Import",
    "common.export": "Export",
    "common.close": "Close",
    "common.ok": "OK",
    "common.yes": "Yes",
    "common.no": "No",
    "common.loading": "Loading...",
    "common.saving": "Saving...",
    "common.importing": "Importing...",
    "common.exporting": "Exporting...",
    "common.success": "Success",
    "common.error": "Error",
    "common.warning": "Warning",

    // Pet window
    "pet.settings": "Open settings",
    "pet.title": "Desktop Pet",

    // Panel tabs
    "panel.title": "Desktop Pet Control Panel",
    "panel.tabs.overview": "Overview",
    "panel.tabs.assets": "Assets",
    "panel.tabs.states": "States",
    "panel.tabs.actions": "Actions",
    "panel.tabs.interaction": "Interaction",
    "panel.tabs.rules": "Trigger Rules",
    "panel.tabs.display": "Display",
    "panel.tabs.system": "System",

    // Overview tab
    "overview.title": "Overview",
    "overview.description": "Current package, state bindings, custom actions, trigger rules, assets, and display state.",
    "overview.package": "Package",
    "overview.states": "States",
    "overview.actions": "Actions",
    "overview.rules": "Rules",
    "overview.assets": "Assets",
    "overview.display": "Display",
    "overview.system": "System",
    "overview.systemLogin": "Login",
    "overview.systemManual": "Manual",
    "overview.activeDisplay": "Active Display Settings",
    "overview.opacity": "Opacity",
    "overview.alwaysOnTop": "Always on top",
    "overview.mousePassthrough": "Mouse passthrough",
    "overview.enabled": "Enabled",
    "overview.disabled": "Disabled",

    // Assets tab
    "assets.title": "Assets",
    "assets.description": "Import supported media and bind it to a state or custom action.",
    "assets.import.title": "Asset Import",
    "assets.import.chooseFile": "Choose file",
    "assets.import.selectedFile": "Selected file",
    "assets.import.noFileSelected": "No file selected.",
    "assets.import.package": "Package",
    "assets.import.bindTo": "Bind to",
    "assets.import.customAction": "Custom action",
    "assets.import.noCustomActions": "No custom actions",
    "assets.import.bindingHint": "Only required when binding to a custom action.",
    "assets.import.button": "Import and bind",
    "assets.import.success": "Imported {asset}.",
    "assets.import.error": "Import failed.",
    "assets.petpack.title": "Petpack",
    "assets.petpack.import": "Import petpack",
    "assets.petpack.export": "Export petpack",
    "assets.petpack.currentPackage": "Current package:",
    "assets.petpack.importSuccess": "Imported {packageId}.",
    "assets.petpack.exportSuccess": "Exported {packageId} to {targetPath}.",
    "assets.referenced.title": "Referenced Assets",
    "assets.referenced.count": "{count} asset",
    "assets.referenced.countPlural": "{count} assets",
    "assets.referenced.empty": "No state or action assets are referenced yet.",
    "assets.referenced.preview": "Preview",
    "assets.list.title": "Imported Assets",
    "assets.list.usedIn": "Used in:",
    "assets.list.notUsed": "Not used",
    "assets.list.confirmDelete": "Delete this asset? It will be removed from all states and actions.",
    "assets.bindTarget.custom": "Custom action",
    "assets.bindTarget.idle": "Idle state",
    "assets.bindTarget.click": "Click state",
    "assets.bindTarget.drag": "Drag state",

    // States tab
    "states.title": "States",
    "states.description": "Configure animation states for your pet.",
    "states.addNew": "Add new state",
    "states.builtIn": "Built-in States",
    "states.available": "available",
    "states.editBinding": "Edit State Binding",
    "states.createBinding": "Create State Binding",
    "states.bindingId": "Binding ID",
    "states.displayName": "Display name",
    "states.assetPath": "Asset path",
    "states.weight": "Weight",
    "states.duration": "Duration ms",
    "states.returnToState": "Return to state",
    "states.message": "Message",
    "states.form.id": "State ID",
    "states.form.assets": "Assets",
    "states.form.frameDuration": "Frame duration (ms)",
    "states.form.loop": "Loop",
    "states.form.scale": "Scale",
    "states.form.opacity": "Opacity",
    "states.noAssets": "No assets",
    "states.empty": "No custom states defined yet.",
    "states.confirmDelete": "Delete this state? It may break rules that reference it.",

    // Actions tab
    "actions.title": "Actions",
    "actions.description": "Define custom actions that can be triggered by rules.",
    "actions.addNew": "Add new action",
    "actions.customActions": "Custom Actions",
    "actions.saved": "saved",
    "actions.editAction": "Edit Action",
    "actions.createAction": "Create Action",
    "actions.untitled": "Untitled action",
    "actions.edit": "Edit",
    "actions.form.id": "Action ID",
    "actions.form.label": "Label",
    "actions.form.name": "Name",
    "actions.form.type": "Type",
    "actions.form.state": "State",
    "actions.form.duration": "Duration (ms)",
    "actions.form.sound": "Sound",
    "actions.form.text": "Text",
    "actions.form.opacity": "Opacity",
    "actions.form.command": "Command",
    "actions.form.asset": "Asset",
    "actions.form.assetPath": "Asset path",
    "actions.form.returnToState": "Return to state",
    "actions.form.weight": "Weight",
    "actions.form.message": "Message",
    "actions.empty": "No custom actions defined yet.",
    "actions.confirmDelete": "Delete this action? It may break rules that use it.",
    "actions.types.setState": "Set state",
    "actions.types.playSound": "Play sound",
    "actions.types.showBubble": "Show bubble",
    "actions.types.setOpacity": "Set opacity",
    "actions.types.executeCommand": "Execute command",

    // Interaction tab
    "interaction.title": "Interaction",
    "interaction.description": "Configure how the pet responds to user interactions.",
    "interaction.messagesAndBubble": "Messages and Bubble",
    "interaction.clickMessage": "Click messages",
    "interaction.randomIdleMessages": "Random idle messages",
    "interaction.timedReminderMessages": "Timed reminder messages",
    "interaction.doubleClickMessage": "Double-click message",
    "interaction.dragStartMessage": "Drag start message",
    "interaction.dragEndMessage": "Drag end message",
    "interaction.hoverMessage": "Hover message",
    "interaction.importSuccessMessage": "Import success message",
    "interaction.bubbleSettings": "Bubble Settings",
    "interaction.bubbleMaxWidth": "Bubble max width",
    "interaction.bubbleDuration": "Bubble duration ms",
    "interaction.maxWidth": "Max width (px)",
    "interaction.duration": "Duration (ms)",
    "interaction.showCloseButton": "Show close button",
    "interaction.showBubbleCloseButton": "Show bubble close button",

    // Rules tab - Condition types
    "rules.conditionTypes.click": "Click",
    "rules.conditionTypes.doubleClick": "Double click",
    "rules.conditionTypes.rightClick": "Right click",
    "rules.conditionTypes.dragStart": "Drag start",
    "rules.conditionTypes.dragging": "Dragging",
    "rules.conditionTypes.dragEnd": "Drag end",
    "rules.conditionTypes.mouseEnter": "Mouse enter",
    "rules.conditionTypes.mouseLeave": "Mouse leave",
    "rules.conditionTypes.mouseMove": "Mouse move",
    "rules.conditionTypes.hoverDuration": "Hover duration",
    "rules.conditionTypes.idleDuration": "Idle duration",
    "rules.conditionTypes.timer": "Timer",
    "rules.conditionTypes.randomTimer": "Random timer",
    "rules.conditionTypes.appLaunch": "App launch",
    "rules.conditionTypes.packageLoaded": "Package loaded",
    "rules.title": "Trigger Rules",
    "rules.description": "Define rules that trigger actions based on events.",
    "rules.addNew": "Add new rule",
    "rules.savedRules": "Saved Rules",
    "rules.saved": "saved",
    "rules.editRule": "Edit Rule",
    "rules.createRule": "Create Rule",
    "rules.edit": "Edit",
    "rules.conditionBrowser": "Built-in Condition Browser",
    "rules.noActionsWarning": "Create a custom action before saving a rule.",
    "rules.andWindowMs": "AND window ms",
    "rules.actionStrategy": "Action strategy",
    "rules.sequence": "sequence",
    "rules.random": "random",
    "rules.conditionType": "Condition type",
    "rules.filterField": "Filter field",
    "rules.noFilter": "No filter",
    "rules.operator": "Operator",
    "rules.filterValue": "Filter value",
    "rules.filterValueHint": "Use comma-separated values for between, in, and notIn.",
    "rules.unit": "Unit",
    "rules.remove": "Remove",
    "rules.browserField": "Field",
    "rules.browserExpectedInput": "Expected input",
    "rules.form.id": "Rule ID",
    "rules.form.label": "Label",
    "rules.form.name": "Name",
    "rules.form.enabled": "Enabled",
    "rules.form.trigger": "Trigger",
    "rules.form.conditions": "Conditions",
    "rules.form.actions": "Actions",
    "rules.form.relation": "Relation",
    "rules.form.priority": "Priority",
    "rules.form.cooldown": "Cooldown (ms)",
    "rules.form.addCondition": "Add condition",
    "rules.form.addAction": "Add action",
    "rules.form.removeCondition": "Remove",
    "rules.form.removeAction": "Remove",
    "rules.form.selectActions": "Select actions",
    "rules.form.conditionType": "Condition type",
    "rules.form.field": "Field",
    "rules.form.operator": "Operator",
    "rules.form.value": "Value",
    "rules.empty": "No trigger rules defined yet.",
    "rules.confirmDelete": "Delete this rule?",
    "rules.triggers.interval": "Interval",
    "rules.triggers.onClick": "On click",
    "rules.triggers.onDoubleClick": "On double click",
    "rules.triggers.onDragStart": "On drag start",
    "rules.triggers.onDragEnd": "On drag end",
    "rules.triggers.onHoverEnter": "On hover enter",
    "rules.triggers.onHoverLeave": "On hover leave",
    "rules.triggers.onMouseMove": "On mouse move",
    "rules.relations.single": "Single",
    "rules.relations.and": "AND",
    "rules.relations.or": "OR",

    // Display tab
    "display.title": "Display",
    "display.description": "Configure display settings for the pet window.",
    "display.settings.title": "Display Settings",
    "display.scale": "Scale",
    "display.opacity": "Opacity",
    "display.alwaysOnTop": "Always on top",
    "display.clickThrough": "Click through",
    "display.mousePassthrough": "Mouse passthrough",
    "display.resetPosition": "Reset position",
    "display.activeSettings.title": "Active Display Settings",

    // System tab
    "system.title": "System",
    "system.description": "System settings and application information.",
    "system.startAtLogin": "Start at login",
    "system.version": "Version",
    "system.language": "Language",
    "system.language.en": "English",
    "system.language.zh": "中文",

    // Messages
    "message.saved": "Settings saved successfully.",
    "message.saveFailed": "Failed to save settings.",
    "message.deleteConfirm": "Are you sure you want to delete this?",
  },

  zh: {
    // 通用
    "common.save": "保存",
    "common.cancel": "取消",
    "common.delete": "删除",
    "common.add": "添加",
    "common.remove": "移除",
    "common.edit": "编辑",
    "common.import": "导入",
    "common.export": "导出",
    "common.close": "关闭",
    "common.ok": "确定",
    "common.yes": "是",
    "common.no": "否",
    "common.loading": "加载中...",
    "common.saving": "保存中...",
    "common.importing": "导入中...",
    "common.exporting": "导出中...",
    "common.success": "成功",
    "common.error": "错误",
    "common.warning": "警告",

    // 宠物窗口
    "pet.settings": "打开设置",
    "pet.title": "桌面宠物",

    // 面板标签
    "panel.title": "桌面宠物控制面板",
    "panel.tabs.overview": "概览",
    "panel.tabs.assets": "资源",
    "panel.tabs.states": "状态",
    "panel.tabs.actions": "动作",
    "panel.tabs.interaction": "交互",
    "panel.tabs.rules": "触发规则",
    "panel.tabs.display": "显示",
    "panel.tabs.system": "系统",

    // 概览标签
    "overview.title": "概览",
    "overview.description": "当前宠物包、状态绑定、自定义动作、触发规则、资源和显示状态。",
    "overview.package": "宠物包",
    "overview.states": "状态",
    "overview.actions": "动作",
    "overview.rules": "规则",
    "overview.assets": "资源",
    "overview.display": "显示",
    "overview.system": "系统",
    "overview.systemLogin": "登录启动",
    "overview.systemManual": "手动启动",
    "overview.activeDisplay": "当前显示设置",
    "overview.opacity": "透明度",
    "overview.alwaysOnTop": "置顶显示",
    "overview.mousePassthrough": "鼠标穿透",
    "overview.enabled": "已启用",
    "overview.disabled": "已禁用",

    // 资源标签
    "assets.title": "资源",
    "assets.description": "导入支持的媒体文件并绑定到状态或自定义动作。",
    "assets.import.title": "导入资源",
    "assets.import.chooseFile": "选择文件",
    "assets.import.selectedFile": "已选文件",
    "assets.import.noFileSelected": "未选择文件。",
    "assets.import.package": "宠物包",
    "assets.import.bindTo": "绑定到",
    "assets.import.customAction": "自定义动作",
    "assets.import.noCustomActions": "无自定义动作",
    "assets.import.bindingHint": "仅在绑定到自定义动作时需要。",
    "assets.import.button": "导入并绑定",
    "assets.import.success": "已导入 {asset}。",
    "assets.import.error": "导入失败。",
    "assets.petpack.title": "宠物包",
    "assets.petpack.import": "导入宠物包",
    "assets.petpack.export": "导出宠物包",
    "assets.petpack.currentPackage": "当前宠物包：",
    "assets.petpack.importSuccess": "已导入 {packageId}。",
    "assets.petpack.exportSuccess": "已导出 {packageId} 到 {targetPath}。",
    "assets.referenced.title": "已引用的资源",
    "assets.referenced.count": "{count} 个资源",
    "assets.referenced.countPlural": "{count} 个资源",
    "assets.referenced.empty": "尚未引用任何状态或动作资源。",
    "assets.referenced.preview": "预览",
    "assets.list.title": "已导入的资源",
    "assets.list.usedIn": "使用于：",
    "assets.list.notUsed": "未使用",
    "assets.list.confirmDelete": "删除此资源？它将从所有状态和动作中移除。",
    "assets.bindTarget.custom": "自定义动作",
    "assets.bindTarget.idle": "闲置状态",
    "assets.bindTarget.click": "点击状态",
    "assets.bindTarget.drag": "拖拽状态",

    // 状态标签
    "states.title": "状态",
    "states.description": "配置宠物的动画状态。",
    "states.addNew": "添加新状态",
    "states.builtIn": "内置状态",
    "states.available": "可用",
    "states.editBinding": "编辑状态绑定",
    "states.createBinding": "创建状态绑定",
    "states.bindingId": "绑定 ID",
    "states.displayName": "显示名称",
    "states.assetPath": "资源路径",
    "states.weight": "权重",
    "states.duration": "持续时间（毫秒）",
    "states.returnToState": "返回状态",
    "states.message": "消息",
    "states.form.id": "状态 ID",
    "states.form.assets": "资源",
    "states.form.frameDuration": "帧持续时间 (毫秒)",
    "states.form.loop": "循环",
    "states.form.scale": "缩放",
    "states.form.opacity": "透明度",
    "states.noAssets": "无资源",
    "states.empty": "尚未定义自定义状态。",
    "states.confirmDelete": "删除此状态？可能会破坏引用它的规则。",

    // 动作标签
    "actions.title": "动作",
    "actions.description": "定义可由规则触发的自定义动作。",
    "actions.addNew": "添加新动作",
    "actions.customActions": "自定义动作",
    "actions.saved": "已保存",
    "actions.editAction": "编辑动作",
    "actions.createAction": "创建动作",
    "actions.untitled": "未命名动作",
    "actions.edit": "编辑",
    "actions.form.id": "动作 ID",
    "actions.form.label": "标签",
    "actions.form.name": "名称",
    "actions.form.type": "类型",
    "actions.form.state": "状态",
    "actions.form.duration": "持续时间 (毫秒)",
    "actions.form.sound": "声音",
    "actions.form.text": "文本",
    "actions.form.opacity": "透明度",
    "actions.form.command": "命令",
    "actions.form.asset": "资源",
    "actions.form.assetPath": "资源路径",
    "actions.form.returnToState": "返回状态",
    "actions.form.weight": "权重",
    "actions.form.message": "消息",
    "actions.empty": "尚未定义自定义动作。",
    "actions.confirmDelete": "删除此动作？可能会破坏使用它的规则。",
    "actions.types.setState": "设置状态",
    "actions.types.playSound": "播放声音",
    "actions.types.showBubble": "显示气泡",
    "actions.types.setOpacity": "设置透明度",
    "actions.types.executeCommand": "执行命令",

    // 交互标签
    "interaction.title": "交互",
    "interaction.description": "配置宠物如何响应用户交互。",
    "interaction.messagesAndBubble": "消息和气泡",
    "interaction.clickMessage": "点击消息",
    "interaction.randomIdleMessages": "随机闲置消息",
    "interaction.timedReminderMessages": "定时提醒消息",
    "interaction.doubleClickMessage": "双击消息",
    "interaction.dragStartMessage": "拖拽开始消息",
    "interaction.dragEndMessage": "拖拽结束消息",
    "interaction.hoverMessage": "悬停消息",
    "interaction.importSuccessMessage": "导入成功消息",
    "interaction.bubbleSettings": "气泡设置",
    "interaction.bubbleMaxWidth": "气泡最大宽度",
    "interaction.bubbleDuration": "气泡持续时间（毫秒）",
    "interaction.maxWidth": "最大宽度 (像素)",
    "interaction.duration": "持续时间 (毫秒)",
    "interaction.showCloseButton": "显示关闭按钮",
    "interaction.showBubbleCloseButton": "显示气泡关闭按钮",

    // 规则标签 - 条件类型
    "rules.conditionTypes.click": "点击",
    "rules.conditionTypes.doubleClick": "双击",
    "rules.conditionTypes.rightClick": "右键点击",
    "rules.conditionTypes.dragStart": "拖拽开始",
    "rules.conditionTypes.dragging": "拖拽中",
    "rules.conditionTypes.dragEnd": "拖拽结束",
    "rules.conditionTypes.mouseEnter": "鼠标进入",
    "rules.conditionTypes.mouseLeave": "鼠标离开",
    "rules.conditionTypes.mouseMove": "鼠标移动",
    "rules.conditionTypes.hoverDuration": "悬停时长",
    "rules.conditionTypes.idleDuration": "闲置时长",
    "rules.conditionTypes.timer": "定时器",
    "rules.conditionTypes.randomTimer": "随机定时器",
    "rules.conditionTypes.appLaunch": "应用启动",
    "rules.conditionTypes.packageLoaded": "宠物包已加载",
    "rules.title": "触发规则",
    "rules.description": "定义基于事件触发动作的规则。",
    "rules.addNew": "添加新规则",
    "rules.savedRules": "已保存的规则",
    "rules.saved": "已保存",
    "rules.editRule": "编辑规则",
    "rules.createRule": "创建规则",
    "rules.edit": "编辑",
    "rules.conditionBrowser": "内置条件浏览器",
    "rules.noActionsWarning": "在保存规则之前先创建自定义动作。",
    "rules.andWindowMs": "AND 窗口（毫秒）",
    "rules.actionStrategy": "动作策略",
    "rules.sequence": "顺序",
    "rules.random": "随机",
    "rules.conditionType": "条件类型",
    "rules.filterField": "筛选字段",
    "rules.noFilter": "无筛选",
    "rules.operator": "操作符",
    "rules.filterValue": "筛选值",
    "rules.filterValueHint": "对于 between、in 和 notIn，使用逗号分隔的值。",
    "rules.unit": "单位",
    "rules.remove": "移除",
    "rules.browserField": "字段",
    "rules.browserExpectedInput": "预期输入",
    "rules.form.id": "规则 ID",
    "rules.form.label": "标签",
    "rules.form.name": "名称",
    "rules.form.enabled": "启用",
    "rules.form.trigger": "触发器",
    "rules.form.conditions": "条件",
    "rules.form.actions": "动作",
    "rules.form.relation": "关系",
    "rules.form.priority": "优先级",
    "rules.form.cooldown": "冷却时间 (毫秒)",
    "rules.form.addCondition": "添加条件",
    "rules.form.addAction": "添加动作",
    "rules.form.removeCondition": "移除",
    "rules.form.removeAction": "移除",
    "rules.form.selectActions": "选择动作",
    "rules.form.conditionType": "条件类型",
    "rules.form.field": "字段",
    "rules.form.operator": "操作符",
    "rules.form.value": "值",
    "rules.empty": "尚未定义触发规则。",
    "rules.confirmDelete": "删除此规则？",
    "rules.triggers.interval": "定时",
    "rules.triggers.onClick": "点击时",
    "rules.triggers.onDoubleClick": "双击时",
    "rules.triggers.onDragStart": "拖拽开始时",
    "rules.triggers.onDragEnd": "拖拽结束时",
    "rules.triggers.onHoverEnter": "悬停进入时",
    "rules.triggers.onHoverLeave": "悬停离开时",
    "rules.triggers.onMouseMove": "鼠标移动时",
    "rules.relations.single": "单一",
    "rules.relations.and": "与",
    "rules.relations.or": "或",

    // 显示标签
    "display.title": "显示",
    "display.description": "配置宠物窗口的显示设置。",
    "display.settings.title": "显示设置",
    "display.scale": "缩放",
    "display.opacity": "透明度",
    "display.alwaysOnTop": "置顶显示",
    "display.clickThrough": "点击穿透",
    "display.mousePassthrough": "鼠标穿透",
    "display.resetPosition": "重置位置",
    "display.activeSettings.title": "当前显示设置",

    // 系统标签
    "system.title": "系统",
    "system.description": "系统设置和应用程序信息。",
    "system.startAtLogin": "开机启动",
    "system.version": "版本",
    "system.language": "语言",
    "system.language.en": "English",
    "system.language.zh": "中文",

    // 消息
    "message.saved": "设置保存成功。",
    "message.saveFailed": "设置保存失败。",
    "message.deleteConfirm": "确定要删除吗？",
  }
};

let currentLocale = "en";

/**
 * Set the current locale
 * @param {string} locale - Language code (en, zh, etc.)
 */
export function setLocale(locale) {
  if (translations[locale]) {
    currentLocale = locale;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("locale", locale);
    }
  }
}

/**
 * Get the current locale
 * @returns {string} Current language code
 */
export function getLocale() {
  return currentLocale;
}

/**
 * Initialize locale from storage or browser settings
 */
export function initLocale() {
  let locale = "en";

  if (typeof localStorage !== "undefined") {
    locale = localStorage.getItem("locale");
  }

  if (!locale && typeof navigator !== "undefined") {
    const browserLang = navigator.language || navigator.userLanguage;
    if (browserLang.startsWith("zh")) {
      locale = "zh";
    }
  }

  if (locale && translations[locale]) {
    currentLocale = locale;
  }
}

/**
 * Translate a key with optional parameters
 * @param {string} key - Translation key
 * @param {Object} params - Parameters to interpolate
 * @returns {string} Translated string
 */
export function t(key, params = {}) {
  const translation = translations[currentLocale]?.[key] || translations.en[key] || key;

  // Simple parameter interpolation
  return translation.replace(/\{(\w+)\}/g, (match, param) => {
    return params[param] !== undefined ? params[param] : match;
  });
}

/**
 * Get all available locales
 * @returns {Array<{code: string, name: string}>}
 */
export function getAvailableLocales() {
  return [
    { code: "en", name: "English" },
    { code: "zh", name: "中文" }
  ];
}
