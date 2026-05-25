# Production Deploy Report — UBS #1

**Date:** [to fill]
**Start time:** [to fill]
**End time:** [to fill]
**Operator:** João Pedro
**Version:** v1.0-pilot-governed
**Environment:** Production EB — [env name]

## Pre-Deploy Sign-offs

- [ ] pre-deploy-validation.md: PASSED — signed by [name] on [date]
- [ ] staging-smoke-test.md: PASSED — signed by [name] on [date]
- [ ] dr-drill-report.md: PASSED — signed by [name] on [date]
- [ ] checklist-pre-rollout.md: COMPLETE — signed by [name] on [date]
- [ ] UBS coordinator notified: [time]
- [ ] TI prefeitura notified: [time]

## Deploy Steps Executed

| Time | Action | Result | Notes |
|------|--------|--------|-------|
| | EB deploy initiated | | |
| | EB health check: /readyz 200 | | |
| | server_started log verified | | |
| | CloudWatch alarms: all green | | |
| | Smoke test prod (minimal): login OK | | |
| | Smoke test prod: patient read OK | | |
| | Smoke test prod: audit log OK | | |
| | UBS bootstrap executed | | |
| | First gestor login | | |
| | GO/NO-GO decision | | |

## Observations

[Any issues during deploy, unusual log entries, configuration adjustments made during the deployment window]

## GO/NO-GO Decision

**Decision:** GO / NO-GO
**Decision maker:** [name]
**Decision time:** [time]
**Reason:** [if NO-GO: reason and next steps — see rollback-plan.md]

## Sign-off

**Tech Lead:** _________________________ Date: _______
**UBS Coordinator notified of GO:** [time]
