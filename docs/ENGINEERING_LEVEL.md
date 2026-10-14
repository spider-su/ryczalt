# Engineering level: hobby / personal app

Ryczałt is a small local-first rental and tax helper. It is not an enterprise SaaS platform. This guidance is adapted from `spider-su/mobile_template` and must be applied together with the existing Ryczałt product invariants.

## Default choices

Prefer simple, understandable changes that improve the current user flow. Reuse existing theme, components, domain functions, local persistence and tests. Keep the app usable offline without a backend. Add focused regression tests for affected rental, money and persistence behavior. Keep documentation and PRs proportional to the change.

Avoid speculative microservices, cloud infrastructure, general-purpose frameworks, additional state management, extensive observability, multiple deployment environments, elaborate abstraction layers or new paid services. Do not add functionality or non-functional requirements without a current user story or demonstrated failure.

## Important exceptions: correctness is not optional

Hobby scope does not relax financial correctness, user privacy or preservation of local data. Retain decimal-string PLN accounting, the existing tax rules, explicit payment confirmation, encrypted local storage, secure key handling, migrations, backup/restore and notification reconciliation. Never swap encrypted persistence for the template's generic storage adapter. Do not weaken existing domain tests or remove recovery protections for simplicity.

## Complexity gate

Before adding a dependency, abstraction, background service or infrastructure, state: (1) the current requirement or failure, (2) the simplest existing-code alternative, (3) the maintenance cost. Defer additions that lack a concrete justification.

## Acceptance level

The requested feature works, relevant tests pass, the existing data model remains safe, and device behavior is checked where tooling exists. No enterprise-readiness program is required. Record any unverified platform behavior honestly.
