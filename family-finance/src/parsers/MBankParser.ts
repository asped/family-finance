import { BaseParser } from './BaseParser';
import { ParsedTransaction, BankName } from '@/types';

/**
 * Parser pre mBank CSV exporty
 * mBank používa bodkočiarku ako oddeľovač a Windows-1250 kódovanie
 * 
 * Formát hlavičky:
 * #Dátum operácie;#Opis operácie;#Účet;#Kategória;#Suma;
 * 
 * Formát dát:
 * 2026-01-08;"ROYAL KASHMIR 1  PLATBA KARTOU...";"MASTERCARD WORLD CREDIT...";"Akcie a udalosti";-95,00 EUR;;
 */
export class MBankParser extends BaseParser {
  name: BankName = 'mBank';
  
  // Známe hlavičky mBank - nový formát
  private readonly mBankHeaders = [
    'dátum operácie',
    'datum operacie',
    'opis operácie',
    'opis operacie', 
    'účet',
    'ucet',
    'kategória',
    'kategoria',
    'suma',
  ];
  
  // Staré hlavičky pre backwards compatibility
  private readonly mBankHeadersOld = [
    'dátum uskutočnenia',
    'datum uskutočnenia',
    'dátum zaúčtovania',
    'popis',
    'správa',
    'meno protistrany',
    'číslo účtu protistrany',
    'čiastka',
    'zostatok',
  ];
  
  canParse(headers: string[], content: string): boolean {
    const headerLower = headers.map(h => h.toLowerCase().replace('#', '').trim());
    
    // Kontrola nového formátu
    const newFormatMatch = this.mBankHeaders.filter(h => 
      headerLower.some(header => header.includes(h))
    ).length;
    
    if (newFormatMatch >= 3) return true;
    
    // Kontrola starého formátu
    const oldFormatMatch = this.mBankHeadersOld.filter(h => 
      headerLower.some(header => header.includes(h))
    ).length;
    
    if (oldFormatMatch >= 4) return true;
    
    // Kontrola či obsahuje mBank identifikátory
    const contentLower = content.toLowerCase();
    if (contentLower.includes('mbank') || 
        contentLower.includes('mkonto') ||
        contentLower.includes('mlinka')) {
      return true;
    }
    
    return false;
  }
  
