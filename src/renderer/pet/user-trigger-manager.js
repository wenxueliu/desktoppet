import { createDebugLogger } from "./debug-utils.js";

const debugRulesLog = createDebugLogger("[desktop-pet:actions]");

/**
 * User Trigger Manager - Manages user-configured trigger rules
 *
 * Handles loading user triggers, matching conditions with filters,
 * cooldown management, and action execution.
 */

/**
 * UserTriggerManager class
 * Subscribes user-configured triggers to the event bus
 */
class UserTriggerManager {
  /**
   * @param {EventBus} eventBus - Event bus instance
   * @param {object} actionExecutors - Action executor functions
   * @param {function} actionExecutors.playAnimation - Play animation handler
   * @param {function} actionExecutors.stopAnimation - Stop animation handler
   * @param {function} actionExecutors.showMessage - Show message handler
   * @param {function} actionExecutors.changeDisplay - Change display properties handler
   * @param {function} actionExecutors.resetPosition - Reset position handler
   * @param {function} actionExecutors.openPanel - Open panel handler
   */
  constructor(eventBus, actionExecutors = {}) {
    if (!eventBus) {
      throw new Error('EventBus instance is required');
    }

    this.eventBus = eventBus;
    this.actionExecutors = actionExecutors;
    this.triggers = [];
    this.listenerIds = [];
    this.cooldowns = new Map(); // triggerId -> lastTriggeredTimestamp
  }

  /**
   * Load user triggers
   * @param {Array} triggers - Array of trigger configurations
   */
  loadTriggers(triggers) {
    // Unload existing triggers first
    this.unloadTriggers();

    if (!Array.isArray(triggers)) {
      console.warn('Triggers must be an array');
      return;
    }

    this.triggers = triggers.filter(t => t && t.enabled !== false);

    // Register listeners for each trigger
    this.triggers.forEach(trigger => {
      if (!trigger.conditions || !Array.isArray(trigger.conditions)) {
        console.warn(`Trigger ${trigger.id} has no valid conditions`);
        return;
      }

      const relation = trigger.relation || 'single';

      if (relation === 'single' || relation === 'or') {
        this.registerSimpleTrigger(trigger);
      } else if (relation === 'and') {
        this.registerAndTrigger(trigger);
      }
    });
  }

  /**
   * Register simple trigger (single or OR conditions)
   * Each condition gets its own listener
   * @private
   */
  registerSimpleTrigger(trigger) {
    trigger.conditions.forEach(condition => {
      const eventType = condition.type;
      if (!eventType) return;

      const listenerId = this.eventBus.subscribe(
        eventType,
        (event) => this.handleSimpleTrigger(trigger, condition, event),
        {
          priority: trigger.priority || 50,
          id: `user-${trigger.id}-${eventType}`
        }
      );

      this.listenerIds.push(listenerId);
    });
  }

  /**
   * Register AND trigger (all conditions must match within time window)
   * Only subscribes to the last condition, then checks history for others
   * @private
   */
  registerAndTrigger(trigger) {
    if (trigger.conditions.length === 0) return;

    // Subscribe to all condition types (not just last)
    // This allows any condition to potentially trigger the check
    const conditionTypes = [...new Set(trigger.conditions.map(c => c.type))];

    conditionTypes.forEach(eventType => {
      const listenerId = this.eventBus.subscribe(
        eventType,
        (event) => this.handleAndTrigger(trigger, event),
        {
          priority: trigger.priority || 50,
          id: `user-and-${trigger.id}-${eventType}`
        }
      );

      this.listenerIds.push(listenerId);
    });
  }

  /**
   * Handle simple trigger event
   * @private
   */
  handleSimpleTrigger(trigger, condition, event) {
    // Check cooldown
    if (this.isOnCooldown(trigger.id, trigger.cooldownMs)) {
      return false;
    }

    // Check filters
    if (!this.matchFilters(condition.filters, event)) {
      return false;
    }

    // Execute actions
    this.executeActions(trigger.actions, trigger.actionStrategy, event);

    // Record trigger time
    this.cooldowns.set(trigger.id, Date.now());

    // Return interrupt flag
    return trigger.interruptCurrent || false;
  }

