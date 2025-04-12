📐 OopsTab Project Guideline: Type & Style Architecture

⸻

🔤 TypeScript – What to Centralize vs. Separate

✅ Centralize (in /types/ folder or module):

Use when the type is:
• Shared across multiple components or logic layers
• Returned from background script, used in popup/options
• Stored in chrome.storage.local
• Part of a domain model (e.g., snapshot, session, window)

Recommended centralized files:

/types
snapshot.ts → Snapshot, TabMeta, TabGroupMeta
storage.ts → StoredSession, StorageSchema
browser.ts → ChromeWindowWrapper, TabGroupWrapper
ui.ts → ButtonVariant, ThemeColor, LayoutSize
message.ts → Message types between UI ↔ background

Example:

// snapshot.ts
export interface Snapshot {
id: string
tabs: TabMeta[]
createdAt: number
isStarred: boolean
label?: string
}

⸻

✅ Inline Types – Use when:
• Only used inside a single component or function
• Not reused or exported elsewhere
• Keeps the component readable

Example:

type SnapshotCardProps = {
snapshot: Snapshot
onStar: (id: string) => void
}

⸻

🎨 Tailwind + Styling – What to Centralize vs. Embed

✅ Centralize in utility files/configs when:
• You have repeatable visual patterns (e.g., button variants, layout blocks)
• Styling depends on dynamic props (variant, size)
• You want to use design tokens (tailwind.config.js theme extensions)

Centralize in:

/styles
tailwind.config.js → Colors, font, radius, spacing tokens
/components
ui/
Button.tsx → Variant-based tailwind classes
Card.tsx → Common reusable card layouts
/utils
classnames.ts → Class merging logic (e.g., clsx or cn)

Example:

// Button.tsx
const variants = {
primary: "bg-green-600 text-white hover:bg-green-700",
passive: "bg-gray-200 text-gray-700 hover:bg-gray-300",
danger: "bg-red-500 text-white hover:bg-red-600",
}

Use like:

<button className={`${variants[variant]} px-4 py-2 rounded-md`}>Save</button>

⸻

✅ Keep Embedded (inline className) when:
• The style is unique to the component
• You’re working on layout structure
• It improves readability

Example:

<div className="flex flex-col gap-2 p-4 bg-white rounded-md shadow-md">

You don’t need to extract layout classes unless reused often.

⸻

🧩 Class Merging Utilities

Use a class helper like clsx or classnames to make dynamic styling clean:

npm install clsx

import clsx from 'clsx'

<button className={clsx("px-4 py-2", variants[variant])} />

⸻

✅ TL;DR Cheatsheet

Item Centralize? Where
Snapshot / Session types ✅ Yes /types/snapshot.ts
Tab metadata ✅ Yes /types/browser.ts
UI component props ❌ Inline Inside the component
Chrome message/event types ✅ Yes /types/message.ts
Button, Card, Modal base styles ✅ Yes /components/ui/Button.tsx, etc.
Layout structure classes ❌ Inline Inside JSX
Reusable variants/colors ✅ Yes Inside tailwind.config.js and ui/ components
Dynamic class logic ✅ Yes Use clsx in utils or inline
