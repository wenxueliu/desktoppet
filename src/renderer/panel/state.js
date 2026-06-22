/**
 * Global state management for panel
 */

import { TRIGGER_PARAMETER_FIELDS } from "./panel-state.js";

export const state = {
  activeTab: "overview",
  config: null,
  savingKey: "",
  selectedStateType: "idle",
  selectedStateEntryId: "",
  selectedActionId: "",
  selectedRuleId: "",
  selectedConditionType: Object.keys(TRIGGER_PARAMETER_FIELDS)[0],
  selectedAssetPath: "",
  selectedAssetPackageId: "",
  selectedAssetBindingTarget: "custom",
  selectedAssetActionId: "",
  selectedAssetResult: null,
  packageList: [],
  packageAssets: [],
  selectedPackageAsset: "",
  isCreatingPackage: false,
  packageEditMode: false,
  assetEditMode: false,
  petpackResult: null,
  systemLaunchAtLogin: false
};

/**
 * Update state and optionally trigger render
 * @param {object} updates - State updates
 * @param {Function} [renderCallback] - Optional render callback
 */
export function updateState(updates, renderCallback) {
  Object.assign(state, updates);
  if (renderCallback) {
    renderCallback();
  }
}