  /**
   * Handle AND trigger event
   * Checks if all conditions are satisfied within time window
   * @private
   */
  handleAndTrigger(trigger, event) {
    // Check cooldown
    if (this.isOnCooldown(trigger.id, trigger.cooldownMs)) {
      return false;
    }

    // Get time window
    const windowMs = trigger.andWindowMs || 3000;
    const recentEvents = this.eventBus.getRecentEvents(windowMs);

    // Check if all conditions are satisfied in recent events
    const allMatched = trigger.conditions.every(condition => {
      return recentEvents.some(e =>
        e.type === condition.type &&
        this.matchFilters(condition.filters, e)
      );
    });

    if (!allMatched) {
      return false;
    }

    // Execute actions
    this.executeActions(trigger.actions, trigger.actionStrategy, event);

    // Record trigger time
    this.cooldowns.set(trigger.id, Date.now());

    // Return interrupt flag
    return trigger.interruptCurrent || false;
  }

  /**
   * Check if trigger is on cooldown
   * @private
   */
  isOnCooldown(triggerId, cooldownMs) {
    if (!cooldownMs || cooldownMs <= 0) return false;

    const lastTriggered = this.cooldowns.get(triggerId);
    if (!lastTriggered) return false;

    return Date.now() - lastTriggered < cooldownMs;
  }

  /**
   * Match filters against event
   * @private
   */
  matchFilters(filters, event) {
    if (!filters || !Array.isArray(filters) || filters.length === 0) {
      return true;
    }

    return filters.every(filter => {
      if (!filter || !filter.field) return true;

      const value = event[filter.field];
      return this.compareValues(value, filter.operator, filter.value);
    });
  }

  /**
   * Compare values using operator
   * @private
   */
  compareValues(actual, operator, expected) {
    switch (operator) {
      case '=':
      case '==':
        return actual === expected;

      case '!=':
        return actual !== expected;

      case '>':
        return actual > expected;

      case '>=':
        return actual >= expected;

      case '<':
        return actual < expected;

      case '<=':
        return actual <= expected;

      case 'between':
        return Array.isArray(expected) &&
               expected.length >= 2 &&
               actual >= expected[0] &&
               actual <= expected[1];

      case 'in':
        return Array.isArray(expected) && expected.includes(actual);

      case 'notIn':
        return Array.isArray(expected) && !expected.includes(actual);

      default:
        console.warn(`Unknown operator: ${operator}`);
        return false;
    }
  }

  /**
   * Execute action sequence
   * @private
   */
  executeActions(actions, strategy = 'sequence', eventContext = {}) {
    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      return;
    }

