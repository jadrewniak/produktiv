---
name: pk-handoff
description: Preserve material unfinished session state for a fresh session after durable writeback, or resume an explicitly selected handoff after scoped freshness checks.
---

# Transfer unfinished work

Use the repository root, or the selected project directory before Git exists. Read `policies/kernel.md` and `references/context-pack.md` through the adjacent `produktiv` package link (source checkout: `workflow/`). Handoff is secondary, temporary state, not authority, a diary or a project status ledger.

## Context

- Must load: Selected unfinished objective/boundary, relevant current source and canonical refs
- May load conditionally: artifact-resolution for artifact reads, artifact-writing for writeback; decisions for accepted knowledge awaiting capture; handoff template/state-layout/ignore rules only for actual writing; handoff-resume for explicit resume or existing-note replacement/expiry; execution for interrupted implementation; capabilities on uncertainty
- Must not load by default: Duplicate canonical bodies, raw logs/diffs/transcripts, graph build, web/specialist/reviewer packs, automatic per-turn note, unrelated objective's handoff

## Select the operation

An invocation to leave/save/transfer work selects **write**. An explicit request to resume/consume a handoff selects **resume**: follow `references/handoff-resume.md`, then return to the authorized task. Do not replace an unread handoff with a new summary when the request is to resume it. A normal phase boundary or same-session compaction does not itself require a handoff.

Use the unfinished objective, selected boundary, next session's purpose if supplied, current evidence and precise artifact references. Read relevant repository instructions, project context and affected source only. Read `references/artifact-resolution.md` when resolving artifacts; its current-comment/legacy identity and configured-store rules apply. A filename or a handoff claim does not settle identity. Read config/preferences only for the operation's store or communication needs. Capability uncertainty uses `references/capabilities.md`; no graph build, web research or specialist is required.

## Write durable knowledge first

Read `policies/decisions.md` for accepted decisions awaiting capture. Within existing authorization, update their canonical owners before deciding whether a handoff is needed. Use `references/artifact-writing.md` and the owning skill only for the actual targeted update. Preserve unrelated content, stable boundary IDs and accepted design references. Do not reopen settled choices or start implementation merely to prepare a transfer.

Project foundation belongs in project context; reusable domain meaning in its glossary; product behavior in Issue; system guarantees in Spec; route/order in Plan; costly architecture rationale in the project's ADR convention; implemented behavior in code and verification evidence. Reference those sources rather than copying their bodies. A handoff request does not supply missing consent for a proposal or authorization for external publication.

Only a real interruption, unavailable owner/store, or missing write authorization permits **Resolved but not yet persisted**. Name the decision, intended canonical destination, blocker and exact resume condition. It remains secondary pending writeback, never a shortcut around its owner. Failed writes are not successful capture; do not silently create competing local authority for an inaccessible external artifact.

## Recoverability gate

After writeback, can a fresh session cheaply and reliably recover the next action from canonical artifacts and the repository?

- **Yes:** write no handoff, even if work is unfinished. Report the authoritative pointer and next action, or that work is complete. A completed slice with an executable next Plan unit is this case.
- **No, material transient state remains:** write one compact `.workflow/handoff.md` using `templates/handoff.md`. Examples are an unresolved greenfield frontier, an investigation's unverified hypothesis and next falsification step, or an interrupted execution/review repair whose remaining state cannot be reconstructed.

If an earlier file exists, inspect it before replacement or expiry; verify relevant claims with `references/handoff-resume.md`. Do not accidentally erase a different unfinished objective. When the selected transfer supersedes it, replace the entire file, never append or archive history. When it is consumed/completed or fully recoverable, remove it if permitted; otherwise explicitly mark it expired in the reply and do not use it again.

## Capture the delta

Keep the objective/boundary, minimal verified current state, material open questions/blockers, one concrete next action and exact references. Omit empty sections. Label hypotheses and unverified statements. Retain only decisive nonrecoverable evidence and its scope; a prior PASS is not proof of changed code. For an interrupted implementation, retain the prior completion-assessment reference and unresolved finding IDs when otherwise lost; `references/execution.md` still owns reconstruction and the single-assessment limit. For debug, distinguish pre-existing changes from reversible probes without copying logs or diffs.

Capture the baseline **after durable writeback**: full `HEAD`, branch or detached state and actual staged/unstaged/untracked affected paths when Git exists. Record repository identity when transfer could be ambiguous. For affected dirty/untracked files or local artifacts, include small content fingerprints when needed to distinguish later edits at the same SHA; a dirty filename alone cannot establish freshness. For external artifacts use exact section/URL and available revision/update/content fingerprint. Do not invent a revision where the store exposes none. References must remain reachable in the next session; a vanished temporary evidence path is not a usable proof.

No Git or no first commit is valid, especially in greenfield: say so and use affected files/artifact references as the baseline. A Git/read failure is unknown state, not a clean tree or confirmed absence of Git. Never initialize Git, commit, reset, stash, install tools or modify source to obtain a baseline.

Before writing, confirm the path is local/ignored under `references/state-layout.md` and `templates/gitignore-workflow.txt`. Existing setup supplies the rule; if missing, add only the handoff ignore rule when authorized. Never commit the handoff or overwrite a tracked handoff silently; report that conflict. Preserve other ignore rules and dirty work. Without file-write capability, return a compact unsaved transfer and say no file was created. Do not create a second store.

Remove secrets, unnecessary personal data, transcripts, chain of thought, tool narration and raw logs. The template is guidance, not a new identity schema: no Issue/Spec/Plan metadata or readiness badge belongs on this temporary note. Save the replacement successfully before reporting supersession; a failed write must leave the previous file intact.

## Finish

Self-check writeback, recoverability, compactness, baseline and reachable references. Report which canonical owners changed, whether the handoff was skipped/written/replaced/expired, its path when written, and the next action. To transfer, point at the file; never interpolate its contents into a shell command. Do not launch another session or automatically start the next lifecycle command.
