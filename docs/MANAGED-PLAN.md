# Managed Version Implementation Plan (Neon + Vercel/Cloudflare)

Concrete build plan for the hosted "cc-lens for Teams", on the chosen stack:
Neon Postgres, Vercel or Cloudflare for hosting. Supersedes the VPS-oriented
hosting section in `MANAGED.md`; pricing/positioning there still applies.

## Stack decisions

| Concern | Choice | Notes |
| --- | --- | --- |
| App hosting | **Vercel** (recommended) | The codebase is already Next.js; zero adapter friction. Cloudflare via OpenNext is viable but adds build complexity — revisit if Vercel costs bite. |
| Database | **Neon Postgres** | Serverless driver (`@neondatabase/serverless`) over HTTP works from Vercel functions and CF Workers alike. Branching = free staging DBs per PR. |
| ORM | Drizzle | Thin, works with the Neon HTTP driver, schema-as-code migrations. |
| Object storage | Cloudflare R2 | Nightly logical backups, large export archives. Zero egress fees. |
| Auth | Better Auth (or Auth.js): GitHub OAuth + magic link | Devs sign in with GitHub; magic link for managers who don't. |
| Email | Resend | Magic links, weekly team digests. Free tier covers the start. |
| Billing | Lemon Squeezy or Paddle (merchant of record) | Handles global VAT/GST — important selling worldwide solo. |
| Rate limiting | Upstash Redis | Free tier; per-token limits on ingestion endpoints. |
| Crons | Vercel Cron | Rollups, retention sweeps, weekly digests. |

**OTLP on serverless is confirmed viable:** Claude Code supports
`OTEL_EXPORTER_OTLP_PROTOCOL=http/json` and `http/protobuf` (per the
monitoring docs), so ingestion is plain HTTPS POST — no gRPC server needed.

**Vercel constraint to design around:** 4.5 MB request body limit. The
`cc-lens push` CLI must chunk large histories into batches (e.g. 1,000
sessions per request) — a small change to the OSS CLI that also helps
self-hosted hubs.

## Repo strategy

New **private repo `cc-lens-cloud`** (BSL or proprietary). Phase 1: copy
`lib/pricing.ts`, `lib/redact.ts`, `lib/decode.ts`, `types/claude.ts`, and
the team aggregation logic. Once stable, extract those into a published
`@cc-lens/core` package consumed by both repos so OSS and cloud don't drift.
Dashboard components get copied and adapted (org-scoped data fetching) —
don't over-engineer sharing of React code early.

## Data model (Drizzle/Postgres)

```text
orgs            id, slug, name, plan, retention_days, created_at
users           id, email, name, github_id, created_at
org_members     org_id, user_id, role (owner|admin|viewer)
ingest_tokens   id, org_id, label, token_hash, last_used_at, revoked_at
devs            id, org_id, display_name, email, machine, source (push|otel)
                -- a "dev" is an observed person+machine, joined to users
                -- later by email; not an auth identity
sessions        org_id, dev_id, session_id, started_at, last_activity,
                duration_min, msg_user, msg_assistant, input_tokens,
                output_tokens, cache_read, cache_write, cost_usd,
                tool_counts jsonb, model_usage jsonb, flags jsonb
                UNIQUE (org_id, session_id)
usage_daily     org_id, dev_id, date, cost_usd, input_tokens, output_tokens,
                cache_read, cache_write, sessions, loc_added, loc_removed,
                commits, prs, active_seconds, tool_decisions jsonb
                UNIQUE (org_id, dev_id, date)   -- OTel + push both land here
cc_versions     org_id, dev_id, version, first_seen, last_seen
```

`sessions` is the deep-dive layer (from pushes); `usage_daily` is the
complete real-time layer (from OTel deltas + nightly session rollups). The
two join on org + dev (email) — exactly the OTel `session.id`/email bridge
described in `TEAM-WORKSPACE-PLAN.md`.

## Ingestion endpoints

All authenticated by `Authorization: Bearer <ingest token>`; token hash
lookup → org. Rate-limited per token via Upstash.

1. `POST /api/v1/push` — the existing `TeamExportPayload`, identical
   validation + server-side re-redaction as the OSS `/api/team/push`, but
   upserting into `sessions`/`devs` instead of writing a file. Accepts
   `batch: {index, total}` for chunked pushes.
