---
name: discuss
description: Use when a non-trivial decision needs deep deliberation grounded in the project's full canonical context. Loads all canonical project docs, states the frame (target user, binding constraints, what's already decided), then enters open conversation with the user. This is a context-loading skill, not an output-producing one.
tags: [deliberate, propose, planning, meta]
---

# Discuss — Awareness Loading

Pre-spec deliberation. Heavier than `brainstorming`, lighter than spec authoring. Use when a decision needs to be reasoned about against everything the project has already committed to, before locking anything in.

This skill loads context and states the frame. It does not produce a templated deliverable — what happens after the frame is stated is normal conversation with the user, shaped by whatever the topic needs.

## When to use vs adjacent skills

| Situation | Use |
|---|---|
| "What are we even building?" — open exploration | `brainstorming` |
| "I need to think this through against what we've already decided" | **`discuss`** (this skill) |
| "We've decided — write it down" | spec / plan authoring |

## Protocol

1. **Resolve the topic.**
   - If `$ARGUMENTS` is non-empty, that is the topic.
   - If empty, scan for pending decisions and present a numbered menu (max ~8), in this order:
     - `docs/superpowers/specs/*.md` with no matching `docs/superpowers/plans/*.md` — decided but unplanned.
     - `docs/superpowers/plans/*.md` — in-flight work that may need re-deliberation.
   - If neither yields anything, ask the user to name a topic. Do not invent one.
   - Do not proceed until a topic is chosen.

2. **Load canonical context.** Read every file that exists from this fixed list. Do not glob `docs/**`. Do not load project-specific doc roots.

   | Doc | Role | Required |
   |---|---|---|
   | `docs/overview.md` | Product context, target users, boundaries | yes |
   | `docs/techstack.md` | Architecture rules, patterns, tech choices | yes |
   | `docs/specs/*.md` | Product/feature specs | load all that exist |
   | `docs/superpowers/specs/*.md` | In-flight design specs (temporal) | load if present |
   | `docs/superpowers/plans/*.md` | In-flight implementation plans (temporal) | load if present |

   If `docs/overview.md` or `docs/techstack.md` is missing, stop and tell the user to bootstrap the project (e.g. `sp-bootstrap`). Do not improvise substitutes.

3. **State the frame.** Before any back-and-forth, surface explicitly:
   1. **Target user(s)** — extracted from `docs/overview.md`. If overview does not name one, ask the user before proceeding.
   2. **Binding constraints** — architecture rules from `docs/techstack.md`, product non-negotiables from `docs/overview.md`, overlapping in-flight work from `docs/superpowers/`.
   3. **What's already decided** — any existing spec or plan touching this topic, so the discussion does not unintentionally relitigate settled ground.

   The frame is the only required output of this skill. Keep it tight — a handful of bullets.

4. **Enter conversation.** Once the frame is stated, hand control back to the user. Respond to whatever they bring, grounded in the loaded context. No templated output, no forced "Options" table, no forced "Recommendation" — let the shape of the discussion follow the topic.

   When useful (not always), draw on these lenses as thinking aids:

   | Lens | Question |
   |---|---|
   | **Product** | Does this serve the target user's core needs? What does it kill or defer? |
   | **UX** | Empty states? Error states? Dead ends? Misuse loops? Can the user get stuck? |
   | **Technical** | What does the current architecture support? What's hard vs easy? Cross-cutting impact? |
   | **Business / Cost** | Build cost, ongoing cost, complexity tax. Retention/conversion if applicable. |

## Rules

- **Docs are the source of truth.** If memory contradicts a loaded doc, trust the doc.
- **Ground every claim in the loaded context.** No floating opinions. If something isn't in the docs, say so explicitly rather than improvising.
- **Challenge the premise.** If the topic contradicts `docs/overview.md` or `docs/techstack.md`, surface the conflict immediately.
- **No project-specific doc roots.** Never hardcode `docs/foundations/`, `docs/engineering/`, or any other repo-bespoke path. Canonical structure only.
- **No glob-the-world.** Do not scan `docs/**/*.md`. The fixed list in step 2 is the contract.
- **Stop if required context is missing.** Do not improvise substitutes for `docs/overview.md` or `docs/techstack.md`.
- **No prescribed output format.** The frame is required; everything after is conversation.
- **Read-only.** This skill loads context and reasons. It never writes specs, plans, or code.
