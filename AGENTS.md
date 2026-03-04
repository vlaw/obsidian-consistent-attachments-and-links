# AGENTS.md - Development Guide for Consistent Attachments and Links

This document provides essential information for agentic coding agents working on this Obsidian plugin.

## Project Overview

This is an Obsidian plugin that ensures consistency of attachments and links in your vault. It converts wikilinks to markdown links, manages attachment locations, and maintains relative paths.

## Build, Lint, and Test Commands

### Build Commands

| Command | Description |
| ------- | ----------- |
| npm run build | Full build (compile + bundle) |
| npm run build:clean | Clean build |
| npm run build:compile:typescript | Compile TypeScript only |
| npm run dev | Development mode with watch |

### Lint Commands

| Command | Description |
| ------- | ----------- |
| npm run lint | Run ESLint |
| npm run lint:fix | Run ESLint with auto-fix |
| npm run lint:md | Lint markdown files |
| npm run lint:md:fix | Fix markdown lint issues |

### Format Commands

| Command | Description |
| ------- | ----------- |
| npm run format | Format code with Prettier |
| npm run format:check | Check formatting without changes |

### Other Commands

| Command | Description |
| ------- | ----------- |
| npm run spellcheck | Run spell checker |
| npm run commit | Create commit with commitizen |

**Note:** This project has no test framework.

## Code Style Guidelines

### TypeScript Configuration

The project uses `@tsconfig/strictest` with these key settings:

- `verbatimModuleSyntax` - Requires `import type` for type-only imports
- `noImplicitAny` - Strict type checking enabled
- `moduleResolution: NodeNext` - Modern Node.js module resolution

### Import Organization

Imports must be organized in order (separated by blank lines):

1. **Type imports** - `import type { ... } from '...';`
2. **Obsidian imports** - `import { ... } from 'obsidian';`
3. **obsidian-dev-utils imports** - `import { ... } from 'obsidian-dev-utils/...';`
4. **External libraries** - `import { ... } from 'external-lib';`
5. **Local relative imports** - `import { ... } from './...';`

```typescript
import type { SomeType } from 'some-module';
import { Notice, TFile } from 'obsidian';
import { someFunction } from 'obsidian-dev-utils/obsidian/FileSystem';
import { externalFunction } from 'external-lib';
import type { Plugin } from './Plugin.ts';
import { SomeComponent } from './components/SomeComponent.ts';
```

### Type-Only Imports

Always use `import type` for types and use `import` for values:

```typescript
// Good
import type { TFile } from 'obsidian';
import { Notice } from 'obsidian';
```

### Naming Conventions

| Element | Convention | Example |
| ------- | ---------- | ------- |
| Classes | PascalCase | `class Plugin`, `class LinksHandler` |
| Interfaces | PascalCase | `interface LinksAndEmbedsChangedInfo` |
| Methods | camelCase | `public async checkConsistency()` |
| Properties | camelCase | `private readonly cache` |
| Private fields | underscore prefix | `private _internalState` |
| Files | kebab-case | `links-handler.ts` |
| Folders | kebab-case | `Commands/`, `Modals/` |

### Type Annotations

Always use explicit type annotations for function parameters and return types:

```typescript
public async checkConsistency(): Promise<void> {
    const result: ConsistencyCheckResult = new ConsistencyCheckResult('title');
    return result;
}
```

### Error Handling

- Use `try/catch` with meaningful error messages
- Use Obsidian's `new Notice()` to display errors to users
- Allow operations to continue on non-critical errors using `shouldContinueOnError: true`
- Use `abortSignal` for cancellable operations

### Async/Await Patterns

- Always use `async/await` over raw promises
- Use `obsidian-dev-utils` utilities like `loop()` for batch processing

```typescript
await loop({
    abortSignal: this.abortSignal,
    buildNoticeMessage: (note, iterationStr) => `Processing ${iterationStr}`,
    items: getMarkdownFilesSorted(this.app),
    processItem: async (note) => { /* ... */ },
    progressBarTitle: 'Processing...',
    shouldContinueOnError: true,
    shouldShowProgressBar: true
});
```

### ESLint Rules

- `import-x/no-default-export` - Generally prohibited (Obsidian main.ts is excepted)
- `import-x/order` - Enforce import ordering (as specified above)

Use `// eslint-disable-next-line` sparingly:

```typescript
// eslint-disable-next-line import-x/no-default-export -- Obsidian requires default export
export default Plugin;
```

### Git Conventions

- Use conventional commits: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`
- Run `npm run commit` for interactive commit creation
- Husky pre-commit hooks are enabled

### Obsidian Plugin Patterns

1. **Entry Point** - `src/main.ts` exports default Plugin class
2. **Settings** - Use `PluginSettingsManager` for settings management
3. **Commands** - Register commands in `Plugin.addCommand()`
4. **File Operations** - Use obsidian-dev-utils helpers (`getMarkdownFilesSorted`, `createFolderSafe`, etc.)
5. **Modals** - Use `alert()` from obsidian-dev-utils for simple dialogs

### Debugging

Enable debug output in Obsidian console:

```javascript
window.DEBUG.enable('consistent-attachments-and-links');
```

### Key Dependencies

- `obsidian` - Obsidian API
- `obsidian-dev-utils` - Utility library for Obsidian plugins
- `obsidian-typings` - Type definitions
- `@tsconfig/strictest` - Strict TypeScript config

### File Structure

```text
src/
├── main.ts                    # Entry point
├── Plugin.ts                  # Main plugin class
├── PluginTypes.ts             # Type definitions
├── PluginSettings.ts          # Settings interface
├── PluginSettingsTab.ts       # Settings UI
├── PluginSettingsManager.ts   # Settings management
├── links-handler.ts           # Link processing logic
├── files-handler.ts           # File operations
├── AttachmentCollector.ts     # Attachment collection
├── styles/main.scss           # Styles
├── Commands/                  # Command implementations
├── Modals/                    # Modal implementations
└── i18n/locales/              # Translations
```