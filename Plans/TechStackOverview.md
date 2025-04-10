🛠️ Tech Stack Overview

Project: OopsTab – Chrome Extension Snapshot Manager
Type: Browser Extension (Manifest V3)
Purpose: Fast, clean, component-driven development of a Chrome Extension UI using modern frontend tools.

⸻

⚙️ Core Frameworks & Tools

1. React
   • Purpose: Component-driven UI architecture.
   • Use Case: Popup UI, options page, modals, cards, reusable elements.
   • Why: Ecosystem maturity, easy component reuse, future scaling potential.

2. TypeScript
   • Purpose: Strong typing and better tooling support.
   • Use Case: All JS logic including background scripts, UI, and browser API handling.
   • Why: Improved maintainability, DX (developer experience), and fewer runtime bugs.

3. Tailwind CSS
   • Purpose: Utility-first styling framework.
   • Use Case: Building consistent, responsive, and themeable UI components quickly.
   • Why: Faster styling process, smaller CSS bundle size, visual consistency.

4. Webpack
   • Purpose: Bundling source files for Chrome Extension.
   • Use Case: Compiling and optimizing ts/tsx, css, html, and asset files.
   • Why: Customizable, stable with extensions, supports multi-entry points (e.g. background, content, popup).

5. WebExtension API
   • Purpose: Access to browser APIs (e.g., tabs, windows, storage).
   • Use Case: Snapshotting tab/window states, syncing session data, restoring tabs.
   • Why: Cross-browser capability (via polyfills), first-class Chrome API support.

⸻

🎨 UI & Design Systems

6. Google Material Design (Design Language)
   • Purpose: Provide clear design principles and visual language.
   • Use Case: General layout, spacing, elevation, feedback patterns.
   • Why: Familiar to users, accessible, scalable across components.

7. MUI (Material UI for React)
   • Purpose: Component library implementing Material Design in React.
   • Use Case: Modals, buttons, inputs, tooltips, dropdowns (as needed).
   • Why: Saves time building accessible components from scratch, good integration with Tailwind (via unstyled mode or hybrid use).

⸻

🧩 Additional Libraries / Plugins (Optional but Recommended)
• @types/chrome or webextension-polyfill-ts: TypeScript typings for WebExtension API.
• shadcn/ui: Headless, tailwind-compatible React components if a lighter alternative to MUI is needed.
• Heroicons (Solid): Icon set for clean, modern iconography.
• @tailwindcss/forms/typography/animate: Tailwind plugins for rapid component styling.
• postcss, autoprefixer: Required by Tailwind for production-ready CSS processing.

⸻

🔌 Architecture Summary

Layer Stack
UI Components React + Tailwind CSS + MUI (selective use)
Styling Framework Tailwind CSS, themed using design tokens
State & Logic TypeScript + browser extension APIs
Background/Worker Manifest V3 Service Worker + WebExtension APIs
Build Tool Webpack (multi-entry: background, popup, content, options)
Icons Heroicons (Solid)
Design System Google Material Design (conceptual)
Component System Reusable React components, optionally using shadcn/ui or MUI

⸻

🧱 Key Design Principles for Development
• Component-Driven: Focus on modular, testable components (Card, Modal, Button, etc.).
• Theme-First: Use a unified color, spacing, and radius system based on Tailwind tokens.
• Minimal UI Framework Lock-in: Prefer Tailwind-based custom components; use MUI only when needed for accessibility/complexity.
• Cross-Browser Compatible: Build on WebExtension standards for future Firefox/Edge support.
