# Architektúra a technické riešenia integrácie finančných dát pre domácu analýzu cash flow

> Poznámka: Tento dokument je technický research a **nie je právne poradenstvo**. Pri reálnom napojení na bankové API (najmä produkčné) rátaj s požiadavkami na licenciu/registráciu a bezpečnostné certifikáty.

## Cieľ a rámec

Cieľom je navrhnúť realistickú architektúru pre domácu aplikáciu, ktorá zjednotí dáta z viacerých zdrojov:

- **Banky**: Slovenská sporiteľňa (SLSP), mBank
- **Fintech**: Revolut (Retail aj Business)
- **Investície**: Patria, Portu
- **Sporenie**: Prvá stavebná sporiteľňa (PSS)

Kľúčový problém: v EÚ otvorené bankovníctvo (PSD2) síce vytvorilo API povinnosti pre banky, ale prístup k produkčným rozhraniam je v praxi viazaný na **licencovaného TPP** (Third Party Provider) a súvisiace bezpečnostné požiadavky. Pre individuálny domáci projekt to typicky znamená **hybridný prístup**:

- **API cez agregátora** pre banky (a často aj Revolut Retail)
- **manuálny/poloautomatický import súborov** pre investície a sporiteľne

## Regulačný kontext (PSD2 / otvorené bankovníctvo)

PSD2 zaviedla povinnosť bánk (ASPSP) sprístupniť dáta o platobných účtoch tretím stranám na základe súhlasu klienta. V praxi je dôležité rozlíšenie:

- **AISP** (Account Information Service Provider): čítanie účtov, zostatkov, transakcií
- **PIS** (Payment Initiation Service): iniciácia platieb
- **PIISP**: overovanie dostupnosti prostriedkov

Pre domácu aplikáciu (cash flow) je primárny prípad použitia **AISP**.

### Čo to znamená pre „single-developer“ appku

- Priama integrácia s bankami v produkcii obvykle vyžaduje licenciu/registráciu a bezpečnostné certifikáty (typicky QWAC/QSealC).
- Najpraktickejšia cesta bez licencie je:
  - použiť **licencovaného agregátora** (AaaS) a implementovať iba klientsku integráciu,
  - alebo stavať na **exportoch výpisov** (SEPA XML/CSV/ABO/PDF) a robiť import lokálne.

## Porovnanie dostupnosti dát podľa inštitúcie (praktický pohľad)

| Inštitúcia | API | Prístup pre jednotlivca | Typický export | Real-time |
|---|---|---|---|---|
| SLSP | Áno (George/Erste) | najmä Sandbox alebo cez TPP/agregátora | SEPA XML (camt.053) | áno (cez TPP), prípadne callback pre biznis scenáre |
| mBank | Áno (PolishAPI) | najmä Sandbox alebo cez TPP/agregátora | CSV, ABO, PDF | áno (cez TPP) |
| Revolut Retail | nie verejné | agregátor alebo manuálne exporty | CSV/Excel/PDF | áno (cez TPP) |
| Revolut Business | Áno (Business API) | priamy prístup (API key/OAuth podľa produktu) | JSON/CSV | áno |
| Patria | nie verejné | manuálny export | XLSX | nie |
| Portu | nie verejné | manuálny export | CSV | nie |
| PSS | nie | manuálne (portál/ročne výpisy) | PDF | nie |

## Detaily k bankám

### SLSP / Erste ekosystém

- Moderné REST API (JSON), sandbox a developer portál.
- Produkčný prístup: spravidla certifikáty + TPP režim.
- **Najlepšia alternatíva pre domáci import**: export výpisov v **SEPA XML camt.053** (ISO 20022).
  - camt.053 je „zlatý štandard“ pre strojové spracovanie výpisov: štruktúrovaný, stabilný, vhodný na dlhodobú archiváciu.

### mBank / PolishAPI

- Štandardizované rozhranie (PolishAPI), SCA cez redirect do banky, consent per účet.
- Časté požiadavky na „silné“ request hlavičky (unikátne ID, podpisy).
- Pre domácu integráciu je kľúčové, že mBank tradične umožňuje export v:
  - **CSV** (najjednoduchší import),
  - **ABO/GPC** (regionálny formát; import je náročnejší, ale stabilný).

## Fintech a investície

### Revolut (Retail vs Business)

- **Retail**:
  - bez verejného API kľúča,
  - typicky manuálne exporty alebo agregátor.
- **Business**:
  - natívne API pre transakcie/zostatky (a ďalšie funkcie),
  - vhodné pre automatizáciu cash flow, ak je účet „business“.

### Patria a Portu

- typicky bez otvoreného transakčného API pre retail.
- cesta je **export → import**:
  - Patria: najmä **XLSX**
  - Portu: najmä **CSV**

### PSS (stavebné sporenie)

- bez real-time API,
- prístup najmä cez portál a ročné výpisy,
- pre appku realisticky:
  - manuálne zadávanie ročných/měsíčných stavov, alebo
  - parsovanie PDF (vyššia chybovosť; vhodné len ako „nice-to-have“).

## Strategické možnosti integrácie (AaaS vs. vlastná integrácia)

### AaaS (Aggregation as a Service) – praktická cesta bez licencie

Vhodné pre: SLSP, mBank, často aj Revolut Retail.

- **Enable Banking**: dôraz na model bez ukladania dát na ich strane (z pohľadu bezpečnosti zaujímavé), často prístupné aj pre menšie projekty.
- **GoCardless / Nordigen**: historicky populárne pre individuálnych vývojárov, no podmienky sa môžu meniť (riziko udržateľnosti bezplatných plánov).
- **Salt Edge**: špičkové pokrytie, ale onboarding/cena často orientované na firmy.

