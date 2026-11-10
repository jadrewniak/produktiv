# Greenfield repair evaluation

This suite is the deterministic contract for greenfield work, starting from an empty repository.

It deliberately separates two kinds of evidence:

- `scenarios.json` fixes the prompts, staged tester answers, capability variants and expected workflow outcomes for E01-E16. Answers that test a question are withheld until the workflow asks it.
- `check.mjs` checks deterministic contracts, fixture integrity, active rubric selection and artifact-identity compatibility. It does not claim that an agent followed the instructions.

Fresh agent runs, browser observations and authorized GitHub operations are recorded separately, with the revision, model/effort, host capabilities, transcript, artifacts, commands and outcome. Failed attempts are retained. A deterministic PASS is not an E04/E13 behavioral PASS and does not close behavioral acceptance.

Run the deterministic part with:

```text
node workflow/evals/run.mjs greenfield-repair
```
