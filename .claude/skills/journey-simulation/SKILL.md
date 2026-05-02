---
name: journey-simulation
description: Use when caller wants to observe how a stranger encounters a flow, artifact, or sandbox — triggers like "simulate a user journey", "test our onboarding / checkout / signup", "will my ICP convert", "how does a cold reader experience this README", "first-time user test", "cognitive walkthrough", or any request to evaluate friction from a non-builder perspective.
---

# journey-simulation

## Overview

Spawn an isolated subagent to **execute a real task** given identity-as-fact briefing + sandbox spec. Subagent never knows it's observed. Gateway (you) extracts friction post-hoc from the subagent's narration.

What this produces: **archetype retrieval from the LLM prior** encountering a described sandbox. Caller declares the vector (identity + pre-context + drive); the LLM retrieves the character archetype that training-data text patterns associate with that vector. Output ≠ ground-truth real-user testing. Strongest where archetype and lived experience converge (mainstream tech, well-documented behaviours); weakest where they diverge (niche demographics, recent cultural shifts, accessibility, taste). Caller applies judgment.

## When to use

- Caller asks to "simulate a user", "test our flow", "will users get stuck on X", "cognitive walkthrough", "cold-eyes review"
- Pressure-testing a flow before real-user testing or after a redesign
- Reviewing whether a doc / README / game loop / future-self artifact is comprehensible cold

**Skip when:** caller wants ground-truth real-user data (use real-user testing); caller wants design recommendations (this skill observes, doesn't prescribe).

## Mechanism: blind-runner

- **Subagent = operator.** Does the task. Doesn't know it's measured.
- **Gateway = observer.** Reads narration. Extracts friction post-hoc.

Friction taxonomy lives at gateway side. Never in subagent prompt.

**Structural-cue caveat.** Frontier LLMs detect eval-shape from over-precision (extreme specificity, obscure personal history, multi-constraint situations) even when vocabulary is clean. Naturalistic under-specification > sterile precision. Phase 0 step 5 enforces this.

## Phase 0 — Clarify & de-bias

Run before dispatch. Caller-in-loop. **Never skipped.**

1. **Ask:** what artifact, what flow, desired outcome of this test, your concern / hypothesis?
2. **Surface caller's bias:** "you suspect X — the sim must not be primed to find X. Restate inputs in neutral terms."
3. **Ask:** realistic personas (not aspirational ICP)? Skeptic / return / negative cases worth running?
4. **Curate:** strip project jargon, success-bias, design rationale, vision-statement leakage.
5. **Structural-cue check:** if curated persona reads as constructed (over-precise biographic detail, hyper-specific multi-constraint situations, obscure personal history), loosen toward naturalistic under-specification.
6. **Show curated + stripped versions back.** Caller confirms or corrects.
7. **Capture bullseye + hypothesis privately.** Held only by gateway. Never enters subagent prompt.

## Phase 1 — Input contract

Required inputs (free-form shape, must hit minimum bar each):

| # | Input | Minimum bar |
|---|---|---|
| 1 | Persona — identity facts | role + one differentiating trait |
| 2 | Pre-context — channel + posture + baggage | channel + emotional state at t=0 |
| 3 | Drive — goal-or-trigger | "wants to X" OR "curious because Y, specifically about Z" |
| 4 | Sandbox — 5-question contract (Phase 2) | all five answered |
| 5 | Platform | optional |

Gateway-private:
- **Bullseye** — caller's success criterion. **NEVER to subagent.**
- **Hypothesis** — caller's worry. **NEVER to subagent.**

## Phase 2 — Sandbox 5-question contract

Caller answers in any format (prose, table, JSON, scribbles). Gateway checks all five present before dispatch.

1. **What can the runner perceive at each state?**
2. **What can the runner do?**
3. **What happens after each action?**
4. **What's hidden** (won't be told — discoverable via attempt, or missable)?
5. **What's out of bounds** (runner attempting it = friction signal)?

Generalizes across artifacts:
- UI: screens / taps / transitions / hidden gestures / missing affordances
- Game: phases / choices / consequences / hidden balance / undesigned exploits
- README / doc: sections / scroll-skip-search / next-section / builder's mental model / info-not-there
- Future-self review: doc state / re-read attempts / what reminds you / forgotten context / rotted links

