# Legalok — Go-Live Runbook (₹0 / free-tier stack)

```
Cloudflare (free)                 Oracle Cloud Always-Free VM (free, always-on)
├── Frontend → Cloudflare Pages   ├── Express API  (systemd, port 4000)
│   (React build, unlimited bw)  ├── user files   (server/data — persistent disk)
└── API HTTPS → Cloudflare Tunnel └── cloudflared  (free HTTPS, no open ports)
Supabase (free tier)
├── PostgreSQL        ← DATABASE_URL (TypeORM connects directly)
└── Auth: Google + Facebook OAuth ← /api/auth/oauth verifies tokens server-side
```

**Cost:** ₹0/month. **Trade-off:** you administer the VM (mitigated by the setup script below).

---

## Step 0 — Push code to GitHub
```bash
cd legalok
git init && git add -A && git commit -m "Legalok MVP"
git remote add origin https://github.com/<you>/legalok.git && git push -u origin main
```
`.gitignore` already excludes `.env`, `*.db`, `data/`, `node_modules`.

---

## Step 1 — Supabase (database + social login)

1. **Create project** at supabase.com (Mumbai region) — free tier.
2. **🔒 Lock down the Data API (critical).** TypeORM owns this database; no client should
   read it via Supabase's REST API. In **SQL Editor**, run:
   ```sql
   alter default privileges for role postgres in schema public
     revoke all on tables from anon, authenticated, service_role;
   alter default privileges for role postgres in schema public
     revoke all on sequences from anon, authenticated, service_role;
   alter default privileges for role postgres in schema public
     revoke all on functions from anon, authenticated, service_role;
   revoke all on all tables in schema public from anon, authenticated;
   revoke all on all sequences in schema public from anon, authenticated;
   revoke all on all functions in schema public from anon, authenticated;
   ```
3. **Copy the connection string:** Project Settings → Database → *Connection string → URI*
   → use the **Connection pooler** host (port `6543`). Append `?sslmode=require`.
4. **Enable Google:** console.cloud.google.com → OAuth consent screen (External) →
   Credentials → OAuth Client ID (Web). Authorized redirect URI:
   `https://<project-ref>.supabase.co/auth/v1/callback`
   → paste Client ID/Secret into Supabase → Authentication → Providers → Google → ON.
5. **Enable Facebook:** developers.facebook.com → Create App → add *Facebook Login* →
   Valid OAuth Redirect URIs: same callback URL → paste App ID/Secret into
   Supabase → Authentication → Providers → Facebook → ON.
6. **URL Configuration** (Supabase → Authentication → URL Configuration):
   Site URL = your Pages URL (Step 2), Redirect URLs = same.
7. **Copy keys:** Project Settings → API → `Project URL` + `anon public` key.

> Free-tier pause (~7 days idle) is neutralized by the VM keep-alive cron in Step 3.

---

## Step 2 — Cloudflare Pages (frontend)

1. Cloudflare dashboard → Workers & Pages → Create → **Pages** → connect the GitHub repo.
2. Build settings:
   - **Build command:** `npm --prefix client ci && npm --prefix client run build`
   - **Build output directory:** `client/dist`
   - **Environment variables:** `NODE_VERSION=20`, and from `client/.env.example`:
     - `VITE_API_BASE_URL=https://<your-tunnel-domain>/api` *(include `/api`)*
     - `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (Step 1.7)
3. Deploy → you get `https://legalok.pages.dev` (free HTTPS + CDN).
   SPA routing is handled by the committed `client/public/_redirects`.

---

## Step 3 — Oracle Cloud Always-Free VM (API + files)

1. Create instance: **Ampere A1 (ARM)**, Ubuntu 22.04, Always-Free-eligible shape.
   Networking: allow inbound TCP `22` only — the API is published via Tunnel (no open ports).
2. SSH in and bootstrap (script installs Node 20, builds, systemd, keep-alive cron):
   ```bash
   REPO_URL=https://github.com/<you>/legalok.git bash <(curl -s https://raw.githubusercontent.com/<you>/legalok/main/deploy/setup-vm.sh)
   ```
3. **Edit `/opt/legalok/server/.env`** (see `server/.env.example`):
   `JWT_*` secrets, `DATABASE_URL` (Step 1.3), `SUPABASE_URL`/`SUPABASE_ANON_KEY` (Step 1.7),
   `APP_URL=https://legalok.pages.dev`, `CORS_ORIGIN=https://legalok.pages.dev`,
   `DB_TYPE=postgres`, `DB_SYNCHRONIZE=true` *(MVP auto-schema — see "Migrations")*.
   Then: `systemctl restart legalok`
4. **Cloudflare Tunnel (free HTTPS for the API):**
   ```bash
   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /usr/local/bin/cloudflared
   chmod +x /usr/local/bin/cloudflared
   cloudflared tunnel login                     # opens browser
   cloudflared tunnel create legalok-api
   cloudflared tunnel route dns legalok-api api.yourdomain.com   # needs a domain in Cloudflare
   cloudflared service install                  # tunnel starts on boot
   ```
   Demo alternative (no domain/account): `cloudflared tunnel --url http://localhost:4000`
   → temporary `https://…trycloudflare.com` URL.
5. Verify: `curl https://<tunnel-domain>/api/health` → `{"ok":true,...}`

---

## Step 4 — Go-live checklist

- [ ] `https://legalok.pages.dev` loads; `VITE_*` built in (browser devtools → API base correct)
- [ ] `/api/health` over the tunnel returns 200
- [ ] Email login works → **change/remove demo users** (`server/src/db/seed.ts`)
- [ ] Google login works end-to-end; then Facebook
- [ ] Create a document → **reload the page** (persistence = Postgres OK)
- [ ] Sign + guest-signing link + audit log all work
- [ ] Nightly DB dump cron:
      `0 2 * * * pg_dump "$DATABASE_URL" | gzip > /opt/backups/legalok-$(date +\%F).sql.gz`
- [ ] **`DB_SYNCHRONIZE=false` once schema is stable** — switch to versioned migrations
- [ ] Logs: `journalctl -u legalok -f` (service unit also writes `/var/log/legalok.log`)

---

## Migrations (before real users)

`DB_SYNCHRONIZE=true` auto-creates/alters tables — fine for MVP. To harden:
1. Freeze the schema (`pg_dump --schema-only`), review it.
2. Move to explicit TypeORM migrations in the deploy pipeline.
3. Then set `DB_SYNCHRONIZE=false` in production.

## When you outgrow the free tiers

| Trigger | Move to |
|---|---|
| > 500 MB DB / 50k users | Supabase Pro $25/mo or Aurora Serverless v2 (per TRD) |
| Paid templates go live | Real Razorpay keys — `payments.routes.ts` is the single swap point |
| Real emails needed | Supabase Auth emails / Brevo / SES — `mailer.service.ts` swap point |
| PDF/DOCX binaries at scale | Move uploads to Supabase Storage (1 GB free) or R2 |

