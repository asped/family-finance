# Architektúra a technické riešenia integrácie finančných dát pre domáce systémy analýzy cash flow

Súčasná digitálna transformácia finančného sektora v Európskom hospodárskom priestore, poháňaná predovšetkým revidovanou smernicou o platobných službách (PSD2), vytvorila bezprecedentné príležitosti pre rozvoj personalizovaných systémov správy financií. Pre individuálneho vývojára, ktorý si kladie za cieľ vybudovať robustnú aplikáciu na analýzu príjmov a vydavkov domácnosti, predstavuje technická integrácia dát zo širokého spektra inštitúcií – od tradičných bánk ako Slovenská sporiteľňa a mBank, cez fintech lídrov typu Revolut, až po investičné platformy Patria a Portu či špecializované subjekty ako Prvá stavebná sporiteľňa – komplexnú výzvu vyžadujúcu hlboké porozumenie regulačným, bezpečnostným a technologickým aspektom.

## Regulačný kontext a filozofia otvoreného bankovníctva

Základným kameňom pre akúkoľvek analýzu bankových API v Európskej únii je smernica PSD2, ktorá bola prijatá v roku 2015 s cieľom zvýšiť bezpečnosť platieb, posilniť ochranu spotrebiteľa a stimulovať inovácie. Táto smernica ukladá bankám (v terminológii PSD2 označeným ako ASPSP – Account Servicing Payment Service Providers) povinnosť sprístupniť údaje o platobných účtoch klientov tretím stranám, ak na to klient udelí výslovný súhlas. V slovenskom legislatívnom prostredí je tento rámec ukotvený v zákone č. 492/2009 Z. z. o platobných službách.

Pre vývojára domácej aplikácie je kritické rozlišovať medzi prístupom pre licencované subjekty a možnosťami pre individuálne použitie. PSD2 definuje tri hlavné typy služieb:
* **Account Information Services (AISP)** na získavanie informácií o účte a transakciách
* **Payment Initiation Services (PIS)** na zadávanie platobných príkazov
* **Payment Instrument Issuer Service Provider (PIISP)** na overovanie dostupnosti finančných prostriedkov

Hoci smernica demokratizovala prístup k dátam, v praxi vyžaduje, aby subjekty pristupujúce k produkčným rozhraniam API boli držiteľmi licencie od národného regulátora, ako je Národná banka Slovenska. Táto požiadavka na licenciu TPP (Third Party Provider) predstavuje hlavnú bariéru pre individuálne projekty, čo si vynucuje hľadanie alternatívnych integračných stratégií.

## Porovnávacia analýza dostupnosti dát v cieľových inštitúciách

Každá z dopytovaných inštitúcií pristupuje k zdieľaniu dát odlišne, čo je dané ich technologickou vyspelosťou, trhovou orientáciou a zákonnými povinnosťami. Zatiaľ čo banky musia poskytovať API rozhrania pre platobné účty, investičné platformy a sporiteľne často operujú v uzavretejších ekosystémoch.

| Inštitúcia | Existencia API rozhrania | Typ prístupu pre jednotlivca | Primárny formát exportu | Možnosť real-time dát |
| :--- | :--- | :--- | :--- | :--- |
| **Slovenská sporiteľňa** | Áno (George API) | Len cez Sandbox / TPP agregátora | SEPA XML (camt.053) | Áno (cez licencované TPP) |
| **mBank** | Áno (mBank API) | Len cez Sandbox / TPP agregátora | CSV, ABO, PDF | Áno (cez licencované TPP) |
| **Revolut (Retail)** | Nie (verejné) | Len cez TPP agregátora | CSV, Excel, PDF | Áno (cez licencované TPP) |
| **Revolut (Business)** | Áno (Business API) | Priamy prístup cez API kľúč | JSON, CSV | Áno (natívne) |
| **Patria Finance** | Nie (verejné) | Manuálny export | XLSX (Excel) | Nie |
| **Portu** | Nie (verejné) | Manuálny export | CSV | Nie |
| **Prvá Stavebná sporiteľňa** | Nie | Manuálny export (portal) | PDF | Nie |

## Detailná technická analýza bankových domov

