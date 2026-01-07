import { BaseParser } from './BaseParser';
import { ParsedTransaction, BankName } from '@/types';
import * as XLSX from 'xlsx';

/**
 * Parser pre Revolut exporty (Retail verzia)
 * Podporuje CSV a Excel formáty
 * 
 * Typická hlavička:
 * Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
 */
export class RevolutParser extends BaseParser {
  name: BankName = 'Revolut';
  
  // Známe hlavičky Revolut exportov
  private readonly revolutHeaders = [
    'type',
    'product',
    'started date',
    'completed date',
    'description',
    'amount',
    'fee',
    'currency',
    'state',
    'balance',
  ];
  
  canParse(headers: string[], content: string): boolean {
    const headerLower = headers.map(h => h.toLowerCase().trim());
    
    // Kontrola Revolut hlavičiek
    const matchCount = this.revolutHeaders.filter(h => 
      headerLower.some(header => header === h || header.includes(h))
    ).length;
    
    // Revolut má veľmi špecifické hlavičky
    if (matchCount >= 6) return true;
    
    // Kontrola na "Revolut" v obsahu
    if (content.toLowerCase().includes('revolut')) {
      return true;
    }
    
    return false;
  }
  
  async parse(content: string | ArrayBuffer, filename: string): Promise<ParsedTransaction[]> {
    // Excel formát
    if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      return this.parseExcel(content, filename);
    }
    
