function getExistingActions(rule, actionsById) {
  const actionIds = Array.isArray(rule && rule.actions) ? rule.actions : [];
  const actionMap = actionsById && typeof actionsById === "object" ? actionsById : {};

  return actionIds
    .map((actionId) => actionMap[actionId])
    .filter(Boolean);
}

function selectActions(rule, actionsById) {
  const actions = getExistingActions(rule, actionsById);

  if (rule && rule.actionStrategy === "random") {
    if (actions.length === 0) return [];
    return [actions[Math.floor(Math.random() * actions.length)]];
  }

  return actions;
}

module.exports = {
  selectActions
};