  async parse(content: string | ArrayBuffer, filename: string): Promise<ParsedTransaction[]> {
    let text: string;
    
    // Skús dekódovať ako Windows-1250, potom UTF-8
    if (content instanceof ArrayBuffer) {
      try {
        // Skús Windows-1250 (Central European)
        const decoder = new TextDecoder('windows-1250');
        text = decoder.decode(content);
      } catch {
        // Fallback na UTF-8
        text = new TextDecoder('utf-8').decode(content);
      }
    } else {
      text = content;
    }
    
    console.log('=== MBANK PARSER DEBUG ===');
    console.log('Content length:', text.length);
    console.log('First 300 chars:', text.substring(0, 300));
    
    const transactions: ParsedTransaction[] = [];
    
    // mBank používa bodkočiarku ako delimiter
    const lines = this.parseCSV(text, ';');
    
    console.log('Total lines parsed:', lines.length);
    
    if (lines.length < 2) {
      console.log('mBank: Not enough lines');
      return transactions;
    }
    
    // Debug: ukáž prvých 20 riadkov
    for (let i = 0; i < Math.min(25, lines.length); i++) {
      const lineStr = lines[i].join(' | ');
      console.log(`Line ${i}: ${lineStr.substring(0, 100)}`);
    }
    
    // Nájdi index hlavičky s dátami
    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].map(h => h.toLowerCase().replace(/#/g, '').trim());
      // Hľadaj riadok s "dátum operácie" alebo "dátum uskutočnenia"
      const hasDateHeader = line.some(h => 
        h.includes('dátum operácie') || 
        h.includes('datum operacie') || 
        h.includes('dátum uskutočnenia') || 
        h.includes('datum uskutočnenia')
      );
      
      if (hasDateHeader) {
        console.log(`Found header at line ${i}:`, line);
        headerIndex = i;
        break;
      }
    }
    
    if (headerIndex === -1) {
      console.log('mBank: Header not found after checking all lines');
      // Fallback: hľadaj riadok ktorý začína dátumom YYYY-MM-DD
      for (let i = 0; i < lines.length; i++) {
        if (lines[i][0] && /^\d{4}-\d{2}-\d{2}$/.test(lines[i][0].trim())) {
          console.log(`Found data row at line ${i}, assuming headers at ${i-1}`);
          headerIndex = i - 1;
          break;
        }
      }
    }
    
    if (headerIndex === -1) {
      console.log('mBank: Still no header found');
      return transactions;
    }
    
    const headers = lines[headerIndex].map(h => h.toLowerCase().replace(/#/g, '').trim());
    console.log('mBank headers found:', headers);
    
    // Detekuj formát (nový vs starý)
    const isNewFormat = headers.some(h => h.includes('dátum operácie') || h.includes('datum operacie') || h.includes('dátum'));
    
    console.log('Using format:', isNewFormat ? 'new' : 'old');
    
    if (isNewFormat) {
      return this.parseNewFormat(lines, headers, headerIndex, filename);
    } else {
      return this.parseOldFormat(lines, headers, headerIndex, filename);
    }
  }
  
  /**
   * Nový formát mBank exportu (2024+)
   * #Dátum operácie;#Opis operácie;#Účet;#Kategória;#Suma;
   */
  private parseNewFormat(
    lines: string[][], 
    headers: string[], 
    headerIndex: number, 
    filename: string
  ): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];
    
    // Mapovanie stĺpcov
    const dateIdx = headers.findIndex(h => h.includes('dátum') || h.includes('datum'));
    const descIdx = headers.findIndex(h => h.includes('opis'));
    const accountIdx = headers.findIndex(h => h.includes('účet') || h.includes('ucet'));
    const categoryIdx = headers.findIndex(h => h.includes('kategória') || h.includes('kategoria'));
    const amountIdx = headers.findIndex(h => h.includes('suma'));
    
    console.log('mBank column indices:', { dateIdx, descIdx, accountIdx, categoryIdx, amountIdx });
    console.log('Processing rows from', headerIndex + 1, 'to', lines.length - 1);
    
    // Spracuj transakcie
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const row = lines[i];
      
      console.log(`Row ${i}:`, row.slice(0, 5).join(' | '));
      
      // Preskočiť prázdne riadky a pätičky
      if (row.length < 3) {
        console.log(`  Skipping: too few columns (${row.length})`);
        continue;
      }
      if (row[0]?.toLowerCase().includes('mbank')) {
        console.log('  Skipping: mbank footer');
        continue;
      }
      if (row[0]?.toLowerCase().includes('bližšie informácie')) {
        console.log('  Skipping: info footer');
        continue;
      }
      
      const dateStr = row[dateIdx]?.replace(/"/g, '').trim() || '';
      const date = this.parseMBankDate(dateStr);
      
      console.log(`  Date string: "${dateStr}", parsed:`, date);
      
      if (!date) {
        console.log('  Skipping: invalid date');
        continue;
      }
      
      // Parsuj sumu - formát: "-95,00 EUR" alebo "771,61 EUR"
      const amountStr = row[amountIdx]?.replace(/"/g, '').trim() || '0';
      const amount = this.parseMBankAmount(amountStr);
      
      console.log(`  Amount string: "${amountStr}", parsed: ${amount}`);
      
      // Extrahuj menu
      const currencyMatch = amountStr.match(/[A-Z]{3}/);
      const currency = currencyMatch ? currencyMatch[0] : 'EUR';
      
      // Popis a kategória
      const description = row[descIdx]?.replace(/"/g, '').trim() || '';
      const category = row[categoryIdx]?.replace(/"/g, '').trim() || '';
      const account = row[accountIdx]?.replace(/"/g, '').trim() || '';
      
      // Extrahuj protistranu z popisu (prvé slová pred "PLATBA")
      const counterparty = this.extractCounterpartyFromDescription(description);
      
      const transaction: ParsedTransaction = {
        date,
        amount,
        currency,
        counterparty,
        description,
        category: this.mapMBankCategory(category) || undefined,
        rawData: {
          source: 'mBank',
          format: 'new',
          filename,
          originalAccount: account,
          originalCategory: category,
          row: Object.fromEntries(headers.map((h, idx) => [h, row[idx]])),
        },
      };
      
      console.log('  Created transaction:', { date: transaction.date, amount: transaction.amount });
      transactions.push(this.applyCategorization(transaction));
    }
    
    console.log('Total mBank transactions parsed:', transactions.length);
    return transactions;
  }
  
  /**
   * Starý formát mBank exportu
   */
  private parseOldFormat(
    lines: string[][], 
    headers: string[], 
    headerIndex: number, 
    filename: string
  ): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];
    
    // Mapovanie stĺpcov pre starý formát
    const dateIdx = headers.findIndex(h => h.includes('dátum uskutočnenia') || h.includes('datum uskutočnenia'));
    const descIdx = headers.findIndex(h => h === 'popis');
    const messageIdx = headers.findIndex(h => h.includes('správa') || h.includes('sprava'));
    const counterpartyIdx = headers.findIndex(h => h.includes('meno protistrany'));
    const counterpartyAccountIdx = headers.findIndex(h => h.includes('číslo účtu protistrany'));
    const amountIdx = headers.findIndex(h => h.includes('čiastka') && !h.includes('mene'));
    const currencyIdx = headers.findIndex(h => h.includes('mena'));
    
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const row = lines[i];
      
      if (row.length < 5) continue;
      
      const dateStr = row[dateIdx] || '';
      const date = this.parseDate(dateStr);
      
      if (!date) continue;
      
      const amount = this.parseAmount(row[amountIdx] || '0');
      const currency = (row[currencyIdx] || 'EUR').toUpperCase();
      
      const transaction: ParsedTransaction = {
        date,
        amount,
        currency,
        counterparty: row[counterpartyIdx] || undefined,
        counterpartyAccount: row[counterpartyAccountIdx] || undefined,
        description: [row[descIdx], row[messageIdx]].filter(Boolean).join(' - ') || undefined,
        rawData: {
          source: 'mBank',
          format: 'old',
          filename,
          row: Object.fromEntries(headers.map((h, idx) => [h, row[idx]])),
        },
      };
      
      transactions.push(this.applyCategorization(transaction));
    }
    
    return transactions;
  }
  
  /**
   * Parsuje dátum z mBank formátu (YYYY-MM-DD alebo DD.MM.YYYY)
   */
  private parseMBankDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    // ISO formát: 2026-01-08
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    }
    