### Slovenská sporiteľňa a ekosystém Erste Group
Slovenská sporiteľňa (SLSP) implementuje svoje otvorené bankovníctvo prostredníctvom Erste Developer Portal, ktorý slúži ako jednotný prístupový bod pre všetky banky skupiny Erste v strednej a východnej Európe. Technické riešenie SLSP je postavené na moderných štandardoch RESTful API, pričom využíva HTTP/1.1 a JSON pre prenos dát.

Pre vývojára je k dispozícii rozsiahla dokumentácia a sandbox prostredie, ktoré simuluje reálne správanie API bez rizika manipulácie s ostrými dátami. Dokumentácia George API detailne popisuje operácie pre získanie zoznamu účtov (AccountList), zostatkov (AccountBalance) a histórie transakcií. Prístup k produkčným dátam je však podmienený certifikátmi QWAC a QSealC, čo sú kvalifikované certifikáty vydávané autoritami ako QTSP.

V kontexte domácej aplikácie, kde priama integrácia API nemusí byť schodná z legislatívnych dôvodov, SLSP ponúka silnú alternatívu v podobe exportu výpisov v štandarde SEPA XML (formát camt.053). Tento formát je v bankovníctve považovaný za zlatý štandard pre strojové spracovanie a je ideálny pre následný import do vlastnej databázy. SLSP navyše disponuje službou Databanking API, ktorá je primárne určená pre účtovné systémy a umožňuje priamu komunikáciu bez nutnosti manuálnej manipulácie so súbormi. Pre majiteľov biznis účtov je k dispozícii aj Callback API, ktoré dokáže v reálnom čase posielať notifikácie o obratoch na endpoint klienta.

### mBank a štandard PolishAPI
mBank, pôsobiaca na slovenskom, českom a poľskom trhu, využíva pre svoje API rozhranie štandard PolishAPI, čo zabezpečuje vysokú mieru kompatibility naprieč regiónmi. Architektúra mBank API je navrhnutá tak, aby podporovala silnú autentifikáciu klienta (SCA) prostredníctvom presmerovania do bezpečného prostredia banky, kde klient definuje rozsah súhlasov (consent) pre konkrétne účty.

Z technického hľadiska mBank vyžaduje pre každú požiadavku unikátne hlavičky, ako napríklad `TPP-Request-ID` vo formáte UUID verzie 1 a `JWS-Signature` pre zabezpečenie integrity správy. Hoci je mBank API zamerané na TPP subjekty, jej sandbox portál je otvorený pre registráciu pomocou firemného e-mailu, čo umožňuje vývojárom testovať integračnú logiku ešte pred rozhodnutím o finálnom postupe.

Pre bežného používateľa mBank zachováva široké možnosti manuálneho exportu histórie platieb. Okrem štandardného CSV formátu podporuje aj formát ABO, ktorý je tradične využívaný v českom a slovenskom bankovom prostredí pre hromadné spracovanie transakcií. Tento fakt je kľúčový pre domáci projekt, pretože umožňuje vytvoriť robustný importný modul, ktorý nie je závislý na dostupnosti API.

## Analýza fintech a investičných platforiem

### Revolut: Rozpor medzi Retail a Business prístupom
Revolut predstavuje vo finančnom svete unikátnu entitu s vysoko digitálnou DNA, avšak jeho prístup k exportu dát sa diametrálne líši podľa typu účtu. Pre retailových používateľov Revolut neposkytuje verejne prístupné API kľúče. Používatelia sú odkázaní na manuálne sťahovanie výpisov cez mobilnú aplikáciu. Analýza naznačuje, že hoci je možné v aplikácii vygenerovať výpis v Exceli, tento súbor je primárne určený pre vizuálnu kontrolu a daňové účely, hoci ho možno konvertovať na CSV pre import do iných systémov.

Naopak, Revolut Business ponúka plnohodnotné Business API, ktoré je prístupné pre klientov s plánom "Grow" a vyšším. Toto API umožňuje kontrolu transakcií a zostatkov v reálnom čase, iniciáciu platieb a správu kariet. Pre vývojára domácej aplikácie, ak by využíval biznis účet, toto rozhranie predstavuje najčistejšiu cestu k automatizácii, nakoľko využíva štandardnú OAuth 2.0 autentifikáciu a bearer tokeny. Existuje aj Merchant API, ktoré umožňuje generovanie vlastných CSV reportov transakcií cez API volania, čo je užitočné pre historickú analýzu dát.