### Suverénny prístup (bez agregátora)

Vhodné pre: investície/správy účtov, kde API nie je.

Typické formáty a spracovanie:

| Formát | Zdroje | Poznámka | Spracovanie |
|---|---|---|---|
| SEPA XML (camt.053) | banky | ISO 20022, stabilné | XML parser |
| CSV | banky/fintech/investície | najpriamočiarejšie | csv parser |
| ABO / GPC | banky | fixný formát, regionálne špecifiká | fix-width/custom parser |
| JSON | moderné API (napr. business) | ideálne pre automatizáciu | JSON deserializer |
| PDF | sporiteľne/výpisy | neštruktúrované | extrakcia textu/OCR |

## Odporúčaná aplikačná architektúra (pre domáce cash flow)

### 1) Unified Data Model (UDM) – základ, ktorý odomkne všetko ostatné

Navrhni interný dátový model, ktorý bude spoločný pre všetky konektory:

- **Account**: provider, typ (bank/fintech/invest), currency, masked identifiers
- **Transaction**:
  - bookingDate/valueDate
  - amount + currency (multi-currency je must pre Revolut)
  - counterparty (ak existuje)
  - description / reference
  - category (interná)
  - rawPayload (voliteľne – pre audit/debug)
- **Balance snapshot** (voliteľné): pre PSS/investície môže byť hlavný zdroj pravdy

#### Stabilná deduplikácia

Nie všetky zdroje garantujú stabilné `transaction_id`. Praktický prístup:

- generuj **fingerprint/hash** z (dátum, suma, mena, protistrana/poznámka, účet) + tolerancia na drobné rozdiely v popise,
- implementuj „soft matching“ pre banky, ktoré menia texty referencií.

### 2) Plugin konektory

Rozdeľ integrácie na samostatné „konektory“:

- `enable-banking-connector` (AISP cez agregátora)
- `revolut-business-connector` (ak applicable)
- `csv-import-connector`
- `camt053-import-connector`
- `abo-import-connector`
- `pdf-import-connector` (voliteľné, nízka priorita)

Analytická vrstva (cash flow, kategorizácia, reporty) má pracovať výhradne s UDM, nie s formátmi providerov.

### 3) Pipeline: ingest → normalize → classify → store → analyze

- **Ingest**: stiahni/spracuj súbor alebo API odpoveď
- **Normalize**: mapuj na UDM (štandardizuj meny, dátumy, znamienka)
- **Classify**: pravidlá + ML (voliteľne) pre kategórie
- **Store**: lokálna DB (napr. SQLite) alebo cloud DB
- **Analyze**: cash flow, budget, trendy, predikcie

## Bezpečnosť a súkromie (nevynechať)

### OAuth 2.0 / FAPI princípy (ak ideš cez agregátora alebo Business API)

- **Tokeny nikdy neukladať v čistom texte**.
- Preferuj **Backend-for-Frontend (BFF)**:
  - tokeny žijú server-side v šifrovanej session,
  - klient dostane iba HTTP-only cookies.
- **PKCE** pre mobil/SPA (ak robíš autorizáciu z klienta).
- **Consent management**:
  - transparentne zobraz, čo sa sťahuje a na ako dlho,
  - rátaj s pravidelnou reautorizáciou (SCA).

### Data at rest

- šifrovanie DB (napr. SQLCipher pre SQLite alebo šifrovanie diskovej vrstvy),
- oddeliť identitu (mená, plné čísla účtov) od transakčných dát,
- MFA/PIN/biometria na prístup do appky (najmä mobil).

## Odporúčaný postup implementácie (roadmap)

### Fáza 1: Unified Data Model + importy

- navrhni UDM + deduplikáciu,
- implementuj CSV + camt.053 import (najviac value za najmenej práce),
- priprav „mapping templates“ (užívateľ určí stĺpce: dátum/suma/mena/popisy).

### Fáza 2: Agregátor pre banky (Enable Banking ako prvý kandidát)

- zaregistruj aplikáciu (sandbox → produkčné kroky neskôr),
- implementuj auth flow + sťahovanie transakcií,
- transformácia na UDM + deduplikácia.

### Fáza 3: Investičné importy

- Patria XLSX import (konverzia do tabuľky → UDM),
- Portu CSV import,
- doplň výpočty pre investície (cash in/out, dividendy, realizované P/L podľa potreby).

### Fáza 4 (voliteľné): Automatizácia e-mailom

- IMAP watcher, ktorý sťahuje výpisy a spúšťa import,
- len ak vieš spraviť bezpečne (šifrovanie prístupov, minimálne oprávnenia).

## Budúcnosť: Open Finance (FIDA)

Pripravovaný rámec Open Finance (FIDA) môže rozšíriť „open“ princípy aj na investície/poistenie/dôchodky. Z architektonického pohľadu to znamená:

- držať sa **plugin konektorov**,
- minimalizovať „provider-specific“ logiku v analytike,
- neskôr vymeniť CSV/XLSX konektor za API konektor bez prepisu core aplikácie.

## Kľúčové odporúčania (tl;dr)

- Banky sú technicky pripravené, ale produkčný prístup často vyžaduje licencovaného prostredníka → **agregátor** je realistická cesta.
- Revolut Business je „najčistejšie“ API, Revolut Retail typicky nie.
- Investície/sporenie zatiaľ rieš **importom** (CSV/XLSX, PSS často PDF alebo ručne).
- Bezpečnosť rieš od začiatku: tokeny, šifrovanie, izolácia identít, MFA.
- Hybridná stratégia (agregátor + importy) dá komplexný obraz cash flow bez zbytočnej závislosti od jedného zdroja.

