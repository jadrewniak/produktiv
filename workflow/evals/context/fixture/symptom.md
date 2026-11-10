# Reported failure

## Reproduction
Caller reports that renaming Inbox to whitespace loses its ID. Reproduce with rename({ id: 'label-1', name: 'Inbox' }, '  '). This is a reported symptom, not a verified failure. Inspect current label.mjs before selecting a hypothesis; do not silently trust the stale handoff.
