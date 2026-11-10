<!-- produktiv: {"version":1,"feature":"workspace-copy"} -->

# Give a recipient an independent copy

**Date:** 2026-10-09

Illustrative agreed product source for the companion Spec, not a real feature request.

## Copy semantics

A workspace owner shares its current contents as a snapshot. The recipient can redeem once; retrying returns the same copy. The recipient's copy survives later source edits or deletion. It does not synchronize or merge.

## Recipient access

Only the named recipient may redeem an unexpired grant. The owner may revoke before redemption. Revocation cannot remove a copy already obtained. Unavailable grants expose no workspace details.

## Success

A valid recipient obtains exactly one complete, independent copy. Invalid access and failed attempts never expose a partial copy or source metadata.
