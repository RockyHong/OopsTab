🎨 OopsTab UI Style & Component Spec

Version 1.0 — Focus: Styling, Theme, and Frontend Implementation

⸻

🌱 Visual Identity & Design Tone

Tone & Personality:
Clean, friendly, soft, and slightly playful. A tool-like but emotionally warm visual experience. The UI should feel lightweight and unintimidating, with enough visual personality to feel modern and crafted.

Font System:
• Headings: Outfit
• Body Text: Roboto
Use consistent font sizing and spacing based on Material Design typography guidelines.

⸻

🎨 Color Palette

Colors are based on a soft green-themed identity, evoking calm reliability with a hint of liveliness.

Color Use HEX Tailwind Alias Suggestion
Primary #328E6E primary
Secondary #67AE6E secondary
Accent #90C67C accent
Background #E1EEBC bg-muted or surface
Danger #EF4444 Tailwind default red-500
Passive Button #E5E7EB Tailwind gray-200

Use Tailwind’s extend.theme.colors to register these as semantic tokens for consistent use in components.

⸻

🧩 Component Guidelines

1. Button Component

Use three types of buttons:

🔹 Primary Button (Call to Action)
• Background: #328E6E
• Text: white
• Rounded: rounded-md
• Hover: Slight darken (hover:bg-[#2B7C60])
• Use: Snapshot, Confirm

🔸 Passive Button (Neutral/Info)
• Background: #E5E7EB (gray-200)
• Text: #374151 (gray-700)
• Use: Open snapshot, View details

🟥 Danger Button (Destructive)
• Background: #EF4444
• Text: white
• Hover: hover:bg-red-600
• Use: Delete all snapshots, Reset config

All buttons:

<button className="px-4 py-2 rounded-md text-sm font-medium transition-all shadow-sm">

⸻

2. Card Component
   • Padding: p-4
   • Rounded: rounded-lg
   • Background: bg-white
   • Shadow: shadow-md
   • Spacing between elements: gap-2 or gap-4
   • Card content should follow a column flex layout

<div className="bg-white rounded-lg shadow-md p-4 flex flex-col gap-4">

Optional props: variant (e.g., highlighted, inactive), hoverable

⸻

3. Modal Component
   • Use Dialog from @headlessui/react or MUI Dialog if accessibility is needed fast.
   • Background overlay: rgba(0, 0, 0, 0.5) (bg-black bg-opacity-50)
   • Modal box: rounded-xl bg-white p-6 shadow-xl
   • Animation: Fade in/out (@tailwindcss/animate or framer-motion)

Use modal for confirmation, settings, delete actions.

⸻

4. Typography Scale

Text Type Font Size Weight Use Case
Heading 1 Outfit text-xl 600 Section titles
Heading 2 Outfit text-lg 500 Card titles
Body Roboto text-sm 400 Main content
Caption Roboto text-xs 400 Tooltips, metadata

⸻

🧩 UI Components Overview

Component Description
Button Semantic types (primary/passive/danger), size: medium
Card Reusable container for snapshot preview, info blocks
Modal Used for alerts, confirmations, settings
List Item Snapshot entry with metadata (timestamp, tab count)
Toggle For settings (e.g., auto-snapshot on/off)
Icon Button For small actions (e.g., delete, view details) with Heroicons (solid)
Loader/Spinner Use Tailwind animate plugin or shadcn/ui spinner

⸻

🧱 Spacing, Radius, and Layout
• Spacing System: Use Tailwind’s 4-based spacing (e.g., p-4, gap-4)
• Border Radius: Standard rounded-md, slightly softened but not pill/capsule shaped.
• Shadow: Use shadow-sm, shadow-md, shadow-lg based on elevation hierarchy.
• Grid/Flexbox: Prefer flex layouts (flex-col, gap-x-4, etc.) over rigid grid unless needed.

⸻

🛠 Implementation Notes
• Use Tailwind’s @apply sparingly in reusable components.
• Prefer creating base components like <PrimaryButton />, <Card /> as composables.
• Use shadcn/ui for non-critical UIs like Switch, Dialog, Tooltip.
• Avoid inline styles due to Manifest V3 constraints.
• Bundle Tailwind output via PostCSS (tailwind.css → dist/styles.css).
• Consider enabling darkMode: false for now in Tailwind config (can expand later).

⸻

🔗 Iconography
• Use Heroicons (Solid) via @heroicons/react/solid
• Size standard: h-5 w-5 (small buttons), h-6 w-6 (normal action)
• Use for actions like restore, delete, settings, info, etc.

⸻

✅ Final Notes for Engineers
• Follow component-first thinking; all UI should be modular.
• Use theme tokens for colors, spacing, and radii to ensure consistency.
• Prioritize clarity, hierarchy, and gentle visual feedback (hover, focus, animation).
• Avoid excessive decoration; keep it elegant and functional.
• Use external libraries where it meaningfully saves dev time (e.g., headless UI, MUI modals).
