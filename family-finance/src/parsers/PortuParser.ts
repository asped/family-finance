import { BaseParser } from './BaseParser';
import { ParsedTransaction, BankName } from '@/types';
import * as XLSX from 'xlsx';

/**
 * Parser pre Portu exporty
 * Podporuje CSV exporty z investičnej platformy
 * 
 * Typické stĺpce:
 * Dátum, Typ, Suma, Mena, Stav, Poznámka
 */
export class PortuParser extends BaseParser {
  name: BankName = 'Portu';
  
  // Známe hlavičky Portu exportov
  private readonly portuHeaders = [
    'dátum',
    'typ',
    'suma',
    'mena',
    'stav',
    'poznámka',
    'portfolio',
  ];
  
  canParse(headers: string[], content: string): boolean {
    const headerLower = headers.map(h => h.toLowerCase().trim());
    
    // Kontrola Portu hlavičiek
    const matchCount = this.portuHeaders.filter(h => 
      headerLower.some(header => header.includes(h))
    ).length;
    
    if (matchCount >= 4) return true;
    
    // Kontrola na "Portu" v obsahu
    if (content.toLowerCase().includes('portu')) {
      return true;
    }
    
    return false;
  }
  
  async parse(content: string | ArrayBuffer, filename: string): Promise<ParsedTransaction[]> {
    if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      return this.parseExcel(content, filename);
    }
    
    return this.parseCSVFile(content, filename);
  }
  
  private async parseCSVFile(content: string | ArrayBuffer, filename: string): Promise<ParsedTransaction[]> {
    const text = typeof content === 'string' ? content : new TextDecoder('utf-8').decode(content);
    const transactions: ParsedTransaction[] = [];
    
    // Skús rôzne delimitery
    let lines = this.parseCSV(text, ';');
    if (lines[0]?.length < 3) {
      lines = this.parseCSV(text, ',');
    }
    
    if (lines.length < 2) return transactions;
    
    const headers = lines[0].map(h => h.toLowerCase().trim());
    
    // Mapovanie stĺpcov
    const dateIdx = headers.findIndex(h => h.includes('dátum'));
    const typeIdx = headers.findIndex(h => h === 'typ');
    const amountIdx = headers.findIndex(h => h.includes('suma') || h.includes('čiastka'));
    const currencyIdx = headers.findIndex(h => h.includes('mena'));
    const statusIdx = headers.findIndex(h => h.includes('stav'));
    const noteIdx = headers.findIndex(h => h.includes('poznámka') || h.includes('popis'));
    const portfolioIdx = headers.findIndex(h => h.includes('portfolio'));
    
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (row.length < 3) continue;
      
      // Preskočiť neukončené transakcie
      const status = (row[statusIdx] || '').toLowerCase();
      if (status && !status.includes('dokončen') && !status.includes('completed')) continue;
      
      const date = this.parseDate(row[dateIdx] || '');
      if (!date) continue;
      
      let amount = this.parseAmount(row[amountIdx] || '0');
      const currency = (row[currencyIdx] || 'EUR').toUpperCase();
      const type = (row[typeIdx] || '').toLowerCase();
      
      // Typ určuje znamienko
      if (type.includes('vklad') || type.includes('deposit')) {
        amount = -Math.abs(amount); // Vklad = peniaze odišli z bežného účtu
      } else if (type.includes('výber') || type.includes('withdrawal')) {
        amount = Math.abs(amount); // Výber = peniaze prišli na bežný účet
      }
      
      const portfolio = portfolioIdx >= 0 ? row[portfolioIdx] : '';
      const note = noteIdx >= 0 ? row[noteIdx] : '';
      
      const description = [type, portfolio, note].filter(Boolean).join(' - ');
      
      const transaction: ParsedTransaction = {
        date,
        amount,
        currency,
        counterparty: 'Portu',
        description: description || undefined,
        category: 'Investment',
        rawData: {
          source: 'Portu',
          format: 'CSV',
          filename,
          type,
          portfolio,
          status,
        },
      };
      
      transactions.push(transaction);
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
      
      // Mapovanie stĺpcov
      const dateIdx = headers.findIndex(h => h.includes('dátum'));
      const typeIdx = headers.findIndex(h => h === 'typ');
      const amountIdx = headers.findIndex(h => h.includes('suma'));
      const currencyIdx = headers.findIndex(h => h.includes('mena'));
      const statusIdx = headers.findIndex(h => h.includes('stav'));
      const noteIdx = headers.findIndex(h => h.includes('poznámka'));
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i] as (string | number | Date)[];
        if (!row || row.length < 3) continue;
        
        const status = String(row[statusIdx] || '').toLowerCase();
        if (status && !status.includes('dokončen') && !status.includes('completed')) continue;
        
        let date: Date | null = null;
        const dateValue = row[dateIdx];
        if (dateValue instanceof Date) {
          date = dateValue;
        } else if (typeof dateValue === 'number') {
          date = new Date((dateValue - 25569) * 86400 * 1000);
        } else {
          date = this.parseDate(String(dateValue || ''));
        }
        
        if (!date) continue;
        
        let amount = this.parseAmount(String(row[amountIdx] || '0'));
        const currency = String(row[currencyIdx] || 'EUR').toUpperCase();
        const type = String(row[typeIdx] || '').toLowerCase();
        
        if (type.includes('vklad') || type.includes('deposit')) {
          amount = -Math.abs(amount);
        } else if (type.includes('výber') || type.includes('withdrawal')) {
          amount = Math.abs(amount);
        }
        
        const transaction: ParsedTransaction = {
          date,
          amount,
          currency,
          counterparty: 'Portu',
          description: [type, row[noteIdx]].filter(Boolean).join(' - ') || undefined,
          category: 'Investment',
          rawData: {
            source: 'Portu',
            format: 'Excel',
            filename,
          },
        };
        
        transactions.push(transaction);
      }
    } catch (error) {
      console.error('Error parsing Portu Excel:', error);
    }
    
    return transactions;
  }
  
  detectAccountNumber(content: string | ArrayBuffer): string | null {
    const text = typeof content === 'string' ? content : new TextDecoder('utf-8').decode(content);
    
    // Hľadaj klienta ID
    const clientMatch = text.match(/klient[:\s]+(\d+)/i);
    if (clientMatch) {
      return `PORTU-${clientMatch[1]}`;
    }
    
    return null;
  }
}
