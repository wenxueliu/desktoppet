import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/shared/event-bus.js";
import { SystemEventManager } from "../../src/renderer/pet/system-event-manager.js";

describe("SystemEventManager", () => {
  let eventBus;
  let handlers;
  let manager;

  beforeEach(() => {
    eventBus = new EventBus();
    handlers = {
      showContextMenu: vi.fn(),
      startWindowDrag: vi.fn(),
      updateWindowPosition: vi.fn(),
      endWindowDrag: vi.fn(),
      openPanel: vi.fn(),
      onAppLaunch: vi.fn(),
      onPackageLoaded: vi.fn()
    };
  });

  describe("constructor", () => {
    it("should create instance with valid parameters", () => {
      manager = new SystemEventManager(eventBus, handlers);

      expect(manager).toBeDefined();
      expect(manager.eventBus).toBe(eventBus);
      expect(manager.handlers).toBe(handlers);
    });

    it("should throw error if eventBus is missing", () => {
      expect(() => new SystemEventManager(null, handlers)).toThrow();
    });

    it("should throw error if handlers is missing", () => {
      expect(() => new SystemEventManager(eventBus, null)).toThrow();
    });

    it("should register system event listeners on construction", () => {
      manager = new SystemEventManager(eventBus, handlers);

      // Check that listeners were registered
      expect(eventBus.getListeners('rightClick').length).toBeGreaterThan(0);
      expect(eventBus.getListeners('dragStart').length).toBeGreaterThan(0);
      expect(eventBus.getListeners('click').length).toBeGreaterThan(0);
      expect(eventBus.getListeners('appLaunch').length).toBeGreaterThan(0);
    });

    it("should register system listeners with system flag", () => {
      manager = new SystemEventManager(eventBus, handlers);

      const rightClickListeners = eventBus.getListeners('rightClick');
      expect(rightClickListeners[0].system).toBe(true);
    });
  });

  describe("context menu (rightClick)", () => {
    beforeEach(() => {
      manager = new SystemEventManager(eventBus, handlers);
    });

    it("should call showContextMenu handler on rightClick", () => {
      const event = { x: 100, y: 200 };
      eventBus.emit('rightClick', event);

      expect(handlers.showContextMenu).toHaveBeenCalledTimes(1);
      expect(handlers.showContextMenu).toHaveBeenCalledWith(
        expect.objectContaining({ x: 100, y: 200, type: 'rightClick' })
      );
    });

    it("should block propagation to user rules", () => {
      const userHandler = vi.fn();
      eventBus.subscribe('rightClick', userHandler, { priority: 50 });

      eventBus.emit('rightClick', {});

      expect(handlers.showContextMenu).toHaveBeenCalled();
      expect(userHandler).not.toHaveBeenCalled();
    });

    it("should handle missing showContextMenu handler gracefully", () => {
      delete handlers.showContextMenu;

      expect(() => {
        eventBus.emit('rightClick', {});
      }).not.toThrow();
    });
  });

  describe("window dragging", () => {
    beforeEach(() => {
      manager = new SystemEventManager(eventBus, handlers);
    });

    it("should call startWindowDrag on dragStart", () => {
      const event = { x: 50, y: 50 };
      eventBus.emit('dragStart', event);

      expect(handlers.startWindowDrag).toHaveBeenCalledTimes(1);
      expect(handlers.startWindowDrag).toHaveBeenCalledWith(
        expect.objectContaining({ x: 50, y: 50, type: 'dragStart' })
      );
    });

    it("should set isDragging flag on dragStart", () => {
      expect(manager.isDraggingWindow()).toBe(false);

      eventBus.emit('dragStart', {});

      expect(manager.isDraggingWindow()).toBe(true);
    });

    it("should call updateWindowPosition on dragging", () => {
      eventBus.emit('dragStart', {});
      eventBus.emit('dragging', { x: 60, y: 60 });

      expect(handlers.updateWindowPosition).toHaveBeenCalledTimes(1);
      expect(handlers.updateWindowPosition).toHaveBeenCalledWith(
        expect.objectContaining({ x: 60, y: 60, type: 'dragging' })
      );
    });

    it("should not call updateWindowPosition if not dragging", () => {
      // Don't emit dragStart
      eventBus.emit('dragging', { x: 60, y: 60 });

      expect(handlers.updateWindowPosition).not.toHaveBeenCalled();
    });

    it("should call endWindowDrag on dragEnd", () => {
      eventBus.emit('dragStart', {});
      eventBus.emit('dragEnd', { x: 70, y: 70 });

      expect(handlers.endWindowDrag).toHaveBeenCalledTimes(1);
      expect(handlers.endWindowDrag).toHaveBeenCalledWith(
        expect.objectContaining({ x: 70, y: 70, type: 'dragEnd' })
      );
    });

    it("should clear isDragging flag on dragEnd", () => {
      eventBus.emit('dragStart', {});
      expect(manager.isDraggingWindow()).toBe(true);

      eventBus.emit('dragEnd', {});
      expect(manager.isDraggingWindow()).toBe(false);
    });

    it("should not block propagation to user rules", () => {
      const userHandler = vi.fn();
      eventBus.subscribe('dragStart', userHandler, { priority: 50 });

      eventBus.emit('dragStart', {});

      expect(handlers.startWindowDrag).toHaveBeenCalled();
      expect(userHandler).toHaveBeenCalled();
    });

    it("should handle full drag sequence", () => {
      eventBus.emit('dragStart', { x: 50, y: 50 });
      eventBus.emit('dragging', { x: 55, y: 55 });
      eventBus.emit('dragging', { x: 60, y: 60 });
      eventBus.emit('dragEnd', { x: 65, y: 65 });

      expect(handlers.startWindowDrag).toHaveBeenCalledTimes(1);
      expect(handlers.updateWindowPosition).toHaveBeenCalledTimes(2);
      expect(handlers.endWindowDrag).toHaveBeenCalledTimes(1);
      expect(manager.isDraggingWindow()).toBe(false);
    });
  });

  describe("settings button", () => {
    beforeEach(() => {
      manager = new SystemEventManager(eventBus, handlers);
    });

    it("should call openPanel when settings button is clicked", () => {
      const event = {
        target: { id: 'settings-button' }
      };

      eventBus.emit('click', event);

      expect(handlers.openPanel).toHaveBeenCalledTimes(1);
    });

    it("should block propagation when settings button is clicked", () => {
      const userHandler = vi.fn();
      eventBus.subscribe('click', userHandler, { priority: 50 });

      const event = {
        target: { id: 'settings-button' }
      };

      eventBus.emit('click', event);

      expect(handlers.openPanel).toHaveBeenCalled();
      expect(userHandler).not.toHaveBeenCalled();
    });

    it("should not block propagation for non-settings clicks", () => {
      const userHandler = vi.fn();
      eventBus.subscribe('click', userHandler, { priority: 50 });

      const event = {
        target: { id: 'sprite' }
      };

      eventBus.emit('click', event);

      expect(handlers.openPanel).not.toHaveBeenCalled();
      expect(userHandler).toHaveBeenCalled();
    });

    it("should detect settings button click on child element", () => {
      const parentElement = { id: 'settings-button', parentElement: null };
      const childElement = { id: 'icon', parentElement: parentElement };

      const event = { target: childElement };

      eventBus.emit('click', event);

      expect(handlers.openPanel).toHaveBeenCalled();
    });

    it("should handle deeply nested child elements", () => {
      const grandparent = { id: 'settings-button', parentElement: null };
      const parent = { id: 'wrapper', parentElement: grandparent };
      const child = { id: 'icon', parentElement: parent };

      const event = { target: child };

      eventBus.emit('click', event);

      expect(handlers.openPanel).toHaveBeenCalled();
    });

    it("should handle missing target gracefully", () => {
      expect(() => {
        eventBus.emit('click', {});
      }).not.toThrow();

      expect(handlers.openPanel).not.toHaveBeenCalled();
    });
  });

  describe("lifecycle events", () => {
    beforeEach(() => {
      manager = new SystemEventManager(eventBus, handlers);
    });

    it("should call onAppLaunch handler", () => {
      const event = { timestamp: Date.now() };
      eventBus.emit('appLaunch', event);

      expect(handlers.onAppLaunch).toHaveBeenCalledTimes(1);
      expect(handlers.onAppLaunch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'appLaunch' })
      );
    });

    it("should not block propagation for appLaunch", () => {
      const userHandler = vi.fn();
      eventBus.subscribe('appLaunch', userHandler, { priority: 50 });

      eventBus.emit('appLaunch', {});

      expect(handlers.onAppLaunch).toHaveBeenCalled();
      expect(userHandler).toHaveBeenCalled();
    });

    it("should call onPackageLoaded handler", () => {
      const event = { packageId: 'test-package' };
      eventBus.emit('packageLoaded', event);

      expect(handlers.onPackageLoaded).toHaveBeenCalledTimes(1);
      expect(handlers.onPackageLoaded).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'packageLoaded', packageId: 'test-package' })
      );
    });

    it("should not block propagation for packageLoaded", () => {
      const userHandler = vi.fn();
      eventBus.subscribe('packageLoaded', userHandler, { priority: 50 });

      eventBus.emit('packageLoaded', {});

      expect(handlers.onPackageLoaded).toHaveBeenCalled();
      expect(userHandler).toHaveBeenCalled();
    });

    it("should handle missing lifecycle handlers gracefully", () => {
      delete handlers.onAppLaunch;
      delete handlers.onPackageLoaded;

      expect(() => {
        eventBus.emit('appLaunch', {});
        eventBus.emit('packageLoaded', {});
      }).not.toThrow();
    });
  });

  describe("unregisterAll", () => {
    beforeEach(() => {
      manager = new SystemEventManager(eventBus, handlers);
    });

    it("should remove all system event listeners", () => {
      manager.unregisterAll();

      eventBus.emit('rightClick', {});
      eventBus.emit('dragStart', {});
      eventBus.emit('click', { target: { id: 'settings-button' } });

      expect(handlers.showContextMenu).not.toHaveBeenCalled();
      expect(handlers.startWindowDrag).not.toHaveBeenCalled();
      expect(handlers.openPanel).not.toHaveBeenCalled();
    });

    it("should clear listener IDs array", () => {
      expect(manager.getListenerIds().length).toBeGreaterThan(0);

      manager.unregisterAll();

      expect(manager.getListenerIds().length).toBe(0);
    });

    it("should reset isDragging flag", () => {
      eventBus.emit('dragStart', {});
      expect(manager.isDraggingWindow()).toBe(true);

      manager.unregisterAll();

      expect(manager.isDraggingWindow()).toBe(false);
    });
  });

  describe("getListenerIds", () => {
    it("should return array of listener IDs", () => {
      manager = new SystemEventManager(eventBus, handlers);
      const ids = manager.getListenerIds();

      expect(Array.isArray(ids)).toBe(true);
      expect(ids.length).toBeGreaterThan(0);
      expect(ids.every(id => typeof id === 'string')).toBe(true);
    });

    it("should return copy of array, not reference", () => {
      manager = new SystemEventManager(eventBus, handlers);
      const ids1 = manager.getListenerIds();
      const ids2 = manager.getListenerIds();

      expect(ids1).not.toBe(ids2);
      expect(ids1).toEqual(ids2);
    });
  });

  describe("priority execution order", () => {
    it("should execute system listeners before user listeners", () => {
      const executionOrder = [];

      // Register user listener first
      eventBus.subscribe('dragStart', () => {
        executionOrder.push('user');
      }, { priority: 90 });

      // Then create system manager (which registers system listeners)
      manager = new SystemEventManager(eventBus, {
        ...handlers,
        startWindowDrag: () => {
          executionOrder.push('system');
        }
      });

      eventBus.emit('dragStart', {});

      expect(executionOrder).toEqual(['system', 'user']);
    });

    it("should execute in correct order with multiple user rules", () => {
      const executionOrder = [];

      eventBus.subscribe('click', () => executionOrder.push('user-high'), { priority: 90 });
      eventBus.subscribe('click', () => executionOrder.push('user-low'), { priority: 10 });

      manager = new SystemEventManager(eventBus, {
        ...handlers,
        openPanel: () => executionOrder.push('system')
      });

      // Click settings button - system handler will execute
      eventBus.emit('click', { target: { id: 'settings-button' } });

      // System blocks propagation, so only system executes
      expect(executionOrder).toEqual(['system']);
    });
  });
});
