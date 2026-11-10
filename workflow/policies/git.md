# Git

Ticket, session, commit, and pull request (PR) are different boundaries.

| Boundary | Meaning |
|---|---|
| Ticket | One execution slice. It is not a session, a commit, or a pull request. |
| Session | One working context. It is not a commit. |
| Commit | One snapshot of verified work on a branch. |
| Pull request | A review request. It is not created by finishing a slice. |

`/pk-implement` reads `git.workflow` from `.workflow/config.yaml` (`git.workflow`). The template default is `none`. A missing value is `none`.

## When the slice is verified

| `git.workflow` | Result |
|---|---|
| `none` | After the selected execution boundary is complete, leave the working tree dirty and report the trailers below for whoever commits. |
| `current-branch` | One commit on the current branch, after the single completion assessment and verified reconciliation of its material findings. |
| any other value | Do not invent a branch, a worktree, or a pull request. After execution closure, leave the tree dirty and report the value. |

Git policy is a delivery action after implementation, evidence and completion review. It never turns completion of one internal unit into the end of an explicit grouped Ticket or whole-Plan request.

`current-branch` means the branch that is already checked out. It does not mean a new branch, a worktree, a stacked pull request, or trunk choreography. Those remain the project's own workflow. This command does not start them.

## The one commit

The commit is the verified slice, made once, after required evidence and reconciliation of the single completion review. Targeted tests/inspection close fixes; no second clean-review verdict is needed. It includes every plan step that this run verified. It is not one commit per step, per file, or per ticket.

Before the first edit, record the uncommitted diff from HEAD of every path this slice will change, including staged changes and untracked content. That baseline is earlier work. Keep it in the session.

Commit the changes made after that baseline. A path that was clean then may be staged by path. A path that already differed from HEAD must not be staged by path: the whole file would put the earlier edits into the commit with the slice. Stage only the hunks that were not in the baseline. When a slice edit and an earlier edit cannot be separated, do not stage the path, do not commit, and report the path. The earlier edits stay in the working tree.

Do not stage any other dirty path. Do not commit `.workflow/local/`, `.workflow/graph/`, `.workflow/cache/`, or `.workflow/handoff.md`.

Use the repository's commit convention when one is visible. Otherwise use a concise subject that says why. End the message with the trailers that apply, one per line: `Produktiv-Feature: <feature>`, `Produktiv-Unit: <Plan units, such as U1, U3>`, `Produktiv-Ticket: <slice>`. Unit and Ticket need Feature. Keep them in the final paragraph. A repository rule against trailers wins; report that they were left out. A squash merge keeps only the final paragraph, so for a squashed pull request suggest ending its description with the same lines. Do not change Git identity. Do not skip hooks. Do not amend. Do not push. If the verified slice is already that one commit, do not add another. If the commit fails, stop and report it.

A blocked or incomplete slice is not verified. Do not commit it.

No worktree is required. Do not create one to implement, to test, or to commit.
