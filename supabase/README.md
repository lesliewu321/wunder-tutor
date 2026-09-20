# Family accounts — Supabase

Project **Wunder Tutor** (`xzghsihffoliduqkjvck`, Singapore, org `lesliewu321`). It holds children's data: read the
header of `migrations/20260920090000_accounts_and_sync.sql` before changing anything.

## What is where

| | |
| --- | --- |
| `migrations/` | The database. Applied with the Supabase MCP (`apply_migration`) — keep the files and the project in step. |
| `tests/rls.sql` | Every access rule tried with two made-up families. Always rolls back; the outcome arrives as the error message (`ALL OK`). Run it after every migration. |
| `archive/` | The earlier 27-table draft, kept for reference. |
| `src/account/` (app) | `merge.ts` (two devices → one learner), `sync.ts` (the engine, tested with pretend devices), `supabase.ts` (the real server; loaded only with an account), `account.ts` (sign-in, triggers), `pending.ts`. |
| `server/family.mjs` (API) | Checks the sign-in token (public keys, no secret), reads the family's plan, counts the day's use. |

**Design in one paragraph.** Only the grown-up signs in (a code by email). A learner is ONE document (`learners.state`,
the app's `ChildProfile`) with a revision: a device sends the revision it last saw; if another device was first the
write finds no row, and the device merges and retries. My book's pages are small rows of their own (newer wins, best
scores from both). Deleted learners and pages stay as empty tombstones so other devices delete them too. Recordings,
attempts and photos never leave the device. `usage_daily` and `plans` are written by the API only (secret key).
Plans: `free` (unlocks nothing yet), `beta` (given the first time the beta access code arrives together with a
sign-in — after that the account alone unlocks the API on any device), `family` (paid, later). Daily limits per plan
are in `server/family.mjs`.

## Dashboard settings (done by hand — the MCP can't)

1. **Authentication → URL Configuration**: Site URL `https://app.wundertutor.com`; Redirect URLs
   `https://app.wundertutor.com/**` (and `http://localhost:5173/**` for development).
2. **Authentication → Emails**: the two templates below — the app asks for the **code**, the default emails only
   carry a link. A first sign-in sends "Confirm signup", later ones "Magic Link": both need the code.
3. **Project Settings → API Keys**: the **secret** key (`sb_secret_…`) goes into `.env` as `SUPABASE_SECRET_KEY`,
   then `npm run keys:push` (Leslie does this; the key is never shown to Claude) and a deploy.
4. Before real families: **custom SMTP** (Authentication → Emails → SMTP; e.g. Resend on wundertutor.com). The
   built-in mailer only writes to the project's own team and only a few emails an hour.

### How long the code is

A dashboard setting (Authentication → Sign In / Providers → Email OTP length): Supabase's default is 6, **this
project is set to 8**, and 10 is the most it allows. The app deliberately never says a number — it asks for "the code
from the email" and accepts 6 to 10 digits — so changing this setting can never make the app tell a parent something
untrue. The templates below use `{{ .Token }}`, which is whatever length is set.

### Email templates (both "Confirm signup" and "Magic Link")

Subject: `Your Wunder Tutor code: {{ .Token }}`

```html
<h2>Wunder Tutor</h2>
<p>Your sign-in code is:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
<p>Type it into the app. It works for one hour.</p>
<p>On the same device you can also <a href="{{ .ConfirmationURL }}">sign in with this link</a>.</p>
<p>If you didn't ask for this, you can ignore this email.</p>
<hr>
<p>你的 Wunder Tutor 登入驗證碼是 <b>{{ .Token }}</b>，請在應用程式內輸入，一小時內有效。</p>
```

## Not built yet

Payments (`plans.plan = 'family'` from Stripe / the stores), purging old tombstones, a "your family's use today"
line in the Parent Zone, Google / Apple sign-in for the phone apps, and the legal pack the consent wording points to.
