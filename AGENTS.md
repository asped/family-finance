# AGENTS.md

## Cursor Cloud specific instructions

### Project overview
This is a Next.js 14 family finance tracking application (Rodinný Finančný Analyzátor) located in the `family-finance/` subdirectory. It uses Prisma ORM with PostgreSQL for data storage.

### Services
| Service | How to run | Port |
|---------|-----------|------|
| Next.js dev server | `npm run dev` (from `family-finance/`) | 3000 |
| PostgreSQL | `sudo pg_ctlcluster 16 main start` | 5432 |

### Key commands (run from `family-finance/`)
- **Dev server:** `npm run dev`
- **Lint:** `npm run lint`
- **Build:** `npm run build`
- **DB schema sync:** `npx prisma db push`
- **DB studio:** `npm run db:studio`

### Non-obvious caveats
- PostgreSQL must be started manually before running the app: `sudo pg_ctlcluster 16 main start`
- The `.env` file in `family-finance/` contains the local PostgreSQL connection string. The database name, user, and password are all `familyfinance`.
- The Prisma schema uses `directUrl` for migrations, both `DATABASE_URL` and `DIRECT_URL` point to the same local PostgreSQL in dev.
- ESLint v8 is required (not v9) for compatibility with Next.js 14. The `.eslintrc.json` is configured with `@typescript-eslint` plugin. Pre-existing lint warnings exist in the codebase but are set to warn level so they don't block builds.
- Enable Banking API integration is optional; the app works fully with manual CSV/XLSX file imports without API keys.
- The `postinstall` script in `package.json` runs `prisma generate` automatically on `npm install`.
