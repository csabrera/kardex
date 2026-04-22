# Smoke Tests

Fast tests that validate the stack is running and basic flows work.

**Run first in CI** — if these fail, the rest of the suite won't run.

## Contents

| File                           | What it validates                             |
| ------------------------------ | --------------------------------------------- |
| `home-loads.spec.ts`           | Frontend renders, routing works, 404, fonts  |
| `health-endpoints.spec.ts`     | `/health` + `/health/live` return 200         |

## Adding a new smoke test

Keep smoke tests:

- ✅ Fast (< 5s each)
- ✅ Independent (no DB seeding needed)
- ✅ Stable (no flaky waits, no complex setup)

If a test needs seeded data, move it to the feature-specific folder instead.