    // Slovenský formát: 08.01.2026
    const skMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (skMatch) {
      return new Date(parseInt(skMatch[3]), parseInt(skMatch[2]) - 1, parseInt(skMatch[1]));
    }
    
    return this.parseDate(dateStr);
  }
  
  /**
   * Parsuje sumu z mBank formátu (napr. "-95,00 EUR" alebo "771,61 EUR")
   */
  private parseMBankAmount(amountStr: string): number {
    if (!amountStr) return 0;
    
    // Odstráň menu a whitespace
    let normalized = amountStr.replace(/[A-Z]{3}/g, '').trim();
    
    // Nahraď desatinnú čiarku bodkou
    normalized = normalized.replace(/\s/g, '').replace(',', '.');
    
    const amount = parseFloat(normalized);
    return isNaN(amount) ? 0 : amount;
  }
  
  /**
   * Extrahuje protistranu z popisu transakcie
   */
  private extractCounterpartyFromDescription(description: string): string | undefined {
    if (!description) return undefined;
    
    // Rozdeľ podľa "PLATBA" alebo podobných slov
    const parts = description.split(/\s+(PLATBA|PREVOD|VÝBER|VKLAD|INKASO)/i);
    if (parts.length > 0 && parts[0].trim()) {
      return parts[0].trim();
    }
    
    // Vráť prvých 50 znakov ak nič nenájdeme
    return description.substring(0, 50).trim();
  }
  
  /**
   * Mapuje mBank kategórie na naše kategórie
   */
  private mapMBankCategory(mbankCategory: string): string | null {
    const categoryMap: Record<string, string> = {
      'Akcie a udalosti': 'Entertainment',
      'Parkovanie a poplatky': 'Transport',
      'Príjmy - iné': 'Salary',
      'Príjmy': 'Salary',
      'Jedlo a pitie': 'Restaurants',
      'Potraviny': 'Groceries',
      'Bývanie': 'Housing',
      'Doprava': 'Transport',
      'Zdravie': 'Health',
      'Nákupy': 'Shopping',
      'Zábava': 'Entertainment',
      'Prevody': 'Transfer',
    };
    
    return categoryMap[mbankCategory] || null;
  }
  
  detectAccountNumber(content: string | ArrayBuffer): string | null {
    let text: string;
    if (content instanceof ArrayBuffer) {
      try {
        text = new TextDecoder('windows-1250').decode(content);
      } catch {
        text = new TextDecoder('utf-8').decode(content);
      }
    } else {
      text = content;
    }
    
    // Hľadaj IBAN - SK + 22 číslic
    const ibanMatch = text.match(/SK\d{2}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}/);
    if (ibanMatch) {
      return ibanMatch[0].replace(/\s/g, '');
    }
    
    // Hľadaj mKonto s číslom účtu
    const mkontoMatch = text.match(/mKonto\s*-?\s*(SK\d{22}|\d{10,})/i);
    if (mkontoMatch) {
      return mkontoMatch[1];
    }
    
    return null;
  }
}