2. `POST /api/v1/otel/v1/metrics` and `/api/v1/otel/v1/logs` — OTLP
   `http/json` first (trivial: JSON body), `http/protobuf` second (decode
   with `@opentelemetry/otlp-transformer`). Map `claude_code.cost.usage`,
   `claude_code.token.usage`, `claude_code.lines_of_code.count`,
   `claude_code.commit.count`, `claude_code.pull_request.count`,
   `claude_code.active_time.total`, `claude_code.session.count` into
   `usage_daily` upserts keyed by (`org`, `user.email` or `user.account_uuid`,
   day). Drop everything else in v1. Idempotency: OTLP sends cumulative or
   delta sums — store last-seen counter per (dev, metric, session.id) in
   Redis to convert safely.

### Customer onboarding artifact

The dashboard generates a copy-paste managed-settings snippet per org:

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "https://app.example.com/api/v1/otel",
    "OTEL_EXPORTER_OTLP_HEADERS": "Authorization=Bearer <org-ingest-token>",
    "OTEL_RESOURCE_ATTRIBUTES": "team.id=<team>"
  }
}
```

Admins drop it in the managed settings file → org-wide, enforced, real-time
coverage with zero per-developer steps. This snippet IS the product demo.

## Dashboard (org-scoped)

Port the OSS `/team` views onto the DB: overview (cost, sessions, cache
savings, members), cost-over-time by member, member table, version skew.
Add the two views OTel makes possible that files can't: **today/live view**
(usage_daily for the current day, refreshed each export interval) and
**org trends** (week-over-week cost and adoption). Plus: org settings,
member invites, token management, the onboarding snippet generator, and a
weekly email digest (Resend + cron).

## Billing and limits

Lemon Squeezy/Paddle checkout + webhooks set `orgs.plan`. Gates enforced in
middleware: dev count (distinct devs in last 30 days), retention sweeps via
cron (delete `sessions` older than plan retention; `usage_daily` keeps
longer), OTel ingestion enabled at Business tier and up. Tiers per
`MANAGED.md`. 14-day trial of Business on signup, no card.

## Milestones

| # | Deliverable | Definition of done |
| --- | --- | --- |
| M1 Foundation (week 1–2) | Repo, Vercel + Neon + Drizzle, auth, orgs, tokens | Sign in, create org, mint/revoke ingest token |
| M2 Push ingestion (week 2–3) | `/api/v1/push` + chunking in OSS CLI | `cc-lens push --to https://app...` lands sessions in Neon; dedup verified |
| M3 Dashboard (week 3–5) | Org-scoped team views + onboarding flow | Design partner sees their real team data hosted |
| M4 OTel (week 5–7) | OTLP http/json receiver + usage_daily + live view | A test org with managed settings streams real-time cost |
| M5 Billing (week 7–8) | Checkout, tier gates, retention cron | Card-to-dashboard happy path works end to end |
| M6 Hardening | Rate limits, R2 backups, status page, DPA/privacy page | Comfortable taking money from a 50-dev org |

Design partners onboard at M3 with push-only; OTel (M4) is what converts
them to paid — sequence sales conversations accordingly.

## Your running costs on this stack

| Item | Start | ~25 teams |
| --- | --- | --- |
| Vercel | $0 (Hobby is non-commercial — move to Pro $20/mo at first revenue) | $20/mo |
| Neon | $0 (free tier, 0.5 GB) | $19/mo (Launch) |
| Upstash / Resend / R2 | $0 | ~$5/mo |
| Domain | ~$15/yr | ~$15/yr |
| **Total** | **~$2/mo** | **~$45/mo** + MoR fees (~5% of revenue) |

Cheaper than the VPS path at the start, slightly costlier at scale, much
less ops. Revisit Cloudflare (Workers + Hyperdrive) only if Vercel function
invocation costs become material — the ingestion endpoints are the hot path.

## Risks

- **OTLP delta/cumulative handling** is the trickiest code (M4); get a
  fixture stream from a real Claude Code session early.
- **Vercel body limit** — chunked push must ship in OSS before design
  partners with big histories arrive.
- **Email as the join key**: OTel only carries `user.email` when OAuth-
  authenticated; API-key users need `OTEL_RESOURCE_ATTRIBUTES` fallbacks.
- **Trademark**: commercial name stays "cc-lens for Teams".