    // CSV formát
    return this.parseCSVFile(content, filename);
  }
  
  private async parseCSVFile(content: string | ArrayBuffer, filename: string): Promise<ParsedTransaction[]> {
    const text = typeof content === 'string' ? content : new TextDecoder('utf-8').decode(content);
    const transactions: ParsedTransaction[] = [];
    
    // Revolut používa čiarku ako delimiter
    const lines = this.parseCSV(text, ',');
    
    if (lines.length < 2) return transactions;
    
    const headers = lines[0].map(h => h.toLowerCase().trim());
    
    // Mapovanie stĺpcov
    const typeIdx = headers.findIndex(h => h === 'type');
    const dateIdx = headers.findIndex(h => h.includes('completed') || h.includes('started'));
    const descIdx = headers.findIndex(h => h === 'description');
    const amountIdx = headers.findIndex(h => h === 'amount');
    const feeIdx = headers.findIndex(h => h === 'fee');
    const currencyIdx = headers.findIndex(h => h === 'currency');
    const stateIdx = headers.findIndex(h => h === 'state');
    const balanceIdx = headers.findIndex(h => h === 'balance');
    
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      
      if (row.length < 5) continue;
      
      // Preskočiť neukončené transakcie
      const state = row[stateIdx]?.toLowerCase();
      if (state && state !== 'completed' && state !== 'reverted') continue;
      
      const dateStr = row[dateIdx] || '';
      const date = this.parseRevolutDate(dateStr);
      
      if (!date) continue;
      
      let amount = this.parseAmount(row[amountIdx] || '0');
      const fee = this.parseAmount(row[feeIdx] || '0');
      const currency = (row[currencyIdx] || 'EUR').toUpperCase();
      
      // Poplatok pripočítaj k sume (negatívne číslo)
      if (fee !== 0) {
        amount = amount - Math.abs(fee);
      }
      
      const description = row[descIdx] || '';
      const type = row[typeIdx] || '';
      
      // Extrahuj protistranu z popisu
      const counterparty = this.extractCounterparty(description, type);
      
      const transaction: ParsedTransaction = {
        date,
        amount,
        currency,
        counterparty,
        description: description || undefined,
        rawData: {
          source: 'Revolut',
          format: 'CSV',
          filename,
          type,
          fee,
          state,
          balance: row[balanceIdx],
          row: Object.fromEntries(headers.map((h, idx) => [h, row[idx]])),
        },
      };
      
      transactions.push(this.applyCategorization(transaction));
    }
    
    return transactions;
  }
  
  private async parseExcel(content: string | ArrayBuffer, filename: string): Promise<ParsedTransaction[]> {
    const transactions: ParsedTransaction[] = [];
    
    try {
      const workbook = XLSX.read(content, { type: typeof content === 'string' ? 'string' : 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      
      if (data.length < 2) return transactions;
      
      const headers = (data[0] as string[]).map(h => String(h || '').toLowerCase().trim());
      
      // Mapovanie stĺpcov (rovnaké ako CSV)
      const typeIdx = headers.findIndex(h => h === 'type');
      const dateIdx = headers.findIndex(h => h.includes('completed') || h.includes('started'));
      const descIdx = headers.findIndex(h => h === 'description');
      const amountIdx = headers.findIndex(h => h === 'amount');
      const feeIdx = headers.findIndex(h => h === 'fee');
      const currencyIdx = headers.findIndex(h => h === 'currency');
      const stateIdx = headers.findIndex(h => h === 'state');
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i] as (string | number | Date)[];
        if (!row || row.length < 5) continue;
        
        const state = String(row[stateIdx] || '').toLowerCase();
        if (state && state !== 'completed' && state !== 'reverted') continue;
        
        let date: Date | null = null;
        const dateValue = row[dateIdx];
        if (dateValue instanceof Date) {
          date = dateValue;
        } else if (typeof dateValue === 'number') {
          date = new Date((dateValue - 25569) * 86400 * 1000);
        } else {
          date = this.parseRevolutDate(String(dateValue || ''));
        }
        
        if (!date) continue;
        
        let amount = this.parseAmount(String(row[amountIdx] || '0'));
        const fee = this.parseAmount(String(row[feeIdx] || '0'));
        const currency = String(row[currencyIdx] || 'EUR').toUpperCase();
        
        if (fee !== 0) {
          amount = amount - Math.abs(fee);
        }
        
        const description = String(row[descIdx] || '');
        const type = String(row[typeIdx] || '');
        const counterparty = this.extractCounterparty(description, type);
        
        const transaction: ParsedTransaction = {
          date,
          amount,
          currency,
          counterparty,
          description: description || undefined,
          rawData: {
            source: 'Revolut',
            format: 'Excel',
            filename,
            type,
            fee,
          },
        };
        
        transactions.push(this.applyCategorization(transaction));
      }
    } catch (error) {
      console.error('Error parsing Revolut Excel:', error);
    }
    
    return transactions;
  }
  
  /**
   * Parsuje Revolut dátum (formát: 2024-01-15 14:30:00 alebo Jan 15, 2024)
   */
  private parseRevolutDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    // ISO formát
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
      return new Date(dateStr);
    }
    
    // US formát (Jan 15, 2024)
    const usMatch = dateStr.match(/(\w{3})\s+(\d{1,2}),?\s+(\d{4})/);
    if (usMatch) {
      const months: Record<string, number> = {
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
      };
      const month = months[usMatch[1].toLowerCase()];
      if (month !== undefined) {
        return new Date(parseInt(usMatch[3]), month, parseInt(usMatch[2]));
      }
    }
    
    return this.parseDate(dateStr);
  }
  
  /**
   * Extrahuje protistranu z popisu Revolut transakcie
   */
  private extractCounterparty(description: string, type: string): string | undefined {
    if (!description) return undefined;
    
    // Pre kartové platby je merchant v popise
    if (type.toLowerCase().includes('card')) {
      return description;
    }
    
    // Pre transfery hľadaj "To" alebo "From"
    const toMatch = description.match(/To\s+(.+)/i);
    if (toMatch) return toMatch[1];
    
    const fromMatch = description.match(/From\s+(.+)/i);
    if (fromMatch) return fromMatch[1];
    
    return description;
  }
  
  detectAccountNumber(content: string | ArrayBuffer): string | null {
    // Revolut retail export zvyčajne neobsahuje IBAN
    // Vrátime null a účet sa vytvorí s generickým identifikátorom
    return null;
  }
}
