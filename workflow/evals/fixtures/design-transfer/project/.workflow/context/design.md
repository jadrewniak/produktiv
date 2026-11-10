# Accepted visual context — Household Ledger mock

Status: accepted by the explicit synthetic user response on 2026-10-07. Scope is the wallet overview and add-expense visual proposal for this mock only. This records visual presentation; no product Issue/Spec is created or changed, and implementation remains unauthorized.

## Canonical visual reference

[Accepted self-contained HTML](../../docs/design/household-ledger.html) opens directly without a build/server. All required CSS, JavaScript and original SVG icons are inline; no external assets or asset copy is required.

- [Wallet and balance](../../docs/design/household-ledger.html#wallet-overview), [empty list](../../docs/design/household-ledger.html#empty-state), [expense list](../../docs/design/household-ledger.html#expense-list).
- [Add-expense panel](../../docs/design/household-ledger.html#add-expense), [Amount guidance](../../docs/design/household-ledger.html#amount-help), [invalid feedback](../../docs/design/household-ledger.html#amount-error), [success feedback](../../docs/design/household-ledger.html#success-state). Hidden/dynamic states are reached through Add expense, invalid Save, correction/Save and Cancel; anchors identify their source elements, not separate static screens.
- [Compact style guide](../../docs/design/household-ledger.html#style-guide), [palette](../../docs/design/household-ledger.html#palette), [type/spacing](../../docs/design/household-ledger.html#typography), [components/responsive rules](../../docs/design/household-ledger.html#components).

## Accepted presentation rules

Readable system typography, dark ink `#172B2E` on off-white `#F7F8F4`, white surfaces and one teal `#006B61` action/focus color. Muted text `#516266`; written errors and success so color is not the only signal. Original inline SVG receipt/plus symbols. Declared stack: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`; no licensed external font files.

Headings 28–36 px, balance 36–46 px, body 16 px and field labels 14 px; tabular amount numerals. Spacing 8/12/16/24/28 px, 20 px card radius, 9–10 px field/button radius, borders without decorative shadows. Primary actions have 44 px minimum height, visible labels and focus outlines.

Keep balance and expense list together; desktop form sits beside wallet, form stacks below at widths ≤680 px. Demonstration widths for pending inspection: 1280×900 and 390×844. Feedback sits beside Amount; invalid entry preserves entered label and amount; Cancel leaves demonstrated wallet state intact. Blank optional Label displays “Expense”, explicitly accepted for this mock only.

## Evidence and limits

Static portability, required elements/IDs, inline assets, responsive rule and JavaScript syntax checked. Durable relative references/fragments and assets checked from `docs/design/`; original drafts retained. Rendering, visual quality, overflow, interaction runtime, actual font loading and actual SVG rendering are **UNAVAILABLE**, not PASS. Acceptance is a visual decision, not runtime evidence.

The HTML is an in-memory demonstration (1000 PLN; expense 25 PLN → 975 PLN and one row), not a production implementation contract. No backend, persistence, banking, uploads, camera, login or collaboration.

[Exact manual checklist](../../manual-checklist.md) remains historical and still applies to the accepted copy except the opening banner is now “Accepted visual proposal · Mock reference” and the guide title is “Accepted style guide”. The [initial draft](../../design-proposal.html) is preserved; the [narrow validation experiment](../../validation-experiment.html#experiment-question) remains unaccepted/ephemeral with verdict deferred. Acceptance of this visual direction does not accept the experiment conclusion or authorize a later lifecycle stage.
