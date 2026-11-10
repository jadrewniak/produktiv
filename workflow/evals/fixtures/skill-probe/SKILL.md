---
name: skill-probe
description: Replies with the fixed skill-probe token when asked to run the Produktiv discovery probe. Use only for that eval check. Not a public workflow command.
disable-model-invocation: true
---

# Skill probe

This fixture checks that Cursor can discover a skill from the eval path. It is not one of the 16 public commands, and it is excluded from the packaged skill set.

When this skill is invoked, reply with exactly this token and nothing else: produktiv-skill-probe-ok
