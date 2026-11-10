<!-- produktiv: {"version":1,"feature":"saved-label","issue":"docs/issues/saved-label-v1.md","spec":"docs/specs/saved-label-v1.md"} -->
# Saved label

## Route

### U1 — Persist and read the label

The application boundary validates ownership, writes through the persistent store and reads the saved value back for the visible consumer.

#### Evidence

Exercise write, restart, read and a second-owner denial through the application boundary.

## Coverage

The Issue outcome and Spec stored-label contract are owned by U1.