### Investičné platformy Patria Finance a Portu
Investičné platformy zvyčajne nespadajú pod rovnaké striktné pravidlá PSD2 ako poskytovatelia bežných platobných účtov, čo sa odráža na absencii otvorených transakčných API pre retailových klientov.

**Patria Finance** sa sústreďuje na poskytovanie dát pre daňové a analytické účely prostredníctvom súborových exportov. Používatelia môžu v aplikácii exportovať históriu obchodov a dividend do formátu XLSX (Excel). Pre hlbšiu automatizáciu je dôležité, že Patria umožňuje export celého nákupného a predajného denníka, čo je nevyhnutné pre korektný výpočet časového testu a daňovej povinnosti v slovenskom prostredí.

**Portu**, ako automatizovaná investičná platforma, zdieľa podobnú filozofiu. V sekcii "Peňaženka a transakcie" môžu klienti sťahovať dáta vo formáte CSV. Táto cesta je síce manuálna, ale formát CSV je vysoko predvídateľný a ľahko integrovateľný do vlastnej aplikácie pomocou štandardných knižníc na parsovanie textových súborov.

### Prvá stavebná sporiteľňa (PSS) a špecifiká stavebného sporenia
Prvá stavebná sporiteľňa predstavuje v analýze najmenej transparentný subjekt z hľadiska automatizovaného prístupu k dátam. PSS nespravuje bežné platobné účty, ale účty stavebného sporenia, na ktoré nie je možné posielať ani prijímať okamžité SEPA platby (Instant Payments). Informácie o zostatkoch, vkladoch, pripísaných úrokoch a štátnej prémii sú klientom sprístupnené prostredníctvom portálu mojaPSS.

Pre potreby analýzy domáceho cash flow je dôležité, že PSS zasiela ročné výpisy elektronicky, avšak technická možnosť real-time exportu alebo API pre individuálnych vývojárov absentuje. Stratégia integrácie pre PSS bude pravdepodobne vyžadovať manuálne zadávanie zostatkov alebo sofistikované parsovanie PDF výpisov, ak aplikácia vyžaduje presnú históriu transakcií.

## Strategické možnosti integrácie dát (SaaS vs. Custom)

Pri návrhu architektúry novej aplikácie sa vývojár musí rozhodnúť medzi priamym napojením na inštitúcie a využitím agregátora. Vzhľadom na uvedené licenčné obmedzenia bánk sa ako najefektívnejšia javí cesta využitia služieb "Aggregation as a Service".

### Agregátory tretích strán (AaaS)
Na trhu existuje niekoľko kľúčových hráčov, ktorí už majú potrebné licencie a infraštruktúru na komunikáciu s bankami v celej EÚ.

* **Enable Banking**: Táto fínska spoločnosť poskytuje priamy prístup k bankovým API bez ukladania dát na ich strane, čo je z hľadiska bezpečnosti vysoko cenené. Ich model "Free access to linked bank accounts" umožňuje vývojárom registrovať aplikáciu a prepojiť bankové účty bezplatne, pričom sa platí len za rozšírené funkcie alebo vysoké objemy volaní. Enable Banking podporuje široké spektrum bánk v EHS, vrátane slovenských subjektov ako 365.bank a pravdepodobne aj SLSP či mBank cez ich harmonizované rozhranie.
* **GoCardless (predtým Nordigen)**: Dlhodobo patril medzi najpopulárnejšie voľby pre individuálnych vývojárov vďaka svojmu bezplatnému modelu pre historické transakčné dáta. Aktuálne správy však naznačujú, že GoCardless môže obmedzovať registráciu nových bezplatných účtov a zameriavať sa viac na podnikovú klientelu, čo môže ovplyvniť dlhodobú udržateľnosť tohto riešenia pre domáci projekt.
* **Salt Edge**: Ponúka jedno z najširších pokrytí na svete (viac ako 5 000 bánk), ale ich cenová politika a proces onboardingu sú striktne orientované na komerčné subjekty. Pre individuálny projekt je toto riešenie často finančne nedostupné, hoci technologicky patrí k svetovej špičke.

### Metódy manuálnej a poloautomatickej integrácie
Ak sa vývojár rozhodne pre suverénny prístup bez závislosti na tretej strane, musí implementovať moduly pre spracovanie rôznych dátových formátov.

