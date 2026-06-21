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
    "overview.stats.states": "states",
    "overview.stats.customActions": "custom actions",
    "overview.stats.rules": "rules",
    "overview.stats.assets": "assets",

    // Assets tab
    "assets.title": "Assets",
    "assets.description": "Import supported media and bind it to a state or custom action.",
    "assets.import.title": "Asset Import",
    "assets.import.pickFile": "Pick a file",
    "assets.import.bindTo": "Bind to",
    "assets.import.selectAction": "Select an action",
    "assets.import.button": "Import and bind",
    "assets.import.success": "Imported {asset}.",
    "assets.import.error": "Import failed.",
    "assets.petpack.title": "Petpack Management",
    "assets.petpack.import": "Import petpack",
    "assets.petpack.export": "Export petpack",
    "assets.petpack.importSuccess": "Imported {packageId}.",
    "assets.petpack.exportSuccess": "Exported {packageId} to {targetPath}.",
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
    "states.form.id": "State ID",
    "states.form.assets": "Assets",
    "states.form.frameDuration": "Frame duration (ms)",
    "states.form.loop": "Loop",
    "states.form.scale": "Scale",
    "states.form.opacity": "Opacity",
    "states.confirmDelete": "Delete this state? It may break rules that reference it.",

    // Actions tab
    "actions.title": "Actions",
    "actions.description": "Define custom actions that can be triggered by rules.",
    "actions.addNew": "Add new action",
    "actions.form.id": "Action ID",
    "actions.form.label": "Label",
    "actions.form.type": "Type",
    "actions.confirmDelete": "Delete this action? It may break rules that use it.",
    "actions.types.setState": "Set state",
    "actions.types.playSound": "Play sound",
    "actions.types.showBubble": "Show bubble",
    "actions.types.setOpacity": "Set opacity",
    "actions.types.executeCommand": "Execute command",

    // Interaction tab
    "interaction.title": "Interaction",
    "interaction.description": "Configure how the pet responds to user interactions.",
    "interaction.clickMessage": "Click message",
    "interaction.doubleClickMessage": "Double-click message",
    "interaction.dragStartMessage": "Drag start message",
    "interaction.dragEndMessage": "Drag end message",
    "interaction.hoverMessage": "Hover message",
    "interaction.importSuccessMessage": "Import success message",

    // Rules tab
    "rules.title": "Trigger Rules",
    "rules.description": "Define rules that trigger actions based on events.",
    "rules.addNew": "Add new rule",
    "rules.form.id": "Rule ID",
    "rules.form.label": "Label",
    "rules.form.enabled": "Enabled",
    "rules.form.trigger": "Trigger",
    "rules.form.conditions": "Conditions",
    "rules.form.actions": "Actions",
    "rules.form.addCondition": "Add condition",
    "rules.form.addAction": "Add action",
    "rules.form.removeCondition": "Remove",
    "rules.form.removeAction": "Remove",
    "rules.confirmDelete": "Delete this rule?",
    "rules.triggers.interval": "Interval",
    "rules.triggers.onClick": "On click",
    "rules.triggers.onDoubleClick": "On double click",
    "rules.triggers.onDragStart": "On drag start",
    "rules.triggers.onDragEnd": "On drag end",
    "rules.triggers.onHoverEnter": "On hover enter",
    "rules.triggers.onHoverLeave": "On hover leave",
    "rules.triggers.onMouseMove": "On mouse move",

    // Display tab
    "display.title": "Display",
    "display.description": "Configure display settings for the pet window.",
    "display.settings.title": "Display Settings",
    "display.alwaysOnTop": "Always on top",
    "display.clickThrough": "Click through",
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
    "overview.stats.states": "个状态",
    "overview.stats.customActions": "个自定义动作",
    "overview.stats.rules": "条规则",
    "overview.stats.assets": "个资源",

    // 资源标签
    "assets.title": "资源",
    "assets.description": "导入支持的媒体文件并绑定到状态或自定义动作。",
    "assets.import.title": "导入资源",
    "assets.import.pickFile": "选择文件",
    "assets.import.bindTo": "绑定到",
    "assets.import.selectAction": "选择一个动作",
    "assets.import.button": "导入并绑定",
    "assets.import.success": "已导入 {asset}。",
    "assets.import.error": "导入失败。",
    "assets.petpack.title": "宠物包管理",
    "assets.petpack.import": "导入宠物包",
    "assets.petpack.export": "导出宠物包",
    "assets.petpack.importSuccess": "已导入 {packageId}。",
    "assets.petpack.exportSuccess": "已导出 {packageId} 到 {targetPath}。",
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
    "states.form.id": "状态 ID",
    "states.form.assets": "资源",
    "states.form.frameDuration": "帧持续时间 (毫秒)",
    "states.form.loop": "循环",
    "states.form.scale": "缩放",
    "states.form.opacity": "透明度",
    "states.confirmDelete": "删除此状态？可能会破坏引用它的规则。",

    // 动作标签
    "actions.title": "动作",
    "actions.description": "定义可由规则触发的自定义动作。",
    "actions.addNew": "添加新动作",
    "actions.form.id": "动作 ID",
    "actions.form.label": "标签",
    "actions.form.type": "类型",
    "actions.confirmDelete": "删除此动作？可能会破坏使用它的规则。",
    "actions.types.setState": "设置状态",
    "actions.types.playSound": "播放声音",
    "actions.types.showBubble": "显示气泡",
    "actions.types.setOpacity": "设置透明度",
    "actions.types.executeCommand": "执行命令",

    // 交互标签
    "interaction.title": "交互",
    "interaction.description": "配置宠物如何响应用户交互。",
    "interaction.clickMessage": "点击消息",
    "interaction.doubleClickMessage": "双击消息",
    "interaction.dragStartMessage": "拖拽开始消息",
    "interaction.dragEndMessage": "拖拽结束消息",
    "interaction.hoverMessage": "悬停消息",
    "interaction.importSuccessMessage": "导入成功消息",

    // 规则标签
    "rules.title": "触发规则",
    "rules.description": "定义基于事件触发动作的规则。",
    "rules.addNew": "添加新规则",
    "rules.form.id": "规则 ID",
    "rules.form.label": "标签",
    "rules.form.enabled": "启用",
    "rules.form.trigger": "触发器",
    "rules.form.conditions": "条件",
    "rules.form.actions": "动作",
    "rules.form.addCondition": "添加条件",
    "rules.form.addAction": "添加动作",
    "rules.form.removeCondition": "移除",
    "rules.form.removeAction": "移除",
    "rules.confirmDelete": "删除此规则？",
    "rules.triggers.interval": "定时",
    "rules.triggers.onClick": "点击时",
    "rules.triggers.onDoubleClick": "双击时",
    "rules.triggers.onDragStart": "拖拽开始时",
    "rules.triggers.onDragEnd": "拖拽结束时",
    "rules.triggers.onHoverEnter": "悬停进入时",
    "rules.triggers.onHoverLeave": "悬停离开时",
    "rules.triggers.onMouseMove": "鼠标移动时",

    // 显示标签
    "display.title": "显示",
    "display.description": "配置宠物窗口的显示设置。",
    "display.settings.title": "显示设置",
    "display.alwaysOnTop": "置顶显示",
    "display.clickThrough": "点击穿透",
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
