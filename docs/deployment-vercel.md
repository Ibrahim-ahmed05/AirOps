# Deploy AirOps on Vercel

The application has two npm workspaces. Create two Vercel projects from the same Git repository and connect a hosted PostgreSQL database. The local Docker data does not transfer with Git.

## 1. Database

Create a PostgreSQL database through a Vercel Marketplace provider (for example Neon). Choose a region near the API. Use its pooled connection URL for API traffic and its direct URL for migrations/imports. Follow the provider's TLS instructions; do not disable certificate verification.

For an empty hosted database, from the repository root in PowerShell:

```powershell
$env:DATABASE_URL = 'YOUR_DIRECT_DATABASE_URL'
npm run db:migrate --workspace=apps/api
npm run seed -- 520000
```

Run the seed once against an empty database: the seeder appends records on subsequent runs. To preserve the exact existing test dataset, use PostgreSQL pg_dump/pg_restore instead. Do not run migrations or a 520k seed on every Vercel build or inside an HTTP function.

## 2. API project

- Import the repository; project name such as `airops-api`.
- Root Directory: `apps/api`.
- Framework: Fastify (also set in `apps/api/vercel.json`).
- Keep framework build/output defaults; do not configure `dist` as a static output directory.
- Environment: `NODE_ENV=production`, `DATABASE_URL=<pooled URL>`, `CORS_ORIGIN=https://<frontend-production-domain>`, `DB_POOL_MAX=5`.
- `src/server.ts` is a supported Vercel entrypoint. Fastify's listen call is supported by Vercel's native integration; a custom serverless adapter is not required.
- Deploy and verify `/health` returns HTTP 200 and `database.status=connected`.

Create the frontend project first if necessary to reserve its domain, then configure the API's exact CORS origin. Preview URLs need their own matching CORS setting; allowing every origin is not authentication.

## 3. Frontend project

- Import the same repository again; project name such as `airops-web`.
- Root Directory: `apps/web`.
- Framework: Next.js; build command `npm run build`; default output settings.
- Set `NEXT_PUBLIC_API_URL=https://<api-production-domain>` before building.
- Deploy. If this variable changes, redeploy: Next.js embeds public variables during the build.
- Keep the workspace root lockfile in Git and let Vercel detect npm workspaces.

Never set DATABASE_URL in a NEXT_PUBLIC variable. Never commit `.env` or credentials.

## 4. Verify the link before sending it

- Open the frontend production URL in a private browser session using the same access level your reviewer will have.
- Confirm the dashboard count, flights, filters, pagination and detail pages work.
- Confirm the browser requests your hosted API rather than localhost, with no CORS or deployment-protection errors.
- Confirm `/health` reports a connected database.
- Send the frontend production URL, Git commit and the test report link together.
- Keep Vercel deployment protection enabled for a private demo, or explicitly configure intended reviewer access. The existing status-update API has no authentication and must not be treated as a public production operations system.

The local capacity measurements do not certify Vercel capacity. Retest on the deployed infrastructure within provider limits and a defined cost budget before making a hosted concurrency claim.

## Deployment status

Configuration is supplied; no live URL is claimed by this document. Deployment requires the user's Vercel project access and hosted database configuration. Update this section with the verified production URL once deployed.

## Official references

- https://vercel.com/docs/frameworks/backend/fastify
- https://vercel.com/docs/monorepos
- https://vercel.com/docs/postgres
- https://vercel.com/kb/guide/connection-pooling-with-functions
