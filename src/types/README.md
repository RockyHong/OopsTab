# OopsTab Types Architecture

This directory contains centralized type definitions for the OopsTab project.

## Structure

- `index.ts` - Re-exports all types from the other files
- `ui.ts` - UI component, style, and layout related types
- `snapshot.ts` - Snapshot, tabs, and tab group related types
- `storage.ts` - Browser storage and configuration related types
- `browser.ts` - Browser window, tab, and API wrapper related types
- `message.ts` - Message types for communication between UI and background script

## Usage Guidelines

Following the SoCGuide.md recommendations:

### When to centralize types in this directory:

- Types shared across multiple components or logic layers
- Types returned from background script, used in popup/options
- Types stored in chrome.storage.local
- Domain model types (snapshot, session, window)

### When to keep types inline in components:

- Types only used inside a single component or function
- Props types for individual components (unless reused)
- Types not exported/reused elsewhere

## Importing Types

Import types like this:

```typescript
// For multiple types from same file
import { TabData, WindowSnapshot } from "../types";

// For all types (not recommended for most cases)
import * as Types from "../types";
```

## Adding New Types

When adding new types:

1. Determine if the type should be centralized or kept inline
2. Select the appropriate file based on the type's domain
3. Add the type with proper JSDoc comments
4. Re-export the type in index.ts if needed

## Type Organization

- Keep related types together in the same file
- Use interfaces for object types when possible
- Use type aliases for unions, intersections, and simpler types
- Export constants related to types in the same file as the type
