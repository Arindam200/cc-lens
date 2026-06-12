# Managed Version: Hosting, Costs, and Pricing

Working plan for the hosted/managed cc-lens for Teams. Companion to
`TEAM-WORKSPACE-PLAN.md` (product) and `TEAM.md` (shipped OSS team mode).

## What the managed version is

One multi-tenant hub: each customer org gets a push token, an OTLP ingestion
endpoint, and a hosted team dashboard. Same codebase direction as the OSS
hub (`/api/team/push`), with Postgres instead of a file directory, org
scoping, auth, and billing on top.

```text
member machines / CI                      managed hub (single deployment)
┌──────────────────────┐  HTTPS push      ┌────────────────────────────────┐
│ cc-lens push (cron)  │ ───────────────▶ │ Next.js app                    │
│ OTel (managed        │  OTLP http/json  │  /api/team/push  (org token)   │
│  settings, enforced) │ ───────────────▶ │  /api/otel/v1/metrics          │
└──────────────────────┘                  │ Postgres (org-scoped rows)     │
                                          │ nightly pg_dump → object store │
                                          └────────────────────────────────┘
```

Data volume reality check: a redacted session is 1–2 KB. A heavy user
produces ~40 KB/day; a 50-dev org ~60 MB/month. OTel metric points are
smaller. One modest box serves hundreds of teams — this is a
high-margin, low-infra product.

> **Stack decided:** Neon Postgres + Vercel. See `MANAGED-PLAN.md` for the
> concrete implementation plan, data model, and milestones. The hosting
> table below is kept for the single-tenant/enterprise option.

## Where to host

| Stage | Recommendation | Why |
| --- | --- | --- |
| Design partners (0–5 teams) | **Railway** or **Fly.io**: app + managed Postgres | Push-to-deploy, TLS and Postgres included, zero ops while iterating fast |
| Paying customers | **Hetzner VPS** (CPX21/CPX31) + Docker Compose (app, Postgres, Caddy) | 4–8 GB RAM for ~€8–15/mo, best margin, EU + US (Ashburn) locations |
| Privacy-sensitive enterprise | Single-tenant: one Hetzner box per customer, or their VPC | The local-first audience will pay extra for isolation; trivial to script with the same compose file |

Avoid Vercel for the hub: OTLP gRPC won't work and sustained ingestion fits
a long-running server better. (OTLP over `http/json` does work through API
routes if a serverless deploy is ever needed.)

## Your monthly cost

| Item | Design partners | ~25 paying teams (~500 devs) |
| --- | --- | --- |
| Compute (Railway/Fly → Hetzner) | $10–15 | $15–30 |
| Postgres (platform-managed → self-run + backups) | $0–10 | $15–25 |
| Object storage for backups (R2/B2) | ~$1 | ~$2 |
| Domain + email (Resend free tier) | ~$2 | ~$2 |
| Uptime/error monitoring (free tiers) | $0 | $0–10 |
| **Total** | **~$15–30/mo** | **~$40–70/mo** |

Marginal cost per team is under $1/month. At $150/mo average revenue per
team, gross margin is ~97% — the real costs are your time and payment fees.

Payments: use a merchant of record (Paddle or Lemon Squeezy, ~5% + fees)
rather than raw Stripe — it handles global sales tax/GST/VAT and invoicing,
which matters when selling worldwide as a solo operator.

## Pricing

Anchor: a 30-dev team spends $3,000–6,000/month on Claude Code. Charging
~$150/month to see, control, and govern that spend is an easy yes.

Start with flat tiers (easier to buy, no procurement math):

| Tier | Price | Limits |
| --- | --- | --- |
| OSS | Free forever | Everything file-based: local dashboard, exports, shared-folder team view, self-run push hub |
| Team | $49/mo | Managed hub, up to 10 devs, 90-day retention |
| Business | $149/mo | Up to 30 devs, 1-year retention, OTel ingestion, Slack reports |
| Scale | $399/mo | Up to 100 devs, SSO, audit log, priority support |
| Enterprise / single-tenant | from $500/mo | Dedicated instance or their VPC, custom retention, invoicing |

Move to per-seat ($15/dev/mo managed, $10/dev/mo self-hosted license) once
the sales motion is understood; flat tiers first because they remove the
"how many seats do we have?" friction at signup. Annual = 2 months free.

Rules that protect the OSS community:
- Nothing currently free ever moves behind the paywall.
- Paid features are things files can't do: real-time OTel, retention,
  multi-org auth, SSO, governance, hosted convenience.
- The paid product is "cc-lens for Teams" — keep "Claude" out of the
  commercial name (trademark).

## What the managed build needs (engineering checklist)

1. Postgres-backed team store behind the same interfaces as
   `lib/team-reader.ts` (orgs, members, sessions tables; org_id on every row)
2. Org auth: magic-link email or GitHub OAuth; per-org push tokens
3. OTLP `http/json` receiver mapping `claude_code.*` metrics +
   `user.email`/`organization.id` attributes onto the same store
4. Billing webhooks (Paddle/Lemon Squeezy) gating tier limits
5. Nightly `pg_dump` to object storage; restore runbook
6. Single-tenant compose file (app + Postgres + Caddy) for enterprise

## Sequence

1. Waitlist live (done: /team page CTA) — measure pull
2. 5 design partners on the OSS push hub, free
3. Build the managed MVP against their feedback (checklist above)
4. Convert design partners at Team/Business tier; public launch after
