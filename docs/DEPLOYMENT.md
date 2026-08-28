# Deployment guide

This app deploys as two independent services: the API + Postgres on **Railway**, the static frontend on **Vercel**. Nothing here can be run on your behalf — it requires your own Railway/Vercel/Stripe accounts and a domain if you want one. Everything below is written so you can follow it directly from the CLI or dashboard.

## 0. Generate the initial migration (do this once, before any deploy)

This repo ships `backend/prisma/schema.prisma` but **no migration history** — generating one requires a reachable Postgres instance, which this build environment didn't have. Do it locally first:

```bash
cd backend
docker compose -f ../docker-compose.yml up -d postgres   # or point DATABASE_URL at any Postgres
cp .env.example .env
npx prisma migrate dev --name init
git add prisma/migrations && git commit -m "Add initial Prisma migration"
```

`prisma migrate deploy` (used in production, below) applies committed migrations — it will not generate them.

## 1. Backend → Railway

1. `railway login`, then from `backend/`: `railway init` (or link an existing project: `railway link`).
2. Add a **Postgres** plugin in the Railway dashboard (or `railway add`) — this sets `DATABASE_URL` automatically in the service's environment.
3. Add a **Redis** plugin the same way — sets a Redis connection string; map it to `REDIS_URL` in the service's env vars (Railway's Redis plugin exposes its own var name — copy its value into `REDIS_URL`, or reference it directly).
4. Set the remaining environment variables on the Railway service (Settings → Variables), matching `backend/.env.example`:
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — generate real random 32+ char secrets (`openssl rand -base64 32`), never reuse the example values.
   - `NODE_ENV=production`
   - `CORS_ORIGIN` — your Vercel frontend's URL, e.g. `https://operadash.vercel.app` (no trailing slash, no wildcard — required for cross-site cookies to work, see below).
   - `COOKIE_SECURE=true`
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — from the Stripe dashboard, test mode.
   - `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` — override the defaults before seeding production.
5. Railway builds from `backend/Dockerfile` (this repo's `railway.json` points at it) and runs `railway.json`'s `deploy.startCommand`: `npx prisma migrate deploy && node dist/server.js`. If your Railway project root is the monorepo root rather than `backend/`, set the service's **Root Directory** to `backend` in Settings.
6. `railway up` (or push to the connected GitHub branch for auto-deploy).
7. Seed production data once, from your machine with `DATABASE_URL` pointed at the Railway Postgres (Railway dashboard → Postgres → Connect for the external connection string): `cd backend && npm run seed`.
8. Confirm `https://<your-service>.up.railway.app/health` returns `{"status":"ok"}`.

## 2. Frontend → Vercel

1. `vercel login`, then from `frontend/`: `vercel link` (or `vercel` to create a new project).
2. Set environment variables (Vercel dashboard → Settings → Environment Variables, or `vercel env add`):
   - `VITE_API_URL` = your Railway backend's base URL, e.g. `https://operadash-api.up.railway.app` (no trailing `/api` — the client appends it).
   - `VITE_SOCKET_URL` = the same Railway URL (Socket.io connects there directly).
3. `vercel --prod` (or connect the GitHub repo for auto-deploy on push to `main`; `frontend/vercel.json` already sets the build command/output directory and SPA rewrites).
4. Once deployed, go back to Railway and set `CORS_ORIGIN` to the exact Vercel production URL if you haven't already, then redeploy the backend so CORS reflects it.

## 3. Cross-origin cookies — why this matters

Railway and Vercel are different origins, so the session cookie is cross-site. `backend/src/routes/auth.routes.ts` already handles this: when `COOKIE_SECURE=true` (production), cookies are set `SameSite=None; Secure` instead of `Lax`. If login appears to succeed but every subsequent request 401s in production, it's almost always one of:

- `CORS_ORIGIN` on the backend doesn't exactly match the frontend's origin (protocol + host, no trailing slash).
- `COOKIE_SECURE` isn't `true` on the backend.
- The frontend is calling the backend over `http://` instead of `https://` (Railway serves HTTPS by default — use the `https://` URL in `VITE_API_URL`).

## 4. Stripe

Test-mode only in this build. In the Stripe dashboard: Developers → API keys → copy the test **Secret key** into `STRIPE_SECRET_KEY`. Developers → Webhooks → add an endpoint at `https://<your-backend>/api/billing/webhook`, subscribe to `checkout.session.completed`, copy its **Signing secret** into `STRIPE_WEBHOOK_SECRET`.

## 5. Custom domain (optional)

Point `operadash.com` at Vercel (frontend) per Vercel's domain docs, and something like `api.operadash.com` at Railway per Railway's custom domain docs. Update `CORS_ORIGIN`, `VITE_API_URL`, and `VITE_SOCKET_URL` accordingly and redeploy both.

## Estimated cost

Railway: free trial credit, then usage-based (~$5–10/mo for this workload — Postgres + Redis + one small API instance). Vercel: free tier is sufficient for the frontend indefinitely at this traffic level.
