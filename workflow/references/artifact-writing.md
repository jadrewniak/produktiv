# Write and update artifacts

Read this with `references/artifact-resolution.md` before creating or updating an Issue, Spec, Plan or Ticket, and for an authorized repair after review. Identity, links and authority stay there.

## Create and update

Writers use the same resolver before create/update, including legacy filename identity checks. A new artifact writes only the current hidden comment. An authorized update of a legacy artifact converts that artifact to the current comment while preserving slug, links and stable IDs; do not keep dual stores. Never mass-migrate unrelated project files. Never overwrite another feature or create a third artifact around ambiguity. Update only requested/current owning sections, preserve unrelated decisions and stable unit/slice identities, and repair stale links during an authorized owner update.

## Project knowledge

Project foundation lives in `.workflow/context/project.md`; reusable domain terms belong in the existing glossary, with `.workflow/context/domain.md` as the fallback/index. Authorized capture and selective ADRs follow `policies/decisions.md`. Accepted decisions remain recoverable across conversations without copying a PRD into context.

## Repair after review

The repair/review sequence below otherwise applies to the owning review workflow, especially revised Plans.

A caller with existing or newly given repair authorization can perform the affected owning responsibilities in this conversation; the user need not type owner commands. Propagate accepted changes to affected downstream sections/refs, preserve valid stable IDs and rerun only affected review/proof unless a wider change warrants it. This bounded repair does not launch the whole lifecycle or an unlimited review loop.

Once authorized, read the owning skills as needed, close only outstanding owner choices and update in dependency order: confirmed project/domain/product decisions, system contracts, then route and execution references. Inspect named consumers across feature boundaries, not only documents sharing a slug. If a changed rule invalidates an accepted design or another Spec, repair within the granted scope or mark the affected document as needing update with a precise source/reason when authorized; otherwise report pending propagation and request the missing scope. Do not silently replace an accepted visual baseline. Resume the original objective after reconciliation; an owner label is not another user command.

## Present a written document

Use readable Markdown rather than a metadata dump. Render document-state values in inline code (for example, **State:** `accepted` — owner accepted the contract after `/pk-to-spec` on 2026-10-09). Give Date/Updated/State/Related their own visible lines or paragraphs; do not rely on single newlines that collapse in preview. Keep the H1 descriptive, use meaningful section headings and selective emphasis, and link related documents.

Keep machine identity separate from human navigation. One H1 follows the hidden declaration. Do not duplicate feature/slice keys as a visible metadata block or add runtime status keys to identity.

For a newly written or materially updated Spec/Plan, show publication/update date and a readable document state below the title, following project language/conventions: draft, accepted (with the owner decision source), or needs update (with the invalidating source/reason). Preserve established tracking conventions and stable unit IDs, without a new status ledger, identity key or mandatory host-specific YAML.

Follow project tracker conventions without introducing a required new status system.

Templates are content prompts, not a fixed taxonomy, heading order or story count. Lead with outcome/context, then use domain-specific sections, examples or compact types where they improve retrieval. Omit empty headings and filler. Link authority instead of copying the whole product history into every artifact.

## Product source after exploration

Resolve existing identity first. With no existing Issue and an authorized request to prepare a Spec, persist the confirmed product scope as its canonical Issue before writing the Spec. If product meaning is open, use decisions policy to close it; an unresolved dependency stays unready.

Use the configured local Issue store (default `docs/issues/`) or authorized accessible GitHub store. If a new scope cannot be published because GitHub access or write authorization is missing, a local canonical fallback may be written only within the request's local write permission; report the fallback and retain its identity when later publishing. Do not claim GitHub was updated or keep two independent authorities.

## Agreed feature split

Propose a split for distinct outcomes/invariants/lifecycles/permissions or independently provable contracts, not document length. Obtain owner agreement before creating identities. Preserve every accepted requirement and name shared producers.

For new features, give each Issue and its Spec/Plan the same unique feature slug. A parent roadmap links them and does not redefine their detailed behavior. For an existing feature, retain its identity for retained scope; explicitly move agreed scope into new feature identities, update affected parent/consumer links and remove competing requirements from the old source. If the original becomes only a roadmap, move it outside configured Issue stores under an agreed roadmap path, remove its Issue identity declaration and repair incoming links with explicit replacement pointers (never discard its historical content). Do not silently rename an existing feature or leave two canonical Specs for one identity.

Do not re-slice in-flight Tickets without resolving their current scope. Unresolved authorization or identity conflict stops the affected split, not independent work.