If caller cannot answer all five → return to Phase 0. Under-specified sandbox = subagent will hit "out of bounds" frequently (still signal, but degrades to noise if too sparse).

## Phase 3 — Dispatch

**Tool isolation enforced.** Pass `tools: ["Write"]` only when calling the Agent tool. Subagent has NO Read / Grep / Bash. If subagent wants to "look something up", that itself is friction signal (missing affordance / unmet expectation) — captured in narration.

**Identity-as-fact briefing.** Use the template in `subagent-prompt.md` (this directory). Fill placeholders from Phase 1 inputs.

**Drift / abandon allowed.** Subagent prompt explicitly licenses incomplete + irrational behavior, otherwise the LLM defaults to "engaged thoughtful completion-oriented assistant" archetype regardless of declared identity.

**Confirmation checkpoint before dispatch.** Show the caller:
```
Dispatching {N} subagent(s):

1. {persona-slug} — {one-line persona summary}
   Pre-context: {channel + posture}
   Drive: {goal or trigger}
   Sandbox: {state count} states, entry = {first state}

Output: docs/journey-simulations/{batch-folder}/
Go?
```
Wait for caller confirmation before invoking Agent tool.

## Phase 4 — Multi-runner default

- Caller hypothesis is **single-vector-specific** ("does *this* ICP convert?") → single runner is fine.
- Caller hypothesis is **generalization** ("does this work?", "will users abandon?", "is this clear to anyone?") → propose 2-3 **deliberately divergent vectors** (chassis test: hold task + sandbox, vary identity).
- Caller offers single persona but asks generalization → flag the mismatch, propose divergent vectors.
- N=2 same-vector duplicates = redundant. Refuse or restate as N=1.
- **Caller insists N=1 for a generalization claim after the mismatch is flagged** → run it, but reframe the calibration explicitly before dispatch: "this becomes anecdote-grade signal for the named vector, not a generalization answer. The output speaks only for {persona-slug}, not 'users' broadly." Caller must acknowledge the reframe. Do not silently accept the mismatch.

## Phase 5 — Extract

Gateway reads subagent's narration file. Extracts (this taxonomy never appears in subagent prompt):

- **Friction signals** — cognitive overload, unclear affordance, dead end, excessive steps, context loss, unmet expectation, error recovery gap, false bottom, invisible state, missing affordance (out-of-bounds attempt), Other (name it).
- **Mood arc** — trajectory across walkthrough (e.g., curious → annoyed → resigned).
- **Drift events** — where attention shifted off-goal or the runner forgot why they were there.
- **Abandon points** — if any, with what triggered.
- **Bullseye comparison** — runner ended at X. Bullseye was Y. Gap = Z. (Gateway-private; not shown to subagent.)
- **Sycophancy watch** — narration with unrealistic flattery ("design is intuitive!", "this is delightful!") = potential meta-leak (vector got sycophant-archetype-pulled). Tag separately from real friction.

Report structure: friction table + mood arc + bullseye-distance summary + path to raw narration file.

**Do NOT editorialize, soften, or add project context. Do NOT generate design recommendations.** If caller wants recommendations, that is a separate conversation, not this skill's output.

## Output location

`docs/journey-simulations/{flow}_{YYYYMMDD-HHmm}/{persona-slug}_{scenario-slug}.md` in the **caller's project directory** (not the skills repo).

Add `docs/journey-simulations/` to caller's `.gitignore` — these are temporal artifacts, not committed history.

## Layer 3 forbidden vocab — never in subagent prompt

These words / phrases trigger meta-awareness or performance frame:

- simulate, simulation, test, evaluation, study, observation, observe, measurement, grade, rate, rating, score, score X out of Y
- persona, ICP, probe, subject, participant, runner-as-self-label
- friction, cognitive overload, severity, blocker, "report what felt wrong"
- "honestly", "as if", "act as", "pretend", "imagine you are"
- "the developers", "the team", "the product", "we want to know"
- recommendations, suggestions, fixes, "what would improve this"
- skill name "journey-simulation" or any reference to this protocol

