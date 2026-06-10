# Baseline Record — UBS #1 Rollout

**Date:** 2026-05-25
**Operator:** João Pedro (Joao Pedro)
**Tag:** v1.0-pilot-governed
**Branch:** release/pilot-baseline
**Remote:** https://github.com/menejao/vitras.git

## Commit Hashes

**HEAD commit:** 22422c7b400918f72a5155e2a54d68008bf7fbbe
**Tag commit:** 1478bb5c5c910a2fba165a11f1e3926ad6af2a45
**Tag matches HEAD:** NO — HEAD is 3 commits ahead of the tag (Sprint 4.1 planning and observability docs added after tag was cut)

### Log at time of record (git log --oneline -3)
```
22422c7 docs(planning): Sprint 5A strategy — selective anonymization and compliance
7dc8852 docs(observability): alarm runbooks added to cloudwatch-dashboard.md
b1fcce0 docs(operations): operational routines, daily checklist, weekly report
```

### Tags present (git tag -l)
```
v1.0-pilot-governed
```

## Git Status

Working tree clean: NO — unstaged modifications present (backend/package-lock.json, docs/legacy/technical-debt.md, docs/security/security-review.md, deleted frontend-react style file; untracked: fix-encoding.mjs, new design system HTML, landing-vitras/)

**Note:** All unstaged changes are non-functional (docs, package-lock, frontend styles, untracked landing page). No backend application code is modified relative to the tag. The tag `v1.0-pilot-governed` at commit `1478bb5c` represents the frozen application baseline. Commits after the tag are documentation-only additions.

## Verification Commands Used

```bash
git log --oneline -3
git tag -l
git status
git rev-parse HEAD
git rev-parse v1.0-pilot-governed
```

## Baseline Interpretation

The deployable application baseline is `v1.0-pilot-governed` (commit `1478bb5c`). The HEAD contains additional operational documentation commits that do not affect deployed application code. For production deploy, the EB deployment artifact should be built from the tag commit.

To verify and checkout the exact tag commit before deploy:
```bash
git checkout v1.0-pilot-governed
git rev-parse HEAD  # must equal 1478bb5c5c910a2fba165a11f1e3926ad6af2a45
```

## Sign-off

This baseline record confirms the correct version tag is present for UBS #1 pilot. The technical lead must verify that the EB deployment artifact corresponds to `v1.0-pilot-governed` before go-live.

**Tech Lead:** _________________________ Date: _______