    if (strategy === 'random') {
      // Pick one random action
      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      this.executeAction(randomAction, eventContext);
    } else {
      // Execute all actions in sequence (default)
      actions.forEach(action => this.executeAction(action, eventContext));
    }
  }

  isGlobalMouseEvent(eventContext = {}) {
    return eventContext && eventContext.eventSource === 'globalMouse';
  }

  resolveActionProgress(action, eventContext = {}) {
    const sourceField = action.progressFrom || action.progressField;
    const rawProgress = sourceField && Object.prototype.hasOwnProperty.call(eventContext, sourceField)
      ? eventContext[sourceField]
      : action.progress;
    const scale = Number.isFinite(Number(action.scale)) ? Number(action.scale) : 1;
    const offset = Number.isFinite(Number(action.offset)) ? Number(action.offset) : 0;
    const progress = Number(rawProgress ?? 0) * scale + offset;
    if (!Number.isFinite(progress)) return 0;
    return Math.min(1, Math.max(0, progress));
  }

  mapKeyframeProgress(animId, progress) {
    return this.actionExecutors.mapKeyframeProgress
      ? this.actionExecutors.mapKeyframeProgress(animId, progress)
      : progress;
  }

  /**
   * Execute single action
   * @private
   */
  executeAction(action, eventContext = {}) {
    if (!action) return;

    // Handle string format: 'play:jump' or 'message:hi'
    if (typeof action === 'string') {
      const [type, param] = action.split(':', 2);
      this.executeAction({ type, param }, eventContext);
      return;
    }

    // Handle object format
    const actionType = action.type;
    if (!actionType) {
      console.warn('Action missing type', action);
      return;
    }

    try {
      switch (actionType) {
        case 'play':
        case 'playAnimation':
          if (this.actionExecutors.playAnimation) {
            const animId = action.param || action.animation || action.state;
            const isKeyframeAnimation = this.actionExecutors.isKeyframeAnimation && this.actionExecutors.isKeyframeAnimation(animId);
            if (isKeyframeAnimation && !this.isGlobalMouseEvent(eventContext)) {
              debugRulesLog('blocked playAnimation keyframe non-global', { animId, eventContext });
              break;
            }
            const options = isKeyframeAnimation
              ? { ...action, progress: this.mapKeyframeProgress(animId, this.resolveActionProgress(action, eventContext)) }
              : action;
            this.actionExecutors.playAnimation(animId, options);
          }
          break;

        case 'setKeyframeProgress':
          if (this.actionExecutors.setKeyframeProgress) {
            if (!this.isGlobalMouseEvent(eventContext)) {
              debugRulesLog('blocked setKeyframeProgress non-global', { action, eventContext });
              break;
            }
            const animId = action.param || action.animation || action.state;
            const progress = this.mapKeyframeProgress(animId, this.resolveActionProgress(action, eventContext));
            debugRulesLog('setKeyframeProgress', { animId, progress, eventContext });
            this.actionExecutors.setKeyframeProgress(animId, progress, action);
          }
          break;

        case 'stop':
        case 'stopAnimation':
          if (this.actionExecutors.stopAnimation) {
            this.actionExecutors.stopAnimation();
          }
          break;

        case 'message':
        case 'showMessage':
          if (this.actionExecutors.showMessage) {
            const text = action.param || action.text || action.message;
            this.actionExecutors.showMessage(text, action);
          }
          break;

        case 'randomMessage':
          if (this.actionExecutors.showMessage && action.messages) {
            const messages = Array.isArray(action.messages) ? action.messages : [];
            if (messages.length > 0) {
              const msg = messages[Math.floor(Math.random() * messages.length)];
              this.actionExecutors.showMessage(msg, action);
            }
          }
          break;

        case 'changeScale':
        case 'changeOpacity':
        case 'changeDisplay':
          if (this.actionExecutors.changeDisplay) {
            this.actionExecutors.changeDisplay(action);
          }
          break;

        case 'hidePet':
        case 'showPet':
          if (this.actionExecutors.changeDisplay) {
            this.actionExecutors.changeDisplay({
              type: 'setVisibility',
              visible: actionType === 'showPet'
            });
          }
          break;

        case 'resetPosition':
          if (this.actionExecutors.resetPosition) {
            this.actionExecutors.resetPosition();
          }
          break;

        case 'openPanel':
          if (this.actionExecutors.openPanel) {
            this.actionExecutors.openPanel();
          }
          break;

        default:
          console.warn(`Unknown action type: ${actionType}`);
      }
    } catch (error) {
      console.error(`Error executing action ${actionType}:`, error);
    }
  }

  /**
   * Unload all triggers
   */
  unloadTriggers() {
    this.listenerIds.forEach(id => {
      this.eventBus.unsubscribe(id);
    });
    this.listenerIds = [];
    this.cooldowns.clear();
    this.triggers = [];
  }

  /**
   * Get loaded triggers
   * @returns {Array} Triggers array
   */
  getTriggers() {
    return [...this.triggers];
  }

  /**
   * Get listener IDs
   * @returns {Array<string>} Listener IDs
   */
  getListenerIds() {
    return [...this.listenerIds];
  }

  /**
   * Get cooldown status for a trigger
   * @param {string} triggerId - Trigger ID
   * @returns {object} {onCooldown: boolean, remainingMs: number}
   */
  getCooldownStatus(triggerId) {
    const trigger = this.triggers.find(t => t.id === triggerId);
    if (!trigger || !trigger.cooldownMs) {
      return { onCooldown: false, remainingMs: 0 };
    }

    const lastTriggered = this.cooldowns.get(triggerId);
    if (!lastTriggered) {
      return { onCooldown: false, remainingMs: 0 };
    }

    const elapsed = Date.now() - lastTriggered;
    const remaining = trigger.cooldownMs - elapsed;

    return {
      onCooldown: remaining > 0,
      remainingMs: Math.max(0, remaining)
    };
  }
}

// ES module export (primary)
export { UserTriggerManager };

// Export for CommonJS (for tests)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UserTriggerManager };
}
