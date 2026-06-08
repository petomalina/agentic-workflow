---
name: implement
description: >-
  End-to-end feature implementation harness. Grounds in the product bank (bank/),
  studies the codebase to find how to achieve the user's intent, spawns an
  implementation agent team, drives a MANDATORY user-provided test suite to green
  (each test individually, then all in parallel), then loops Claude + Codex code
  reviews with fixes until both reviewers are clean and every test passes. Use when
  the user runs /implement or asks to implement a feature/task and provides the
  tests that must pass. Refuse to start if no tests are provided.
---

# /implement

Implement a user's intent end to end with two nested loops: an **inner test loop**
that drives the user-provided tests to green, wrapped by an **outer review loop**
that runs an independent Claude review and an independent Codex review, fixes every
finding, and repeats until both reviewers are clean and all tests still pass.

```
PRECONDITION: tests provided?  ── no ──▶ STOP, ask the user for tests
        │ yes
        ▼
[1] Ground in the product bank (bank/)
[2] Understand the codebase + how to achieve the intent
[3] Plan the implementation
[4] Spawn the implementation agent team ─────────────┐
        ▼                                            │
[5] INNER LOOP — drive tests to green                │
     run each test one-by-one until each passes      │ (fixes feed
     ▸ then run ALL tests in parallel                 │  back into
     ▸ loop until everything is green together        │  the team)
        ▼                                            │
[6] OUTER LOOP — review until clean ◀────────────────┘
     spawn Claude review  AND  Codex review (always BOTH, every round)
     ▸ merge findings ▸ fix in the main agent
     ▸ rerun the INNER test loop ▸ review again
     ▸ loop until BOTH reviewers report nothing actionable
        ▼
DONE — summarize what changed, tests passing, reviews clean
```

---

## Phase 0 — Hard precondition: tests are required

This skill **cannot run without tests provided by the user.** The tests are the
ground truth for "done."

- The user must supply the tests as part of the invocation — either as test files,
  test commands, or concrete test specifications to write first.
- If the invocation contains **no tests**, do not implement anything. Stop and ask:
  *"This skill requires the tests that must pass. Give me the test files, the test
  command(s), or the concrete test cases (input → expected output) and I'll start."*
- If the user gave test *cases* in prose but not as runnable tests, write them as
  runnable tests **first**, confirm with the user that they capture the intent, and
  treat those as the mandatory suite. (Per project convention: UI tests in
  Playwright, API/logic tests in Go — match whatever the codebase already uses.)

Record the exact command to run each test and the command to run the full suite.
You will run these constantly — capture them once, up front.

---

## Phase 1 — Ground in the product bank (`bank/`)

The `bank/` folder at the repo root is the **product bank** — the source of truth
for *what* is being built and *why*. Read it before touching code.

1. Locate the bank: `bank/` at the repo root (fall back to searching for a `bank`
   directory if it isn't there; if there is genuinely no product bank, tell the user
   and ask where the product context lives).
2. Read the material relevant to the user's request — product specs, intent,
   domain rules, prior decisions, constraints. Skim the index/overview first, then
   read deeply only what touches this task.
3. From the bank, write down in one short paragraph: **the user's intent**, the
   constraints it must respect, and the definition of done. This paragraph is the
   base for everything downstream — every later phase and every review references it.

If the bank and the user's request disagree, surface the conflict to the user before
proceeding.

---

## Phase 2 — Understand the codebase and how to achieve the intent

Figure out *how* the application is structured and *where* the change lands before
writing any code. Use the `Explore` agent (or `general-purpose`) to fan out when the
answer spans many files — keep the conclusion, not the file dumps.

