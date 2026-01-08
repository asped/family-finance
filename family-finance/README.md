# Rodinný Finančný Analyzátor (PoC)

Webová aplikácia na konsolidáciu a analýzu transakcií z viacerých bankových účtov pre analýzu rodinného cash flow.

## Funkcie

### 1. Manual Importer
- Nahrávanie súborov z bánk (CSV, XLSX, SEPA XML)
- Automatická detekcia banky podľa hlavičiek súboru
- Podporované banky:
  - **mBank** - CSV (bodkočiarka ako oddeľovač, ABO formát)
  - **SLSP (George)** - SEPA XML (camt.053), Excel (XLSX)
  - **Revolut** - CSV, Excel (retail verzia)
  - **Patria Finance** - XLSX, CSV (investičné pohyby)
  - **Portu** - CSV (investičné pohyby)
- Deduplikácia transakcií pomocou hashu (dátum + suma + popis)
- Strategy pattern pre ľahké pridávanie nových parserov

### 2. API Integrator (Enable Banking)
- Integrácia s Enable Banking API (AISP)
- Automatická synchronizácia transakcií
- Správa súhlasov (consent management)
- Podpora slovenských bánk cez PSD2

### 3. Analytický Dashboard
- **Celkový rodinný príjem** (bez interných prevodov)
- **Celkový rodinný výdavok** (bez interných prevodov)  
- **Čistý Cash-flow**
- Výdavky podľa kategórií
- Mesačný prehľad

### 4. Detekcia Interných Prevodov
- Automatické označenie prevodov medzi vlastnými účtami
- Algoritmus: +/- 1 deň, opačné znamienko, rovnaká suma
- Vyradenie z výpočtu cash-flow

### 5. Automatická Kategorizácia
- Rule-engine na základe kľúčových slov
- Kategórie: Groceries, Fuel, Utilities, Restaurants, Transport, Entertainment, Health, Shopping, Housing, Salary, Investment, atď.

## Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Jazyk:** TypeScript
- **Styling:** Tailwind CSS
- **Komponenty:** shadcn/ui štýl
- **ORM:** Prisma
- **Databáza:** SQLite (lokálna)
- **Parsovanie:** xlsx, csv-parser

## Inštalácia

```bash
# Klonovanie repozitára
cd family-finance

# Inštalácia závislostí
npm install

# Vytvorenie databázy
npx prisma db push

# Spustenie vývojového servera
npm run dev
```

Aplikácia beží na `http://localhost:3000`

## Konfigurácia

### Environment Variables (.env)

```env
# Database
DATABASE_URL="file:./dev.db"

# Enable Banking API (voliteľné)
ENABLE_BANKING_APP_ID="your-app-id"
ENABLE_BANKING_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
ENABLE_BANKING_REDIRECT_URI="http://localhost:3000/api/enable-banking/callback"
```

## Štruktúra projektu

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Dashboard
│   ├── transactions/      # Prehľad transakcií
│   ├── accounts/          # Správa účtov
│   ├── import/            # Manuálny import
│   └── enable-banking/    # API integrácia
├── actions/               # Server Actions
│   ├── accounts.ts        # CRUD pre účty
│   ├── transactions.ts    # CRUD + analytics
│   └── import.ts          # Spracovanie importu
├── components/            # React komponenty
│   └── ui/               # shadcn/ui komponenty
├── lib/                   # Utility funkcie
│   ├── utils.ts          # Helpers, kategorizácia
│   ├── prisma.ts         # Prisma client
│   └── enable-banking.ts # Enable Banking SDK
├── parsers/              # Bankové parsery (Strategy pattern)
│   ├── BaseParser.ts     # Abstraktná trieda
│   ├── MBankParser.ts    # mBank CSV
│   ├── SLSPParser.ts     # SLSP XML/XLSX
│   ├── RevolutParser.ts  # Revolut CSV/XLSX
│   ├── PatriaParser.ts   # Patria XLSX
│   ├── PortuParser.ts    # Portu CSV
│   └── index.ts          # ParserManager
└── types/                # TypeScript typy
```

## Pridanie novej banky

1. Vytvorte nový parser v `src/parsers/`:

```typescript
import { BaseParser } from './BaseParser';
import { ParsedTransaction, BankName } from '@/types';

export class NewBankParser extends BaseParser {
  name: BankName = 'NewBank';
  
  canParse(headers: string[], content: string): boolean {
    // Implementujte detekciu
  }
  
  async parse(content: string | ArrayBuffer, filename: string): Promise<ParsedTransaction[]> {
    // Implementujte parsovanie
  }
  
  detectAccountNumber(content: string | ArrayBuffer): string | null {
    // Implementujte detekciu čísla účtu
  }
}
```

2. Zaregistrujte parser v `src/parsers/index.ts`:

```typescript
import { NewBankParser } from './NewBankParser';

// V konstruktore ParserManager
this.registerParser(new NewBankParser());
```

## Databázová schéma

### Account
- `id` - Unikátny identifikátor
- `bankName` - Názov banky (mBank, SLSP, Revolut, ...)
- `accountNumber` - Číslo účtu / IBAN
- `ownerName` - Meno majiteľa
- `type` - CHECKING / INVESTMENT / SAVINGS
- `currency` - Mena účtu

### Transaction
- `id` - Unikátny identifikátor
- `accountId` - Prepojenie na účet
- `date` - Dátum transakcie
- `amount` - Suma (záporná = výdavok)
- `currency` - Mena
- `counterparty` - Protistrana
- `description` - Popis
- `category` - Kategória
- `variableSymbol` - Variabilný symbol
- `isInternalTransfer` - Či je to interný prevod
- `transactionHash` - Hash pre deduplikáciu

## Deployment na Vercel

### 1. Vytvorte Neon databázu (zadarmo)

1. Choďte na [neon.tech](https://neon.tech) a vytvorte účet
2. Vytvorte nový projekt
3. Skopírujte connection string (bude vyzerať ako `postgresql://user:pass@host/db`)

### 2. Nasaďte na Vercel

```bash
# V root priečinku projektu
cd family-finance
vercel
```

Alebo cez GitHub:
1. Push kód na GitHub
2. Importujte projekt na [vercel.com](https://vercel.com)
3. Nastavte environment variables:
   - `DATABASE_URL` - Neon connection string (pooled)
   - `DIRECT_URL` - Neon connection string (direct)

### 3. Inicializujte databázu

Po nasadení spustite:
```bash
npx prisma db push
```

Alebo cez Vercel CLI:
```bash
vercel env pull .env.local
npx prisma db push
```

## Licencia

MIT
