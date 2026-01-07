# family-finance
App for my analyzing finances

## Web app (PoC)

Kód PoC web aplikácie je v priečinku `web/` (Next.js App Router, TypeScript, Tailwind, shadcn/ui, Prisma, SQLite).

### Spustenie lokálne

```bash
cd web
npm install
npx prisma migrate dev
npm run dev
```

Potom otvor `http://localhost:3000`.

### Moduly

- **Manual Importer**: `/import` (upload CSV/XLSX/SEPA XML/ABO) → uloží do SQLite s deduplikáciou (deterministické `Transaction.id`).
- **Enable Banking (AISP)**: `/connections` (vytvorenie prepojenia + sync cez API).
- **Všetky transakcie**: `/transactions` (tabuľka + filtre).
- **Dashboard**: `/` (príjem/výdavok/cash-flow bez interných prevodov + tlačidlo na prepočet interných prevodov).

### Env vars (Enable Banking)

V `web/.env` doplň podľa potreby:

- `ENABLE_BANKING_BASE_URL`
- `ENABLE_BANKING_CLIENT_ID`
- `ENABLE_BANKING_ACCESS_TOKEN` (ak tvoj EB účet používa bearer token; PoC wrapper počíta s týmto jednoduchým modelom)

## Research / kontext (finančné dáta)

- `docs/financial-data-integration-research.sk.md` — architektúra integrácie finančných dát (PSD2 kontext, dostupnosť API vs. exporty, agregátori, bezpečnosť, odporúčaný roadmap).
