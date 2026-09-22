# Legalok — Email & Mail-Merge Setup

Zoho Writer-style **Merge and Send Email** for Legalok: admins can edit every
system email (subject + HTML body with merge fields), preview the exact
rendered email, send a test to themselves, and choose per-template delivery
behaviour. Signature requests go out automatically with the admin's copy.

---

## 1. What is built

| Piece | Where | Behaviour |
|---|---|---|
| Email Merge Studio | **Admin → Emails** (`/admin/emails`) | All 6 system templates, merge-field chips, save / preview / test / reset to default |
| Template Studio tab ③ | **Admin → Template Studio → Email Merge** | Same editor, plus per-template `emailSubject` / `emailBody` / `attachPdf` / `autoSendOnGenerate` |
| Document email dialog | Document detail → **Email this document** | Live preview of the exact email, editable recipient, "Attach final PDF" switch, send |
| Auto-send on generate | Document lifecycle (`POST /documents/:id/generate`) | When the template has `autoSendOnGenerate`, the finished document (optionally with PDF) is emailed to the user automatically |
| Signature request | `POST /signing/request` | Auto-sends `signing-request` to the signer with their personal signing link |
| Reminder / resend | Document detail → resend | Re-sends `signing-request-resend` |
| Fully-signed receipt | Guest signing (`POST /signing/guest/:token`) | Emails `document-completed` to the document owner |
| Welcome / password reset | Auth routes | `welcome` on registration, `reset-password` on reset request |

### The six system templates

| Key | Sent when |
|---|---|
| `signing-request` | Signing request created (auto) |
| `signing-request-resend` | Manual reminder from the document page |
| `document-delivered` | Document delivered to a client (manual, or auto when `autoSendOnGenerate`) |
| `document-completed` | Last required signature collected |
| `welcome` | New account registered |
| `reset-password` | Password reset requested (link valid 30 min) |

Merge fields are documented per template and shown as clickable chips in the
editor (e.g. `{{signer_name}}`, `{{document_title}}`, `{{signing_link}}`,
`{{expiry_days}}`). Unknown/empty fields simply render blank.

### Where the data lives

- `email_templates` — admin overrides (created on first save; delete = reset to built-in default).
- `email_logs` — every attempt with `status` = `sent` (SMTP delivered) | `logged` (SMTP off — dev/mock) | `failed` (template disabled or error). Subject + full rendered HTML are stored, so you can always audit *what* was sent.
- Built-in defaults live in `server/src/services/mailer.service.ts` (`DEFAULTS`) and are the fallback whenever no override row exists.

---

## 2. Go live with real delivery (Brevo — free 300 emails/day)

Emails are currently **logged, not delivered** (the UI shows a warning banner).
To deliver:

1. Create a free account at **brevo.com** (no card required).
2. **Senders & IP → Senders → Add a sender** and verify the email address you will send from (e.g. `noreply@yourdomain.com`). Verify via the link Brevo emails you.
3. **SMTP & API → SMTP → Generate a new SMTP key**. Copy the key.
4. On the VM, add these to `/opt/legalok/server/.env`:

```ini
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=<your Brevo login email>
SMTP_PASS=<the SMTP key you copied>
EMAIL_FROM=Legalok <noreply@yourdomain.com>
```

5. Restart and verify:

```bash
sudo systemctl restart legalok
sleep 5 && curl -s localhost:4000/api/health
```

6. Confirm in the app: **Admin → Emails** — the yellow "SMTP not configured"
   banner disappears and **Send test to me** results in a real inbox delivery
   (`email_logs.status = 'sent'`).

### Deliverability (do this or mail lands in spam)

Add the records Brevo shows under **Senders & IP → Domains → Authenticate** to
your DNS (Cloudflare → your zone → DNS → Add record):

| Type | Purpose | Notes |
|---|---|---|
| TXT | SPF | `v=spf1 include:spf.sendinblue.com ~all` on the root domain |
| TXT / CNAME | DKIM | 2–3 records exactly as Brevo prints them (`mail._domainkey` …) |
| TXT | DMARC (optional) | `v=DMARC1; p=none; rua=mailto:you@yourdomain.com` |

Use the **same domain** in `EMAIL_FROM` that you authenticate, otherwise SPF/DKIM
will not line up.

---

## 3. Test checklist

1. **Admin → Emails → Send test to me** for each template; check the inbox and `email_logs`.
2. **Admin → Template Studio → Email Merge**: edit a subject, save, re-preview (the live preview uses realistic sample data).
3. **Template with `autoSendOnGenerate`**: open it in Template Studio, enable the switch, then generate a document from it — the delivery email (with PDF, if enabled) arrives automatically.
4. **Document detail → Email this document**: preview → change recipient → send. Check the PDF attachment opens.
5. **Signature flow**: request a signature → signer receives `signing-request` with their link; sign through the guest page → owner receives `document-completed`.
6. **Password reset** → reset email with a working link.

### Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `status = 'logged'` instead of `sent` | `SMTP_USER` empty on the server — re-check `.env` and restart |
| `status = 'failed'` with "template disabled" | That template's **Enabled** switch is off in the Studio |
| Login error `535 Authentication failed` | Use the **SMTP key**, not your Brevo account password |
| No email arrives, no error | Check spam; verify SPF/DKIM; confirm the sender address is verified |
| Quota | Brevo free = 300 emails/day; upgrade or switch provider by changing only the `SMTP_*` values |

Any SMTP provider works (Brevo, SES, Postmark, Gmail app passwords) — it is a
pure config swap because everything funnels through `sendMail()` in
`server/src/services/mailer.service.ts`.
