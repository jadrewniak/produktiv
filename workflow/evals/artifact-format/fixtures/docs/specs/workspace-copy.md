<!-- produktiv: {"version":1,"feature":"workspace-copy","issue":"../issues/workspace-copy.md"} -->

# Independent workspace copy — System contract

**Date:** 2026-10-09  
**Related:** [Product outcome](../issues/workspace-copy.md)

A recipient receives an independent snapshot, not a synchronized reference. This illustrative contract is deliberately organized differently from a small label-change Plan.

## Snapshot identity

Source: Issue, “Copy semantics”. Copy IDs and all owned record IDs are fresh. References inside the snapshot are rewritten to the copied IDs. Subsequent source changes never mutate the copy; source deletion cannot cascade into it.

## Permission boundary

Source: Issue, “Recipient access”. The owner can create an expiring recipient-bound grant. Redemption validates the current grant, recipient and expiry on the server. Revoked or expired grants return the same unavailable result; responses reveal no source metadata.

## Atomic redemption

Spec decision: one transaction checks the grant and records the resulting copy. The unique pair (grant, recipient) identifies redemption. Concurrent or retried requests return the same completed copy, never duplicates. A transaction failure exposes no partial copy and allows retry. Revocation races are serialized with redemption on the grant: a revoke committed first prevents copying; a redemption committed first remains a valid independent copy.

## Shared producer and exclusions

The authorization service owns recipient identity; the snapshot store owns transactionality and reference rewriting. A Plan must establish these producers before consumers. Synchronization, merging and later revocation of the already independent copy are outside this contract, per the Issue.
