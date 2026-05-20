# Paid Infrastructure Go-Live Checklist

## Why the free tier is not suitable for production

| Constraint | Free tier | Impact |
|---|---|---|
| Render web service | Spins down after 15 min idle | ~30 s cold start for first user of the day |
| Neon Postgres | 0.5 GB storage, shared compute | Slow queries under load; no point-in-time recovery |
| Upstash Redis | 10 000 req/day free | Rate-limit layer fails silently after quota |
| Custom domain TLS | Needs paid plan on Render | `*.onrender.com` domain only on free tier |

---

## Render upgrade

- [ ] Open Render dashboard → `saude-backend` service → **Change Plan**
- [ ] Select **Starter** ($7/month) or **Standard** ($25/month) for always-on
- [ ] Change `plan: free` → `plan: starter` in `render.yaml` and redeploy
- [ ] Enable **Auto-Deploy** from `main` branch
- [ ] Configure **Custom Domain**: `api.saudeubs.com.br`
  - Add CNAME record in DNS: `api.saudeubs.com.br → <render-service>.onrender.com`
  - Render provisions Let's Encrypt TLS automatically
- [ ] Set **Health Check Path**: `/health` (already configured)
- [ ] Set **Deploy Hook** secret for CI-triggered deploys

## Neon Postgres upgrade

- [ ] Upgrade from Free to **Launch** plan ($19/month) for:
  - 10 GB storage
  - Point-in-time restore (7 days)
  - Dedicated compute (no cold starts)
- [ ] Enable **Connection Pooling** (PgBouncer) in Neon console
  - Update `DATABASE_URL` to the pooler URL (port 6543, `?pgbouncer=true`)
  - Current backend uses `Pooling=false` workaround — remove it after enabling
- [ ] Schedule weekly `pg_dump` backup in addition to application-level backup
- [ ] Set up Neon **Branching** for staging environment

## Upstash Redis upgrade

- [ ] If > 10 000 requests/day expected, upgrade to **Pay As You Go** plan
- [ ] Monitor daily request count in Upstash console (first 2 weeks post-launch)
- [ ] Fallback: if Redis is unavailable, `express-rate-limit` memory store activates automatically (single-instance only)

## Domain and DNS

- [ ] Register `saudeubs.com.br` (or confirm existing registration) at Registro.br
- [ ] Set DNS TTL to 300 s before cutover (faster rollback)
- [ ] After cutover, raise TTL back to 3600 s
- [ ] Configure `FRONTEND_ORIGINS` env var with production domain:
  ```
  https://saudeubs.com.br,https://www.saudeubs.com.br
  ```

## Cloudflare (recommended)

- [ ] Add site to Cloudflare (free plan sufficient for DDoS protection + CDN)
- [ ] Set SSL/TLS mode to **Full (strict)**
- [ ] Enable **Bot Fight Mode**
- [ ] Create Page Rule: cache `GET /health` for 30 s (reduces origin load from uptime monitors)

## Monitoring and alerting

- [ ] Set up Render **Custom Health Check**: endpoint `/health`, interval 30 s
- [ ] Create UptimeRobot (free) monitor for `https://api.saudeubs.com.br/health`
  - Alert to email + Slack on downtime
- [ ] Configure Render **Log Drain** to Papertrail or Logtail (free tier available)
  - Set `LOG_FORMAT=json` env var in Render for structured log ingestion
- [ ] Set alert on `errors5xx` metric: if `GET /metrics/internal` shows > 10 errors5xx in 5 min, investigate

## Pre-launch smoke test sequence

Run after each infrastructure upgrade before announcing to users:

```bash
BASE=https://api.saudeubs.com.br

# Health
curl -f $BASE/health

# Auth round-trip
TOKEN=$(curl -sf -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@clinica.local","password":"123456"}' | jq -r '.token')

# Protected route
curl -sf -H "Authorization: Bearer $TOKEN" $BASE/bootstrap | jq .serverTime

# Metrics (requires gestor/manager role)
curl -sf -H "Authorization: Bearer $TOKEN" $BASE/metrics/internal | jq .
```

## Cost summary (minimum production setup)

| Service | Plan | Cost/month |
|---|---|---|
| Render web service | Starter | $7 |
| Neon Postgres | Launch | $19 |
| Upstash Redis | Pay-as-you-go | ~$0–5 |
| Cloudflare | Free | $0 |
| UptimeRobot | Free | $0 |
| **Total** | | **~$26–31/month** |
