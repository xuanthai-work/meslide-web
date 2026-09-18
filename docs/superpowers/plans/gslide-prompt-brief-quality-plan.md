# GSlide Prompt Brief Quality Upgrade

- Date: 2026-09-11
- Status: Complete
- Scope: `gslide-api` prompt rewrite quality; existing `gslide-web` contract remains unchanged

## Goal

Turn the rewrite step from a shallow paraphraser into a presentation-brief
compiler. A terse source prompt should give the downstream outline model clear
objectives, audience assumptions, coverage, narrative direction, and factual
quality constraints without asserting unsupported facts.

## Product contract

- Keep `POST /api/v1/ppt/prompt/rewrite` and `{ rewritten_prompt }` unchanged.
- Keep the rewritten prompt read-only in the current upload UI.
- Never produce a slide-by-slide outline in this step.
- Preserve user intent, named entities, dates, numbers, and explicit constraints.
- For sparse input, add safe presentation defaults and research questions, not
  factual claims.
- For already detailed input, organize and clarify rather than expanding for
  length.
- Do not use tools, web search, memory, reasoning, or database persistence.

## Implementation

### Task 1: Brief-compiler prompt

- [x] Replace paraphrase-oriented instructions with explicit success criteria.
- [x] Define sparse and detailed input behavior separately.
- [x] Require objective, audience, coverage, narrative, and evidence guidance
  for sparse prompts.
- [x] Add Vietnamese and English few-shot examples, including an unfamiliar
  named entity.
- [x] Keep source content delimited as untrusted quoted data.

### Task 2: Deterministic quality gate and repair

- [x] Detect shallow output for sparse input using language-independent word
  and expansion checks.
- [x] Detect loss of important numeric/alphanumeric identifiers such as years,
  metrics, and product names containing digits.
- [x] Retry exactly once with a repair prompt containing the failed output.
- [x] Reject a second low-quality result with a coded client-safe error.
- [x] Log only reason codes and lengths, never prompt text.

### Task 3: Tests and verification

- [x] Add prompt-contract tests for sparse, detailed, language, examples, and
  prompt-injection behavior.
- [x] Add unit tests for quality decisions and identifier preservation.
- [x] Add first-pass repair, failed-repair, and no-unnecessary-repair tests.
- [x] Re-run OpenAI, Google, and custom-provider dispatch coverage.
- [x] Run prompt rewrite, dispatcher regression, Ruff, frontend API contract,
  typecheck, and production build checks.

## Acceptance examples

For `Tạo giúp tôi 1 bài thuyết trình về 9router`, the result must do more than
prepend “Hãy tạo”. It should instruct outline generation to establish what
9router is, the problem and audience it serves, important capabilities and
workflows, use cases, differentiators, limitations, and a useful conclusion.
Those are research/coverage requirements, not claims that 9router has any
specific feature.

For a detailed source containing a fixed audience, slide count, dates, and
metrics, the result must preserve those constraints and should not add generic
sections merely to reach a target length.

## Definition of done

- [x] The shallow output shown in the reported screenshot triggers repair.
- [x] A repaired high-signal brief is returned through the unchanged API.
- [x] Weak providers cannot silently return a second shallow paraphrase.
- [x] Detailed prompts are not mechanically inflated.
- [x] Automated backend and frontend regression checks pass.
