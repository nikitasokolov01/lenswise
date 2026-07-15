# Vercel Deployment Guide (LensWise SaaS)

Deploy the Next.js app to Vercel with Supabase as the backend. Complete
[docs/SUPABASE_SETUP.md](./SUPABASE_SETUP.md) first.

## 1. Push to a Git provider

Push this repository to GitHub / GitLab / Bitbucket.

## 2. Import into Vercel

1. <https://vercel.com/new> → **Import** your repository.
2. Framework preset: **Next.js** (auto-detected). Build command `next build`,
   output handled automatically. No changes needed.

## 3. Environment variables

In **Project → Settings → Environment Variables**, add the following for the
**Production** (and **Preview**, if you use preview deployments) environments:

| Name | Value | Exposure |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role key | **Secret** |
| `LENSWISE_SUPER_ADMIN_EMAIL` | your Super Admin email | **Secret** |

- Only the two `NEXT_PUBLIC_*` values are sent to the browser.
- `SUPABASE_SERVICE_ROLE_KEY` and `LENSWISE_SUPER_ADMIN_EMAIL` must **never** carry a
  `NEXT_PUBLIC_` prefix — they are read only in Server Actions / Route Handlers.
- Vercel encrypts environment variables at rest; secrets are not exposed in the
  client bundle.

## 4. Supabase Auth redirect URLs

In Supabase **Authentication → URL Configuration**, add your Vercel URLs:

- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs**: `https://your-app.vercel.app/**` (covers the
  password-reset callback). If you use preview deployments, also add
  `https://*.vercel.app/**`.

## 5. Deploy

Click **Deploy**. On the first deploy:

1. Ensure the Supabase migrations from `supabase/migrations/` have been applied
   (CLI `supabase db push` or the SQL editor).
2. Sign in once with `LENSWISE_SUPER_ADMIN_EMAIL`, then confirm the Super Admin was
   promoted (see Supabase setup step 4).

## 6. Custom domain (optional)

**Project → Settings → Domains** → add your domain and follow the DNS steps.
Then update the Supabase **Site URL** / **Redirect URLs** to the custom domain.

## 7. Post-deploy checklist

- [ ] Migrations applied; RLS enabled on all tables.
- [ ] Super Admin promoted; Platform Admin page reachable only by them.
- [ ] Service-role key set as a **secret** (never `NEXT_PUBLIC_`).
- [ ] A test org can be created only with a valid registration key.
- [ ] Two orgs cannot see each other's pricing (RLS verified).
- [ ] Disabling an org blocks its use even with an active session.
- [ ] `npm run build` succeeds locally before pushing.
