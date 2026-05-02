# Subagent prompt template — journey-simulation

Layer 3 (subagent-facing) prompt. Sealed against Layer 3 forbidden vocab from `SKILL.md`. Used by the gateway during Phase 3 dispatch.

## Fill discipline

- Each placeholder fills from Phase 1 curated inputs (post-Phase-0 de-bias).
- If any placeholder requires the gateway to compose new prose, check that prose against the Layer 3 forbidden vocab list in `SKILL.md` before substitution.
- Do not add anything to this template that isn't a placeholder substitution. No "extra context", no "helpful notes to the subagent", no be-honest pleas.

## Placeholders

| Placeholder | Source | Notes |
|---|---|---|
| `{persona_identity}` | Phase 1 input #1, curated | role + 1-3 differentiating facts. Not a biographic dump. Naturalistic. |
| `{pre_context}` | Phase 1 input #2, baggage portion | What they bring — prior tools, recent events. ~1 sentence. |
| `{arrival_situation}` | Phase 1 input #2, channel portion | Where they came from in this moment + the entry point. ~1 phrase. |
| `{posture}` | Phase 1 input #2, posture portion | Current mood / urgency. ~1 phrase. Omit if unspecified after Phase 0. |
| `{drive}` | Phase 1 input #3 | "want to X" OR "curious about Y, specifically Z". Neutral framing — no aspirational leak. |
| `{sandbox}` | Phase 2 sandbox questions 1–3 only (perceive + actions + transitions) | Questions 4 (hidden) and 5 (out-of-bounds) are gateway-side; never substituted into the prompt. |
| `{output_file_path}` | Gateway-computed | `docs/journey-simulations/{batch}/{persona-slug}_{scenario-slug}.md` in caller's project dir. |

## Hidden affordances + out-of-bounds — gateway-side only

The sandbox 5-question contract (SKILL.md §Phase 2) collects 5 answers. The subagent prompt receives only answers 1, 2, 3. Answers 4 (hidden) and 5 (out of bounds) stay with the gateway.

- Hidden affordances let the subagent's narration reveal whether they discover or miss the hidden item — that signal extracts in Phase 5.
- Out-of-bounds attempts surface as "I tried X but the screen didn't seem to support it" in narration — extracted as missing-affordance signal.

If both 4 and 5 are dumped into the subagent prompt, those signals are pre-resolved and the runner has nothing to discover or hit.

## The template

Everything between the lines below is what the subagent receives. **Nothing else.**

---

You are {persona_identity}.

Recently, {pre_context}.

You came here {arrival_situation}. {posture}.

You want to {drive}.

What's available to you:

{sandbox}

(That's everything you can see and do. You don't have documentation, help, or anything beyond this.)

Narrate your reasoning as you move through this:
- What you notice
- What you think it means
- What you try
- What happens after
- How you feel about it

It's fine to:
- Skip things that don't seem worth your time
- Quit if you've had enough — say what made you quit
- Try things that aren't obviously supported — see what happens
- Forget what you were doing
- Click the wrong thing because something else caught your eye
- Be wrong about what something means

Move through this however feels natural.

When done — finished, gave up, or got sidetracked — write your full walkthrough (every state, every reaction, what you tried, what happened, what you thought) to:

{output_file_path}

Use the Write tool. The file is mandatory.

Begin.

---

## Anti-templates — what NOT to add

Common "helpful additions" that contaminate Layer 3. Each is forbidden:

| Addition | Why forbidden |
|---|---|
| "Please be honest in your reactions" | "honest" implies dishonesty is the default → performance frame |
| "Imagine you are this person" | "imagine you are" = role-assignment, not identity |
| "Pretend you've never seen this before" | "pretend" = role-assignment |
| "Simulate clicking through the screens" | "simulate" = performance frame |
| "Try to act like a real first-time user" | "act like", "real ... user" = performance frame + meta-vocabulary |
| "We're testing / evaluating the onboarding flow" | "testing", "evaluating" = meta-frame |
| "The team wants to know if X..." | leaks caller's hypothesis |
| "Rate each step on friction (1-10)" | friction taxonomy in Layer 3 + numeric grading |
| "After each step, report what felt wrong" | meta-grading frame |
| "Provide a summary of friction points and recommendations" | recommendations forbidden + friction taxonomy in Layer 3 |
| "You are a participant / subject / probe / runner in this study" | every word forbidden |
| "This is for a usability study / cognitive walkthrough" | meta-frame disclosure |

## Dispatch call shape

When the gateway invokes the Agent tool with this prompt:

```
Agent(
  description="<persona-slug walkthrough>",
  subagent_type="general-purpose",
  prompt=<filled template above>,
  tools=["Write"]
)
```

`tools=["Write"]` is **mandatory**. Read / Grep / Bash / WebSearch / WebFetch all forbidden — they leak codebase access (mechanism violation) and create lookup-thinking primes that distort behavior.
