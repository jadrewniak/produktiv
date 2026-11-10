---
feature: saved-label
---

# Save a label

## Problem

A person needs the last label they saved to still be there on a later read.

## Desired outcome

Saving a label keeps that text. A later read returns it. An empty save does not replace the previous label.

## User stories

- As a person, I save "Ada" and a later read returns "Ada".
- As a person, I save nothing and the previous label stays.

## Decisions

### Product

- A saved label is the text the person submitted.
- An empty save does not change the stored label.

### Domain/data

- A label is text. An empty save is a save with no text.

## Acceptance / success

- Saving "Ada" and then reading returns "Ada".
- An empty save leaves the previous text.

## Out of scope

- Sharing a label with another person.

## Dependencies

None

## Risks

None
