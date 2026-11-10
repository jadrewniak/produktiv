---
feature: stored-farewell
---

# Stored farewell

## Contract

The first `farewell(name)` writes ``Goodbye, ${name}`` to `farewells.json` under that name. A later call with the same name returns the stored line and does not write again.