## Layer 3 allowed vocab — what subagent prompt may contain

- "you" (self)
- identity-as-fact: "you are X", "you have done Y", "you live in Z"
- situation-as-fact: "you arrived from", "you came here because"
- task: "you want to ___"
- sandbox: "you see ___", "you can ___", "available now"
- standard-agent expectation: "narrate your reasoning as you work" (this is normal agent behavior, not test-frame)

## Rationalization table

Common excuses for skipping or weakening the protocol. All wrong. Rejection in second column.

| Excuse | Reality |
|---|---|
| "Caller's hypothesis is helpful context, subagent should know what to look for" | The hypothesis IS the bias. Subagent told to find X will perform finding X. Bullseye stays gateway-private; comparison happens post-hoc in Phase 5. |
| "'Simulate' is the natural word, no harm in using it" | "Simulate" triggers performance-frame. Subagent shifts from real-task execution to acting. Use identity-as-fact briefing only. |
| "Friction taxonomy in the subagent prompt = cleaner self-reports" | Subagent told it's grading friction = knows it's measured = performs. Friction is observer-side. Subagent never gets the taxonomy. |
| "Caller asked for top-3 fixes, I'll have subagent generate them" | Recommendations from subagent contaminate the observation. Subagent observes; caller decides. Recommendations = separate conversation. |
| "Tool isolation is overkill, the subagent won't actually look at code" | Possessing Read tool primes lookup-thinking even when unused. Strict isolation = mechanism. `tools: ["Write"]` only. |
| "Single persona is fine, the caller said 'typical user'" | "Will typical user abandon" = generalization claim. Single runner = anecdote. Push 2-3 divergent vectors. |
| "Caller insisted on single runner even after I flagged the mismatch — fine, dispatch" | Run it, but reframe expectations explicitly: "this is anecdote-grade signal for {named vector}, not a generalization answer." Caller must acknowledge the reframe before dispatch. Silently accepting the mismatch = caller misreads anecdote as generalization. |
| "Caller already de-biased their request, Phase 0 is overkill" | Caller language carries hypothesis + bullseye + aspirational-ICP every time. Phase 0 surfaces them. Never skip. |
| "Persona richness helps — load up biographic detail" | Over-specification triggers eval-detection (Anthropic 2025 research). Loosen toward naturalistic under-specification. |
| "Adding 'be honest, don't sugarcoat' helps the subagent" | "Honestly" implies dishonesty is the default = performance-frame leak. Forbidden in Layer 3. |
| "Caller wants quantitative scores (abandon %, friction 0-10)" | Quantitative judgments from subagent = performance overhead + false precision. Gateway extracts qualitative signal post-hoc. |
| "I'll tell subagent it's a 'cold first-time user testing the flow'" | Every word of that triggers meta-frame. Just give identity + sandbox + task. Subagent doesn't need to know the framing. |

## Red flags — stop and restart

If any of these appear, **stop and return to Phase 0**:

- Subagent prompt contains any Layer 3 forbidden vocab
- Subagent prompt mentions caller's hypothesis or success criterion
- Subagent prompt asks for scores / ratings / rankings / recommendations
- Tool list passed to subagent includes Read / Grep / Bash / WebSearch / WebFetch
- Phase 0 skipped because "caller's request was clear"
- Single runner dispatched for a generalization claim **without** caller-acknowledged anecdote-reframe
- Persona description is longer than ~3 sentences with hyper-specific biographic detail
- Subagent told it's "testing", "simulating", "evaluating", or "playing the role of"

## What this skill does NOT do

- Generate design recommendations (caller's call after extraction)
- Pass judgment on product strategy
- Propose UI / copy / flow alternatives
- Give the subagent codebase access
- Substitute for real-user testing — it produces archetype retrieval, not real human reaction

## See also

- `subagent-prompt.md` (this directory) — Layer 3 sealed template for Agent dispatch
- Design spec — at the time this skill was authored, captured in `docs/superpowers/specs/journey-simulation.md` of the authoring repo (will not travel with skill on extraction)
