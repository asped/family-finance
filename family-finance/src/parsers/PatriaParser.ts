import { BaseParser } from './BaseParser';
import { ParsedTransaction, BankName } from '@/types';
import * as XLSX from 'xlsx';

/**
 * Parser pre Patria Finance exporty
 * Primárne podporuje XLSX exporty investičných pohybov
 * 
 * Typické stĺpce:
 * Dátum, Typ operácie, Inštrument, Množstvo, Cena, Hodnota, Poplatok, Mena
 */
export class PatriaParser extends BaseParser {
  name: BankName = 'Patria';
  
  // Známe hlavičky Patria exportov
  private readonly patriaHeaders = [
    'dátum',
    'typ operácie',
    'inštrument',
    'množstvo',
    'cena',
    'hodnota',
    'poplatok',
    'mena',
    'isin',
  ];
  
  canParse(headers: string[], content: string): boolean {
    const headerLower = headers.map(h => h.toLowerCase().trim());
    
    // Kontrola Patria hlavičiek
    const matchCount = this.patriaHeaders.filter(h => 
      headerLower.some(header => header.includes(h))
    ).length;
    
    if (matchCount >= 4) return true;
    
    // Kontrola na "Patria" v obsahu
    if (content.toLowerCase().includes('patria')) {
      return true;
    }
    
    return false;
  }
  
  async parse(content: string | ArrayBuffer, filename: string): Promise<ParsedTransaction[]> {
    // Patria primárne exportuje do XLSX
    if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      return this.parseExcel(content, filename);
    }
    
    // CSV fallback
    return this.parseCSVFile(content, filename);
  }
  
  private async parseExcel(content: string | ArrayBuffer, filename: string): Promise<ParsedTransaction[]> {
    const transactions: ParsedTransaction[] = [];
    
    try {
      const workbook = XLSX.read(content, { type: typeof content === 'string' ? 'string' : 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      
      if (data.length < 2) return transactions;
      
      // Nájdi hlavičku
      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(10, data.length); i++) {
        const row = data[i] as string[];
        if (row && row.some(cell => 
          String(cell).toLowerCase().includes('dátum') || 
          String(cell).toLowerCase().includes('typ')
        )) {
          headerRowIndex = i;
          break;
        }
      }
      
      const headers = (data[headerRowIndex] as string[]).map(h => String(h || '').toLowerCase().trim());
      
      // Mapovanie stĺpcov
      const dateIdx = headers.findIndex(h => h.includes('dátum'));
      const typeIdx = headers.findIndex(h => h.includes('typ'));
      const instrumentIdx = headers.findIndex(h => h.includes('inštrument') || h.includes('instrument') || h.includes('názov'));
      const quantityIdx = headers.findIndex(h => h.includes('množstvo') || h.includes('počet'));
      const priceIdx = headers.findIndex(h => h.includes('cena'));
      const valueIdx = headers.findIndex(h => h.includes('hodnota') || h.includes('suma'));
      const feeIdx = headers.findIndex(h => h.includes('poplatok'));
      const currencyIdx = headers.findIndex(h => h.includes('mena'));
      const isinIdx = headers.findIndex(h => h.includes('isin'));
      
      for (let i = headerRowIndex + 1; i < data.length; i++) {
        const row = data[i] as (string | number | Date)[];
        if (!row || row.length < 3) continue;
        
        // Spracuj dátum
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
        
        // Hodnota transakcie
        let amount = valueIdx >= 0 ? this.parseAmount(String(row[valueIdx] || '0')) : 0;
        const fee = feeIdx >= 0 ? this.parseAmount(String(row[feeIdx] || '0')) : 0;
        const currency = currencyIdx >= 0 ? String(row[currencyIdx] || 'EUR').toUpperCase() : 'EUR';
        
        // Typ operácie určuje znamienko
        const operationType = String(row[typeIdx] || '').toLowerCase();
        if (operationType.includes('nákup') || operationType.includes('buy') || operationType.includes('vklad')) {
          amount = -Math.abs(amount);
        } else if (operationType.includes('predaj') || operationType.includes('sell') || operationType.includes('výber') || operationType.includes('dividenda')) {
          amount = Math.abs(amount);
        }
        
        // Poplatok odpočítaj
        if (fee !== 0) {
          amount = amount - Math.abs(fee);
        }
        
        // Popis
        const instrument = instrumentIdx >= 0 ? String(row[instrumentIdx] || '') : '';
        const isin = isinIdx >= 0 ? String(row[isinIdx] || '') : '';
        const quantity = quantityIdx >= 0 ? String(row[quantityIdx] || '') : '';
        const price = priceIdx >= 0 ? String(row[priceIdx] || '') : '';
        
        const description = [
          operationType,
          instrument,
          quantity ? `${quantity} ks` : '',
          price ? `@ ${price}` : '',
        ].filter(Boolean).join(' ');
        
        const transaction: ParsedTransaction = {
          date,
          amount,
          currency,
          counterparty: 'Patria Finance',
          description: description || undefined,
          category: 'Investment',
          rawData: {
            source: 'Patria',
            format: 'Excel',
            filename,
            operationType,
            instrument,
            isin,
            quantity,
            price,
            fee,
          },
        };
        
        transactions.push(transaction);
      }
    } catch (error) {
      console.error('Error parsing Patria Excel:', error);
    }
    
    return transactions;
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
    
    // Rovnaká logika ako pre Excel
    const dateIdx = headers.findIndex(h => h.includes('dátum'));
    const typeIdx = headers.findIndex(h => h.includes('typ'));
    const instrumentIdx = headers.findIndex(h => h.includes('inštrument') || h.includes('instrument'));
    const valueIdx = headers.findIndex(h => h.includes('hodnota') || h.includes('suma'));
    const currencyIdx = headers.findIndex(h => h.includes('mena'));
    
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (row.length < 3) continue;
      
      const date = this.parseDate(row[dateIdx] || '');
      if (!date) continue;
      
      let amount = this.parseAmount(row[valueIdx] || '0');
      const currency = (row[currencyIdx] || 'EUR').toUpperCase();
      const operationType = (row[typeIdx] || '').toLowerCase();
      
      if (operationType.includes('nákup') || operationType.includes('buy')) {
        amount = -Math.abs(amount);
      }
      
      const transaction: ParsedTransaction = {
        date,
        amount,
        currency,
        counterparty: 'Patria Finance',
        description: row[instrumentIdx] || operationType,
        category: 'Investment',
        rawData: { source: 'Patria', filename },
      };
      
      transactions.push(transaction);
    }
    
    return transactions;
  }
  
  detectAccountNumber(content: string | ArrayBuffer): string | null {
    const text = typeof content === 'string' ? content : new TextDecoder('utf-8').decode(content);
    
    // Hľadaj číslo účtu alebo klienta
    const accountMatch = text.match(/[Čč]íslo\s+(účtu|klienta)[:\s]+(\d+)/i);
    if (accountMatch) {
      return `PATRIA-${accountMatch[2]}`;
    }
    
    return null;
  }
}