Determine: the entry points and modules the change touches, the existing patterns and
conventions to match, the seams where new code plugs in, and the realistic approach
to satisfy the intent from Phase 1. Confirm the test commands from Phase 0 actually
run in this environment (don't start `air`/`npm run dev` yourself — per project
convention they're already up; only restart if FE/BE is unreachable).

Output of this phase: a concrete approach — which files change, what gets added, and
how the user-provided tests will exercise it.

---

## Phase 3 — Plan

Turn the approach into a short, ordered plan: independent workstreams (so they can be
parallelized across the team), the files each touches, and which of the mandatory
tests each workstream is responsible for turning green. Use `TaskCreate` to track the
workstreams so progress is visible. Keep the plan tight — it exists to split work and
map work to tests, not to document.

---

## Phase 4 — Spawn the implementation agent team

Spawn a **team of implementation agents** to build the plan. Use the `Agent` tool;
launch independent workstreams **in one message with multiple Agent calls** so they
run concurrently. The main agent is the orchestrator/integrator — it does not just
delegate and walk away.

- One implementer per independent workstream from Phase 3 (`subagent_type: claude` or
  `general-purpose`). Give each agent: the Phase-1 intent paragraph, the relevant
  codebase findings, its slice of the plan, the conventions to match, and **the
  specific tests it must make pass**.
- For larger efforts, `TeamCreate` + `TaskCreate`/`SendMessage` can coordinate a
  persistent team; for most tasks parallel `Agent` calls are enough.
- As workstreams complete, the main agent integrates the results into a coherent
  whole and resolves cross-workstream conflicts. Then go straight into the inner loop.

---

## Phase 5 — INNER LOOP: drive the user's tests to green

This loop runs **before** any review and is gated entirely by the user-provided
tests. Never declare implementation done while any provided test fails.

```
repeat:
  # 1. Validate each test individually so each one REALLY works.
  for each provided test:
      run that single test in isolation
      if it fails:
          diagnose → fix (dispatch back to the owning team agent or fix directly)
          re-run just that test until it passes
  # 2. Parallelize when several tests are in play.
  when multiple tests are being worked at once, run them in parallel
  (batch independent tests) to move faster — but a parallel batch does not
  replace confirming each test passes on its own.
  # 3. Final gate: prove the whole suite holds together.
  run ALL tests in parallel
  if anything fails: fix and repeat from step 1
until: every test passes individually AND the full suite passes in parallel
```

Rules:
- **One by one first.** Each test must pass on its own — this proves each piece of
  behavior is really implemented, not accidentally green from another test's state.
- **Parallel when trying many.** When several tests are being iterated, run them
  concurrently to save wall-clock; expand to the full suite for the final gate.
- **All in parallel at the end.** The exit gate is the entire suite passing together
  in parallel — this catches interactions the one-by-one runs miss.
- **Loop until truly green.** No "probably passes." Re-run until the suite is
  actually, observably green. Then proceed to the review loop.

Use `gtimeout` (not `timeout`) on long-running test commands. Don't fake or weaken a
test to make it pass — if a test looks wrong, raise it with the user.

---

## Phase 6 — OUTER LOOP: Claude + Codex review until clean

Once the inner loop is green, review the written code with **two independent
reviewers, every single round** — a Claude (cloud) review agent **and** a Codex
review agent. Then the **main agent** fixes the findings, reruns the inner test loop,
and reviews again. Always run both reviewers again on the next round.

```
repeat:
  # Launch BOTH reviewers in parallel (same message: Agent call + Bash call).
  claude_findings = Agent(subagent_type: claude, "independent code review …")
  codex_findings  = Bash("gtimeout 600 codex exec review --uncommitted")
  merge + dedupe findings; drop anything already addressed or out of scope
  if no actionable findings from EITHER reviewer:
      break        # reviews are clean
  # Main agent fixes every actionable finding.
  fix all findings (dispatch to team agents or fix directly)
  re-run Phase 5 INNER LOOP   # fixes must not break the tests
until: BOTH Claude and Codex report nothing actionable AND all tests pass
```

**Claude (cloud) review** — spawn via the `Agent` tool (`subagent_type: claude`).
Give it the Phase-1 intent, the list of changed files, and the mandate to review for
correctness bugs, security, intent-fit, and convention adherence — and to return a
prioritized, deduplicated finding list with `file:line` references. (You may instead
invoke the `code-review` skill if you prefer its format.)

**Codex review** — run via Bash:
- In a git repo: `gtimeout 600 codex exec review --uncommitted` (or
  `--base <branch>` to review against a branch). Use `--title` to label it.
- Not git-tracked (this repo currently isn't): pass an explicit prompt —
  `gtimeout 600 codex exec "Review these changed files for correctness, security, and
  fit with the intent: <intent>. Files: <list>. Return a prioritized list with
  file:line."`
- Consider running it in the background (`run_in_background: true`) so it proceeds in
  parallel with the Claude review agent, then collect its output.

Optional third opinion: `gtimeout 600 gemini -p "<review prompt>"` (per global
convention, via a sub-agent so it doesn't burn main-context tokens). Keep it optional
— the required reviewers are Claude and Codex.

Review-loop rules:
- **Both reviewers, every round.** Never skip Codex or Claude between iterations.
- **Fix in the main agent**, then re-run the inner test loop before the next review —
  fixes that break tests are not fixes.
- A round counts as clean only when **both** reviewers surface nothing actionable.
  Genuinely-disputable or out-of-scope findings: note them and move on, don't loop
  forever — but the bar is "no real issues remain," not "I'm tired of looping."

---

## Exit criteria (all must hold)

1. Every user-provided test passes individually **and** the full suite passes in
   parallel.
2. A Claude review and a Codex review both report no actionable findings on the same
   round.
3. The implementation matches the intent captured from the product bank in Phase 1.

## Final report

Summarize for the user: what was built, the files changed, the final test result
(suite green in parallel), and that both reviews came back clean — noting any findings
deliberately deferred and why.

---

## Operational notes

- **Tests gate everything.** No tests → don't start. After every fix → rerun tests.
- **Parallelism:** launch independent agents and independent Bash reviews in a single
  message so they run concurrently; batch independent tests.
- Use `gtimeout` instead of `timeout`; double gemini's timeout to 600 if it hangs.
- Don't start `air`/`npm run dev` unless FE/BE is unreachable — assume they're up.
- Match existing code style and conventions; don't add redundant comments.
- Don't weaken, skip, or fake tests to force green — escalate suspect tests instead.
