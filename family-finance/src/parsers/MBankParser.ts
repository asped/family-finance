import { BaseParser } from './BaseParser';
import { ParsedTransaction, BankName } from '@/types';

/**
 * Parser pre mBank CSV exporty
 * mBank používa bodkočiarku ako oddeľovač a slovenský/český formát dátumov
 * 
 * Typická hlavička:
 * #Dátum uskutočnenia;#Dátum zaúčtovania;#Popis;#Správa;#Meno protistrany;#Číslo účtu protistrany;#K/D;#Čiastka;#Mena účtu;#Čiastka v mene účtu;#Zostatok po transakcii
 */
export class MBankParser extends BaseParser {
  name: BankName = 'mBank';
  
  // Známe hlavičky mBank
  private readonly mBankHeaders = [
    'dátum uskutočnenia',
    'datum uskutočnenia',
    'dátum zaúčtovania',
    'datum zaúčtovania',
    'popis',
    'správa',
    'sprava',
    'meno protistrany',
    'číslo účtu protistrany',
    'čiastka',
    'zostatok',
  ];
  
  canParse(headers: string[], content: string): boolean {
    const headerLower = headers.map(h => h.toLowerCase().replace('#', '').trim());
    
    // Kontrola či obsahuje typické mBank hlavičky
    const matchCount = this.mBankHeaders.filter(h => 
      headerLower.some(header => header.includes(h))
    ).length;
    
    // Ak sa zhoduje aspoň 5 hlavičiek, je to pravdepodobne mBank
    return matchCount >= 5;
  }
  
  async parse(content: string | ArrayBuffer, filename: string): Promise<ParsedTransaction[]> {
    const text = typeof content === 'string' ? content : new TextDecoder('utf-8').decode(content);
    const transactions: ParsedTransaction[] = [];
    
    // mBank používa bodkočiarku ako delimiter
    const lines = this.parseCSV(text, ';');
    
    if (lines.length < 2) {
      return transactions;
    }
    
    // Nájdi index hlavičky (mBank niekedy má extra riadky na začiatku)
    let headerIndex = 0;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].map(h => h.toLowerCase().replace('#', '').trim());
      if (line.some(h => h.includes('dátum') || h.includes('datum'))) {
        headerIndex = i;
        break;
      }
    }
    
    const headers = lines[headerIndex].map(h => h.toLowerCase().replace('#', '').trim());
    
    // Mapovanie stĺpcov
    const dateIdx = headers.findIndex(h => h.includes('dátum uskutočnenia') || h.includes('datum uskutočnenia'));
    const descIdx = headers.findIndex(h => h === 'popis');
    const messageIdx = headers.findIndex(h => h.includes('správa') || h.includes('sprava'));
    const counterpartyIdx = headers.findIndex(h => h.includes('meno protistrany'));
    const counterpartyAccountIdx = headers.findIndex(h => h.includes('číslo účtu protistrany') || h.includes('cislo uctu protistrany'));
    const amountIdx = headers.findIndex(h => h.includes('čiastka') && !h.includes('mene'));
    const currencyIdx = headers.findIndex(h => h.includes('mena'));
    
    // Spracuj transakcie
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
          filename,
          row: Object.fromEntries(headers.map((h, idx) => [h, row[idx]])),
        },
      };
      
      transactions.push(this.applyCategorization(transaction));
    }
    
    return transactions;
  }
  
  detectAccountNumber(content: string | ArrayBuffer): string | null {
    const text = typeof content === 'string' ? content : new TextDecoder('utf-8').decode(content);
    
    // mBank IBAN pattern: SK + 22 číslic
    const ibanMatch = text.match(/SK\d{22}/);
    if (ibanMatch) {
      return ibanMatch[0];
    }
    
    // Alternatívne hľadaj "Číslo účtu" v hlavičke
    const accountMatch = text.match(/[Čč]íslo\s+účtu[:\s]+([A-Z]{2}\d{22}|\d{10,})/i);
    if (accountMatch) {
      return accountMatch[1];
    }
    
    return null;
  }
}