| Formát | Pôvod / Zdroj | Charakteristika | Spôsob spracovania |
| :--- | :--- | :--- | :--- |
| **SEPA XML** | SLSP, Tatra banka | Štruktúrovaný ISO 20022 štandard | XML Parser (napr. lxml v Python) |
| **CSV** | mBank, Revolut, Portu | Textový formát oddelený čiarkou/bodkočiarkou | Standard libraries (csv module, pandas) |
| **ABO / GPC** | mBank, SLSP | Tradičný bankový formát pre SR/ČR | Fix-width parser / Custom regex |
| **JSON** | Revolut Business | Moderný webový formát | Natívny JSON deserializer |
| **PDF** | PSS, Revolut (st. výpisy) | Nestruktúrovaný dokument | OCR alebo PDF text extraction (pdfplumber) |

## Bezpečnostná architektúra a ochrana súkromia

Pri tvorbe aplikácie narábajúcej s citlivými finančnými údajmi oboch manželov je nevyhnutné implementovať bezpečnostné mechanizmy na úrovni bankových inštitúcií. Bezpečnosť v otvorenom bankovníctve nie je len o šifrovaní, ale o celom procese správy identít a súhlasov.

### Autentifikácia a autorizácia cez OAuth 2.0 a FAPI
Moderné finančné API využívajú rámec OAuth 2.0 rozšírený o bezpečnostné profily FAPI (Financial-grade API). Pre domácu aplikáciu sú kľúčové nasledujúce aspekty:
* **Bezpečné uchovávanie tokenov**: Prístupové tokeny (access_token) a najmä obnovovacie tokeny (refresh_token) by nikdy nemali byť uložené v čistom texte. Na mobilných platformách je nutné využívať hardvérovo zabezpečené úložiská ako Android Keystore alebo iOS Keychain. V prípade webovej aplikácie sa odporúča model "Backend for Frontend" (BFF), kde sú tokeny uložené v šifrovanej session na serveri a klientovi sú posielané len cez HTTP-only cookies, ktoré sú neviditeľné pre JavaScript a tým chránené pred XSS útokmi.
* **Implementácia PKCE**: Proof Key for Code Exchange (PKCE) je nevyhnutnosťou pre mobilné a "single-page" aplikácie (SPA), pretože zabraňuje únosu autorizačného kódu počas presmerovania.
* **Správa súhlasov (Consent Management)**: Aplikácia musí transparentne informovať používateľa (v tomto prípade manžela/manželku), k akým dátam a na aké dlhé obdobie žiada prístup. Podľa PSD2 sú súhlasy zvyčajne platné maximálne 90 dní (hoci nové regulácie toto obdobie predlžujú), po ktorých je nutná re-autorizácia pomocou SCA.

### Ochrana dát v pokoji (Data at Rest)
Keďže cieľom je analýza, dáta budú pravdepodobne uložené v lokálnej alebo cloudovej databáze.
* **Šifrovanie databázy**: Celá databázová vrstva by mala byť šifrovaná (napr. SQLCipher pre SQLite).
* **Anonymizácia**: Pre analytické účely je vhodné oddeliť identifikačné údaje (mená majiteľov, presné čísla účtov) od transakčných dát. V analytických moduloch by sa malo pracovať len s ID účtu a kategóriami výdavkov.
* **Multi-factor Authentication (MFA)**: Prístup k samotnej analytickej aplikácii by mal byť chránený minimálne biometriou alebo PIN kódom, aby sa zabránilo neoprávnenému prístupu k rodinným financiám pri strate zariadenia.

## Odporúčaný postup implementácie (Roadmapa)

Na základe analýzy dostupných možností sa pre individuálneho vývojára odporúča nasledujúci fázový prístup, ktorý kombinuje rýchlosť vývoja (time-to-market) s dlhodobou stabilitou a bezpečnosťou.

### Fáza 1: Vybudovanie "Unified Data Model"
Predtým, než sa začne s integráciou prvej banky, je nevyhnutné navrhnúť univerzálnu schému databázy, ktorá dokáže pojať transakcie z rôznych zdrojov. Táto schéma musí zohľadňovať:
* Multi-currency podporu (dôležité pre Revolut).
* Mapovanie kategórií (rôzne banky používajú rôzne kategorizačné stromy).
* Unikátne ID transakcie (niektoré banky ho neposkytujú stabilne, preto je nutné generovať hash z dátumu, sumy a popisu).

