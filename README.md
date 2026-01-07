# family-finance

Aplikácia na analýzu rodinných financií - príjmov a výdavkov domácnosti.

## Štruktúra projektu

- `/family-finance` - Hlavná Next.js aplikácia (Rodinný Finančný Analyzátor PoC)
- `/docs` - Dokumentácia a research

## Quick Start

```bash
cd family-finance
npm install
npx prisma db push
npm run dev
```

Aplikácia beží na `http://localhost:3000`

## Dokumentácia

- [Research: Integrácia finančných dát](docs/RESEARCH.md) - Podrobná analýza technických riešení, API a dátových formátov pre slovenské finančné inštitúcie (SLSP, mBank, Revolut, Patria, Portu, PSS)
- [README aplikácie](family-finance/README.md) - Dokumentácia k Next.js aplikácii
