# PingMe load tests (k6)

Install [k6](https://k6.io/docs/get-started/installation/) locally.

## Scripts

| Script | Purpose |
|--------|---------|
| `k6-health.js` | Baseline health endpoint — safe to run anytime |
| `k6-auth-flow.js` | Login + refresh token flow |
| `k6-polling-sim.js` | Simulates optimized mobile polling with a real JWT |

## Examples

```bash
# Health smoke test (staging)
k6 run scripts/load-test/k6-health.js

# Override API URL
API_URL=https://pingme.hostyler.cloud/v1 k6 run scripts/load-test/k6-health.js

# Auth flow (use a test account)
TEST_EMAIL=you@example.com TEST_PASSWORD=secret k6 run scripts/load-test/k6-auth-flow.js

# Polling sim (get ACCESS_TOKEN from login response)
ACCESS_TOKEN=eyJ... k6 run scripts/load-test/k6-polling-sim.js
```

## Safe staging limits

- Start with `k6-health.js` at 10 VUs for 2 minutes
- Watch API CPU, Redis, and Postgres on the VPS during runs
- Do not run high-VU tests against production without isolation

## What to watch

- `http_req_duration` p95 < 500ms on `/health`
- `http_req_failed` < 1%
- No 5xx spikes in nginx or API logs
