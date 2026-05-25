# Stabilization Policy — release/pilot-baseline

## Branch: release/pilot-baseline

This branch is FROZEN for normal development.

---

## What is allowed

- Critical security hotfixes (CVSS >= 7.0)
- Data integrity fixes (audit chain breaks, hash uniqueness failures)
- EB/RDS configuration fixes blocking operation
- Documented operational fixes from incident reports

## What is NOT allowed

- New features
- Refactoring (structural changes)
- Dependency updates (unless security-patching a critical CVE)
- Schema changes beyond hotfix scope
- New migrations (unless fixing a critical data integrity issue)

---

## Process for hotfix to release/pilot-baseline

1. Create hotfix branch from `release/pilot-baseline`: `hotfix/description`
2. Apply minimal patch
3. QA review (vitras-qa-senior checklist)
4. Merge to `release/pilot-baseline`
5. Cherry-pick to `dev`
6. Tag new patch version: `v1.0.1-pilot-governed`

---

## Active development continues on: dev branch

## Sprint 5 targets: dev branch
