# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Multi-language support (English and Chinese)
  - Language switcher in System settings
  - Automatic language detection based on browser/system locale
  - Translatable UI for panel and pet window
- Internationalization (i18n) system with parameter interpolation
- Language preference saved in configuration

### Changed
- System settings panel now includes language selection dropdown
- Panel and pet window titles now respect selected language
- Tab labels and system settings are now translatable

## [0.1.0] - 2026-06-21

### Added
- Initial release of Desktop Pet client
- Core features:
  - Cross-platform Electron desktop pet application
  - Custom petpack import/export (.petpack format)
  - Multi-state animation support (idle, walk, drag, click, etc.)
  - Rule engine with trigger-action system
  - Interactive control panel for configuration
  - Drag and drop pet positioning
  - System tray integration
  - Window always-on-top support
- Security features:
  - Path traversal protection
  - File size limits (50MB per file, 200MB total import)
  - ZIP bomb protection
  - Symlink detection
  - IPC channel whitelist
  - Context isolation enabled
  - Content Security Policy (CSP) headers
- Performance optimizations:
  - Event throttling for high-frequency events (mousemove)
  - Efficient asset loading and caching
- Testing:
  - 125 unit tests covering core functionality
  - E2E smoke tests for Electron app launch
  - CI-friendly test configuration
- Documentation:
  - Comprehensive README with quick start guide
  - User guide for creating custom petpacks
  - Product requirements document (PRD)
  - Release checklist

### Security
- Content Security Policy added to all renderer processes
- Path safety validation for all file operations
- Sandboxed renderer processes with context isolation
- IPC communication restricted to whitelisted channels

### Development
- Vitest for unit testing
- Playwright for E2E testing
- Vite for build tooling
- Electron Builder for packaging
- GPL-3.0 license

[0.1.0]: https://github.com/yourusername/desktop-pet/releases/tag/v0.1.0
