# Deployment — live at https://www.malachitopp.com (Vercel + Neon, since 2026-09-16)

Read this only for deploy, hosting, env-var-on-host or domain work. Overview: `context/PROJECT.md`.

## How changes reach the live site
- **Code**: push to `main` → Vercel builds and deploys production (≈ 1 min). Even a push of only `context/`
  files redeploys (harmless). Other branches get **preview deployments** (their own URL). **Previews are
  behind Vercel login** (a plain fetch 302s to `vercel.com/sso-api`) — the user must be logged in to Vercel,
  on the phone too. Find the URL: Vercel dashboard → Deployments, the PR's Vercel comment, the commit's ✓ →
  Details, or `gh api repos/Malachitopp/website-/deployments?sha=<sha>` → `/deployments/<id>/statuses`
  (`environment_url`). From the desktop,
  `vercel deploy --prod` at the repo root also works (CLI logged in as `malachitopp-5255`).
- **Gallery content**: added on the live site (faint `+` or shift+A on the wall, then the `ART_SECRET` word) →
  Cloudinary + **Neon**, not git. Neon and local Docker are separate databases; Cloudinary's `art` folder is shared
  by both, so local test uploads land beside live ones.

## Vercel
- Project **`malachi-topp`** (Hobby, team scope `ps-2ddc`), Git-connected to `Malachitopp/website-`, production
  branch `main`; also `https://malachi-topp.vercel.app`.
- **`vercel.json`**: `framework: null`; `regions: ["lhr1"]` (next to Neon; Hobby allows one); install
  `npm install && npm install --prefix frontend`; build `npm run build` (backend → `dist/backend`) **then**
  `npm run build --prefix frontend`; output `frontend/dist`; rewrites `/api/(.*)` → `/api` and everything else →
  `/index.html` (SPA fallback; real files are served first).
- **`api/index.js` must stay plain JS re-exporting `dist/backend/app.js`.** Vercel compiles a `.ts` function with the
  project's own `typescript`, and TypeScript 7 has no JS API, so the build would break. It works because static
  builds run before `@vercel/node`, so `dist/` exists. Express still sees the original path.
- **`.vercelignore`**: `.env`, `.env.*`, `pictures/`, `tools/`, `node_modules/`, `dist/`, `frontend/node_modules/`,
  `frontend/dist/`.
- **Env vars (production and preview)**: `CLIENT_ID`, `CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN`,
  `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `ART_SECRET`, `DATABASE_URL` = Neon's
  **pooled** URL with `sslmode=verify-full`. **Deliberately not set**: `ENABLE_SPOTIFY_LOGIN` (keeps `/login` and
  `/callback` local-only), `REDIRECT_URI`, `POSTGRES_*`. Stored as sensitive (can't be read back). To change one:
  update `.env`, pipe the value from `node --env-file=.env` into `vercel env add NAME <target> --yes --force` on
  stdin (never on a command line — and Node's resolution matters because `.env` has the refresh token twice), then
  redeploy.
- Production is same-origin through the rewrite (the Vite proxy is dev-only), so no CORS.
- Not used: Vercel *Services* and Express zero-config detection.

## Neon
- Created by the user on Neon directly; `eu-west-2` (London), Postgres **18**, database `neondb`. Direct and pooled
  URLs are in a **comment block** in `.env` (the active `DATABASE_URL` is local Docker). Both migrations applied
  2026-09-16 in one transaction over the direct URL with a throwaway `pg` script. Use `sslmode=verify-full` (pg warns
  about `require`).

## Domain and DNS
- `malachitopp.com` (the user owns it). **`www.malachitopp.com` is primary**; the apex 308-redirects to it.
- DNS is on **Cloudflare and must stay there** — the domain carries **Zoho Mail** (MX `mx.zoho.eu` 10 / `mx2` 20 /
  `mx3` 50, SPF `v=spf1 include:zohomail.eu ~all`), which moving nameservers to Vercel would drop.
- Records: CNAME `@` and CNAME `www` → `0c2b5bf888a18659.vercel-dns-017.com`, **DNS only (grey cloud)**. Fallbacks:
  A `216.198.79.1` + `64.29.17.1`, or `76.76.21.21` / `cname.vercel-dns.com`. Certificates are Vercel's Let's
  Encrypt, auto-renewed.

## Checks
- Verified live 2026-09-16: `/`, `/studio`, `/studio/easel/gallery`, `/spotify` → 200; `/api/now-playing`,
  `/api/top/artists` → real data; `GET /api/art` → `{"art":[]}`; signature/POST → 401 without the secret, signature →
  200 with it; unknown `/api` → 404; function in `lhr1`; `http://` → 308. **Not yet tested: a real upload.**
- From Git Bash: `MSYS_NO_PATHCONV=1 vercel api /v9/projects/malachi-topp` (Git link, aliases),
  `/v6/domains/<name>/config?projectIdOrName=malachi-topp` (misconfigured?, recommended records).
- DNS without local caching: `curl -H 'accept: application/dns-json'
  'https://cloudflare-dns.com/dns-query?name=www.malachitopp.com&type=A'` — `104.21.*`/`172.67.*` answers mean proxied.
- Optional: the local Vercel CLI is 58.5.1; `npm i -g vercel@latest` for 59.x.
