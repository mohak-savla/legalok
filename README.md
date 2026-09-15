# ⚖️ Legalok — DIY Legal Document Automation Platform (MVP)

Full-stack MVP implementing the Legalok PRD: dynamic questionnaires, live **"Murfed" (redacted) preview**,
Razorpay-shaped payments, guest e-signing, complete document lifecycle, and an interlinked
**Zoho Forms + Zoho Writer style Admin Template Studio**.

## 🚀 Quick Start

```bash
# Terminal 1 — API server (port 4000)
cd server
npm install
npm run dev        # auto-creates SQLite DB + seeds 10 templates & demo users

# Terminal 2 — Web client (port 5173)
cd client
npm install
npm run dev
```

Open **http://localhost:5173**

| Account | Email | Password |
|---|---|---|
| Admin (Studio access) | `admin@legalok.in` | `Admin@123` |
| End user | `demo@legalok.in` | `Demo@123` |

## ✅ What's Implemented

**End user** — Wonder.Legal-style landing (3-step explainer, Business/Personal split), templates library
(search/filter/favorites/pagination), template detail, **split-screen questionnaire with live Murfed
preview** (🔒 sensitive values redacted until payment; conditional questions; auto-save; guide text +
YouTube help per question), mock **Razorpay checkout** (real HMAC verification algorithm), document
view, DOC download + print-to-PDF, self-signing (type / mock Aadhaar eSign / draw), guest co-signing
via secure 7-day token link, resend request, document expiry, favorites, per-document + global audit
log, profile (name/phone/language), 5-language UI (EN · HI · TA · KN · GU).

**Admin Studio** — Dashboard (stats, pipeline, recent activity), Users management, System audit log,
Template CRUD, and the two-tab **Template Studio**:
- **① Form Builder** (Zoho Forms replica): drag-and-drop palette → canvas → properties panel
  (label, merge-key, required, Murfed-mask, options, guide text, YouTube URL, conditional logic,
  sample values) + **two-way JSON binding** drawer.
- **② Document Builder** (Zoho Writer replica): WYSIWYG editor (fonts, headings, lists, alignment,
  color, tables-ready toolbar), **merge-field chips** auto-synced from the Form Builder, conditional
  `{{#if}}` IF-blocks, Handlebars **source/code view**, live preview with sample data + Murfed toggle,
  and publish validation that blocks unknown `{{placeholders}}`.

**Lifecycle state machine** — `draft → awaiting_payment → generated → pending_signatures →
partially_signed → fully_executed / expired` (transitions validated server-side).

**Edge cases from the PRD** — auto-save drafts ✓ · resend signing request ✓ · eSign fallback to
click-to-sign (Aadhaar is mocked, failure logged) ✓ · admin "Regenerate Document" bypassing the
payment wall ✓.

## 🧱 Architecture

```
legalok/
├── server/   Express + TypeORM + SQLite (better-sqlite3) — production-Postgres code
│   └── src/  modules/(auth|templates|documents|payments|signing|admin|misc)
│              services/(handlebars|document|storage|mailer)  db/(entities|seed)
└── client/   React 18 + TypeScript + MUI v5 + Redux Toolkit + react-i18next (Vite)
```

Swap-in points for production (interfaces already shaped for them):
| Concern | MVP | Production |
|---|---|---|
| DB | SQLite (`DB_TYPE=sqlite`) | **Supabase/Neon free tier → Aurora Serverless v2** (`DB_TYPE=postgres` + `npm i pg`) — same entities, config-only switch |
| Payments | mock Razorpay checkout + HMAC verify | Razorpay SDK — replace `payments/mock-checkout` with the browser SDK; `verify` stays identical |
| eSign | mocked Aadhaar (ref: `CDAC-MOCK-…`) | C-DAC eSign API |
| Email | console + `email_logs` table | Amazon SES (in `services/mailer.service.ts`) |
| Storage | local disk, S3-shaped API | DigitalOcean Spaces / S3 (in `services/storage.service.ts`) |
| PDF | DOC download + browser print-to-PDF (`/print/:id`) | Puppeteer in a worker |

## 🔧 Useful Scripts

```bash
cd server
npm run seed        # re-run seeding (idempotent)
npm run typecheck   # tsc --noEmit
npm run build && npm start   # production compile

cd client
npm run build       # typecheck + production bundle → dist/
```

Server config lives in `server/.env` (JWT secrets, DB, Razorpay mock keys, expiry days).
