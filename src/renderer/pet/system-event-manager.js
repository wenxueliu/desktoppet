/**
 * System Event Manager - Handles built-in, non-removable system events
 *
 * System events have the highest priority and handle core functionality
 * like context menus, window dragging, and settings button.
 */

/**
 * SystemEventManager class
 * Registers and manages system-level event handlers
 */
class SystemEventManager {
  /**
   * @param {EventBus} eventBus - Event bus instance
   * @param {object} handlers - Handler functions for system events
   * @param {function} handlers.showContextMenu - Show context menu handler
   * @param {function} handlers.startWindowDrag - Start window drag handler
   * @param {function} handlers.updateWindowPosition - Update window position handler
   * @param {function} handlers.endWindowDrag - End window drag handler
   * @param {function} handlers.openPanel - Open control panel handler
   * @param {function} handlers.onAppLaunch - App launch callback (optional)
   * @param {function} handlers.onPackageLoaded - Package loaded callback (optional)
   */
  constructor(eventBus, handlers) {
    if (!eventBus) {
      throw new Error('EventBus instance is required');
    }

    if (!handlers || typeof handlers !== 'object') {
      throw new Error('Handlers object is required');
    }

    this.eventBus = eventBus;
    this.handlers = handlers;
    this.listenerIds = [];
    this.isDragging = false;

    this.registerSystemEvents();
  }

  /**
   * Register all system event handlers
   * @private
   */
  registerSystemEvents() {
    this.registerContextMenu();
    this.registerWindowDrag();
    this.registerSettingsButton();
    this.registerLifecycleEvents();
  }

  /**
   * Register context menu handler (right-click)
   * Highest priority, blocks propagation to user rules
   * @private
   */
  registerContextMenu() {
    const id = this.eventBus.subscribe('rightClick', (event) => {
      if (typeof this.handlers.showContextMenu === 'function') {
        this.handlers.showContextMenu(event);
      }
      // Always block propagation - context menu is system-only
      return true;
    }, {
      system: true,
      priority: 100,
      id: 'system-context-menu'
    });

    this.listenerIds.push(id);
  }

  /**
   * Register window dragging handlers
   * System-level but doesn't block user rules (allows drag animations)
   * @private
   */
  registerWindowDrag() {
    // Drag start
    const dragStartId = this.eventBus.subscribe('dragStart', (event) => {
      this.isDragging = true;
      if (typeof this.handlers.startWindowDrag === 'function') {
        this.handlers.startWindowDrag(event);
      }
      // Don't block propagation - allow user drag animations
      return false;
    }, {
      system: true,
      priority: 100,
      id: 'system-window-drag-start'
    });

    // Dragging
    const draggingId = this.eventBus.subscribe('dragging', (event) => {
      if (this.isDragging && typeof this.handlers.updateWindowPosition === 'function') {
        this.handlers.updateWindowPosition(event);
      }
      // Don't block propagation
      return false;
    }, {
      system: true,
      priority: 100,
      id: 'system-window-dragging'
    });

    // Drag end
    const dragEndId = this.eventBus.subscribe('dragEnd', (event) => {
      if (this.isDragging && typeof this.handlers.endWindowDrag === 'function') {
        this.handlers.endWindowDrag(event);
      }
      this.isDragging = false;
      // Don't block propagation
      return false;
    }, {
      system: true,
      priority: 100,
      id: 'system-window-drag-end'
    });

    this.listenerIds.push(dragStartId, draggingId, dragEndId);
  }

  /**
   * Register settings button click handler
   * Checks if click target is settings button, blocks if true
   * @private
   */
  registerSettingsButton() {
    const id = this.eventBus.subscribe('click', (event) => {
      // Check if the click target is the settings button
      if (this.isSettingsButtonClick(event)) {
        if (typeof this.handlers.openPanel === 'function') {
          this.handlers.openPanel(event);
        }
        // Block propagation - settings button shouldn't trigger other click rules
        return true;
      }
      // Not settings button, continue propagation
      return false;
    }, {
      system: true,
      priority: 100,
      id: 'system-settings-button'
    });

    this.listenerIds.push(id);
  }

  /**
   * Register lifecycle event handlers
   * @private
   */
  registerLifecycleEvents() {
    // App launch
    const launchId = this.eventBus.subscribe('appLaunch', (event) => {
      if (typeof this.handlers.onAppLaunch === 'function') {
        this.handlers.onAppLaunch(event);
      }
      // Don't block propagation - allow user rules to respond to app launch
      return false;
    }, {
      system: true,
      priority: 100,
      id: 'system-app-launch'
    });

    // Package loaded
    const packageId = this.eventBus.subscribe('packageLoaded', (event) => {
      if (typeof this.handlers.onPackageLoaded === 'function') {
        this.handlers.onPackageLoaded(event);
      }
      // Don't block propagation
      return false;
    }, {
      system: true,
      priority: 100,
      id: 'system-package-loaded'
    });

    this.listenerIds.push(launchId, packageId);
  }

  /**
   * Check if a click event targets the settings button
   * @private
   */
  isSettingsButtonClick(event) {
    if (!event || !event.target) return false;

    // Check if target is the settings button or a child of it
    const target = event.target;

    // Direct ID match
    if (target.id === 'settings-button') return true;

    // Check parent elements (for clicks on button children)
    let element = target.parentElement;
    while (element) {
      if (element.id === 'settings-button') return true;
      element = element.parentElement;
    }

    return false;
  }

  /**
   * Unregister all system event handlers
   * Should be called when cleaning up the manager
   */
  unregisterAll() {
    this.listenerIds.forEach(id => {
      this.eventBus.unsubscribe(id);
    });
    this.listenerIds = [];
    this.isDragging = false;
  }

  /**
   * Get list of registered system event listener IDs
   * @returns {Array<string>} Listener IDs
   */
  getListenerIds() {
    return [...this.listenerIds];
  }

  /**
   * Check if currently dragging
   * @returns {boolean}
   */
  isDraggingWindow() {
    return this.isDragging;
  }
}

// ES module export (primary)
export { SystemEventManager };

// Export for CommonJS (for tests)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SystemEventManager };
}