### Fáza 2: Integrácia cez agregátor (Enable Banking)
Pre SLSP, mBank a Revolut sa odporúča začať s integráciou cez Enable Banking.
1. **Registrácia v Control Paneli**: Vytvorenie sandbox aplikácie a získanie client_id.
2. **Generovanie kľúčov**: Vytvorenie RSA kľúčov pre podpisovanie JWT tokenov, ktoré autentifikujú volania aplikácie voči API agregátora.
3. **Implementácia Auth Flow**: Vytvorenie logiky presmerovania používateľa na výber banky a následné spracovanie code parametra na získanie session_id.
4. **Sťahovanie dát**: Volanie endpointov `/accounts/{id}/transactions` a transformácia JSON odpovede do vlastného dátového modelu.

### Fáza 3: Vývoj modulov pre manuálny import
Keďže Patria, Portu a PSS nepodporujú API, je potrebné vytvoriť robustný importér súborov.
* **Parser pre CSV/XLSX**: Využitie knižníc ako Pandas (Python) alebo Papa Parse (JavaScript) na flexibilné spracovanie súborov.
* **Template systém**: Možnosť pre používateľa definovať, v ktorom stĺpci sa nachádza dátum, suma a protistrana, čo zabezpečí kompatibilitu s budúcimi zmenami vo formátoch exportov jednotlivých inštitúcií.

### Fáza 4: Automatizácia cez E-mail (Voliteľné)
Pre zvýšenie komfortu pri SLSP a mBank je možné implementovať "Email Scraper", ktorý bude automaticky sťahovať bankou zasielané výpisy. Tento modul by mal byť spustený na pozadí, monitorovať schránku cez IMAP a v momente príchodu výpisu v SEPA XML ho automaticky spracovať.

### Budúci vývoj: Smerom k Open Finance (FIDA)
Svet finančných dát sa nekončí pri PSD2. Európska komisia už pripravuje rámec pre prístup k finančným údajom (FIDA), ktorý rozšíri princípy otvoreného bankovníctva na poistenie, investície a dôchodkové sporenie. To znamená, že v horizonte 2 až 4 rokov môžeme očakávať, že subjekty ako Patria, Portu alebo PSS budú zo zákona povinné poskytovať podobné API rozhrania, aké dnes vidíme u SLSP alebo mBank.

Pre vývojára to znamená, že investícia do architektúry založenej na API je strategicky správna. Domáca aplikácia by mala byť navrhnutá s "plugin" architektúrou, kde každá inštitúcia má svoj vlastný konektor. Keď sa v budúcnosti sprístupní API pre Portu, stačí vymeniť CSV konektor za API konektor bez nutnosti prepisovať analytickú časť aplikácie.

## Záver a kľúčové odporúčania

Programovanie vlastnej aplikácie na analýzu rodinných financií je v aktuálnom regulačnom prostredí ambiciózny, ale technicky realizovateľný cieľ. Kľúčom k úspechu je akceptácia faktu, že finančný trh v EÚ je fragmentovaný a vyžaduje kombináciu rôznych technologických prístupov.

Hlavné zistenia analýzy možno zhrnúť do nasledujúcich bodov:
* **Banky (SLSP, mBank)** sú technologicky pripravené na API integráciu, ale vyžadujú licencovaného prostredníka (agregátora).
* **Revolut** ponúka vynikajúce API pre biznis účty, ale pre retailové účty je nutné použiť agregátor alebo manuálne exporty.
* **Investičné platformy (Patria, Portu)** sú zatiaľ uzavreté svety, kde je nutné spoľahnúť sa na parsovanie CSV a XLSX súborov.
* **Bezpečnosť** musí byť integrovaná od prvého riadku kódu, pričom prioritou je ochrana OAuth tokenov a šifrovanie lokálne uložených dát.
* **Enable Banking** sa javí ako najvhodnejší partner pre individuálneho vývojára vďaka svojej transparentnej politike a bezplatnej štartovacej úrovni.

Zvolením hybridnej stratégie – kombinácie API agregátora pre bežné účty a inteligentného súborového importéra pre investície a sporenie – dokáže vývojár vytvoriť riešenie, ktoré poskytne komplexný a pravdivý obraz o finančnom zdraví domácnosti pri zachovaní maximálnej bezpečnosti a súkromia všetkých zúčastnených strán.
