# Costs and when not to use Produktiv

## What it costs

Every command loads workflow instructions before it works on your request: shared policies, the references it needs and, for reviews, the review criteria. That context is read on each call, so a run uses noticeably more tokens and time than asking the agent directly. Reviews add more, and a fresh reviewer subagent, when the host offers one, repeats part of the reading.

The process has its own cost too. A full route writes an Issue, sometimes a Spec, a Plan and review reports, and each one asks you to read and decide something.

What you can control:

- **Cost profile.** `cost.profile` in `.workflow/config.yaml` (`lean`, `balanced`, `high-assurance`) sets how readily commands spend on optional work such as web research, a browser, a broader test suite or an extra specialist. You can override it for yourself with `cost_override` in `.workflow/local/preferences.yaml`. No profile skips a check a command needs to finish its job.
- **Where you start.** Calling a later stage directly skips the earlier ones. A decided request can start at `/pk-to-plan`.
- **The fast path.** `/pk-implement` on a small, fully stated change runs without a Plan or a separate review.

## When not to use it

- **A small, local fix you could describe in one sentence.** Work with the agent directly, or use the `/pk-implement` fast path, which still runs your project's checks.
- **Exploratory spikes and throwaway code.** If nothing will be kept, the artifacts have no reader.
- **A project without tests, lint or typecheck commands.** The gate and the reviews can only check what the repository defines. Produktiv will tell you a check is missing, but it will not make one up.
- **When you need a hard budget.** The cost profile changes willingness to spend, not a ceiling. Commands with a required check run it on every profile.
- **Windows.** It is not tested, and the graph and diagram runtimes are not supported there.

It is built for changes where a wrong decision is costly to undo: unclear requirements, changes to data or contracts, work split across sessions or people, and features that need a review before merge. Whether the overhead is worth it for your project is something to judge from a few real tasks.
