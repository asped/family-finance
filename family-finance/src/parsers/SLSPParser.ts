import { BaseParser } from './BaseParser';
import { ParsedTransaction, BankName } from '@/types';
import * as XLSX from 'xlsx';

/**
 * Parser pre SLSP (Slovenská sporiteľňa) - George exporty
 * Podporuje:
 * - CSV export (bodkočiarka delimiter)
 * - SEPA XML (camt.053)
 * - Excel (XLSX)
 */
export class SLSPParser extends BaseParser {
  name: BankName = 'SLSP';
  
  // Známe hlavičky SLSP CSV exportov (nový formát)
  private readonly slspCsvHeaders = [
    'vlastný názov účtu',
    'vlastny nazov uctu',
    'vlastný iban',
    'vlastny iban',
    'dátum splatnosti',
    'datum splatnosti',
    'partner',
    'iban partnera',
    'typ transakcie',
    'konštantný symbol',
    'špecifický symbol',
    'variabilný symbol',
  ];
  
  // Známe hlavičky SLSP Excel exportov (starý formát)
  private readonly slspExcelHeaders = [
    'dátum',
    'suma',
    'mena',
    'typ',
    'protiúčet',
    'názov protistrany',
    'variabilný symbol',
    'konštantný symbol',
    'špecifický symbol',
    'poznámka',
    'správa pre príjemcu',
  ];
  
  canParse(headers: string[], content: string): boolean {
    // Kontrola XML - SEPA camt.053
    if (content.includes('<?xml') && content.includes('camt.053') || content.includes('<BkToCstmrStmt>')) {
      return true;
    }
    
    const headerLower = headers.map(h => h.toLowerCase().replace(/"/g, '').trim());
    
    // Kontrola CSV hlavičiek (nový formát)
    const csvMatchCount = this.slspCsvHeaders.filter(h => 
      headerLower.some(header => header.includes(h))
    ).length;
    if (csvMatchCount >= 4) return true;
    
    // Kontrola Excel hlavičiek (starý formát)
    const excelMatchCount = this.slspExcelHeaders.filter(h => 
      headerLower.some(header => header.includes(h))
    ).length;
    if (excelMatchCount >= 5) return true;
    
    // Kontrola na "George", "SLSP" alebo "Slovenská sporiteľňa" v obsahu
    const contentLower = content.toLowerCase();
    if (contentLower.includes('george') || 
        contentLower.includes('slovenská sporiteľňa') ||
        contentLower.includes('slovenska sporitelna') ||
        contentLower.includes('slsp') ||
        contentLower.includes('space účet')) {
      return true;
    }
    
    return false;
  }
  
  async parse(content: string | ArrayBuffer, filename: string): Promise<ParsedTransaction[]> {
    // Konvertuj na text
    let text: string;
    if (content instanceof ArrayBuffer) {
      // Skús UTF-8, potom Windows-1250
      try {
        text = new TextDecoder('utf-8').decode(content);
        if (text.includes('\uFFFD')) {
          text = new TextDecoder('windows-1250').decode(content);
        }
      } catch {
        text = new TextDecoder('windows-1250').decode(content);
      }
    } else {
      text = content;
    }
    
    // Detekcia typu súboru
    if (filename.endsWith('.xml') || text.includes('<?xml')) {
      return this.parseSepaXml(text, filename);
    }
    
    if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      return this.parseExcel(content, filename);
    }
    
    // CSV formát
    if (filename.endsWith('.csv') || text.includes(';')) {
      return this.parseCsv(text, filename);
    }
    
    // Fallback na Excel parser
    return this.parseExcel(content, filename);
  }
  
  /**
   * Parsuje CSV formát SLSP
   * Formát hlavičky:
   * "Vlastný názov účtu";"Vlastný IBAN";"Dátum splatnosti";"Suma";"Mena";"Partner";...
   */
  private parseCsv(text: string, filename: string): ParsedTransaction[] {
    console.log('=== SLSP CSV PARSER DEBUG ===');
    console.log('Content length:', text.length);
    console.log('First 300 chars:', text.substring(0, 300));
    
    const transactions: ParsedTransaction[] = [];
    const lines = this.parseCSV(text, ';');
    
    console.log('Total lines parsed:', lines.length);
    
    if (lines.length < 2) {
      console.log('SLSP: Not enough lines');
      return transactions;
    }
    
    // Debug: ukáž prvých 5 riadkov
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      console.log(`Line ${i}:`, lines[i].slice(0, 5).join(' | '));
    }
    
    // Prvý riadok sú hlavičky
    const headers = lines[0].map(h => h.toLowerCase().replace(/"/g, '').trim());
    console.log('SLSP CSV headers:', headers);
    
    // Mapovanie stĺpcov
    const accountNameIdx = headers.findIndex(h => h.includes('vlastný názov') || h.includes('vlastny nazov'));
    const ownIbanIdx = headers.findIndex(h => h.includes('vlastný iban') || h.includes('vlastny iban'));
    const dateIdx = headers.findIndex(h => h.includes('dátum') || h.includes('datum'));
    const amountIdx = headers.findIndex(h => h === 'suma' || h.includes('"suma"'));
    const currencyIdx = headers.findIndex(h => h === 'mena' || h.includes('"mena"'));
    const partnerIdx = headers.findIndex(h => h === 'partner' || h.includes('"partner"'));
    const partnerIbanIdx = headers.findIndex(h => h.includes('iban partnera'));
    const descIdx = headers.findIndex(h => h.includes('popis transakcie'));
    const typeIdx = headers.findIndex(h => h.includes('typ transakcie'));
    const ksIdx = headers.findIndex(h => h.includes('konštantný') || h.includes('konstantny'));
    const ssIdx = headers.findIndex(h => h.includes('špecifický') || h.includes('specificky'));
    const vsIdx = headers.findIndex(h => h.includes('variabilný') || h.includes('variabilny'));
    
    console.log('SLSP column indices:', { dateIdx, amountIdx, currencyIdx, partnerIdx, partnerIbanIdx });
    
    console.log('Processing SLSP rows from 1 to', lines.length - 1);
    
    // Spracuj transakcie (od riadku 1, pretože 0 sú hlavičky)
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      
      console.log(`Row ${i}:`, row.slice(0, 5).join(' | '));
      
      // Preskočiť prázdne riadky
      if (row.length < 4) {
        console.log(`  Skipping: too few columns (${row.length})`);
        continue;
      }
      
      // Dátum - formát DD.MM.YYYY
      const dateStr = row[dateIdx]?.replace(/"/g, '').trim() || '';
      const date = this.parseDate(dateStr);
      
      console.log(`  Date string: "${dateStr}", parsed:`, date);
      
      if (!date) {
        console.log('  Skipping: invalid date');
        continue;
      }
      
      // Suma - formát "-480,00" alebo "-2 500,00"
      const amountStr = row[amountIdx]?.replace(/"/g, '').trim() || '0';
      const amount = this.parseSLSPAmount(amountStr);
      
      // Mena
      const currency = (row[currencyIdx]?.replace(/"/g, '').trim() || 'EUR').toUpperCase();
      
      // Partner a IBAN
      const partner = row[partnerIdx]?.replace(/"/g, '').trim() || '';
      const partnerIban = row[partnerIbanIdx]?.replace(/"/g, '').trim() || '';
      
      // Popis a typ transakcie
      const description = row[descIdx]?.replace(/"/g, '').trim() || '';
      const transactionType = row[typeIdx]?.replace(/"/g, '').trim() || '';
      
      // Symboly
      const ks = ksIdx >= 0 ? row[ksIdx]?.replace(/"/g, '').trim() : undefined;
      const ss = ssIdx >= 0 ? row[ssIdx]?.replace(/"/g, '').trim() : undefined;
      const vs = vsIdx >= 0 ? row[vsIdx]?.replace(/"/g, '').trim() : undefined;
      
      // Vlastný účet
      const ownIban = row[ownIbanIdx]?.replace(/"/g, '').trim() || '';
      
      const transaction: ParsedTransaction = {
        date,
        amount,
        currency,
        counterparty: partner || undefined,
        counterpartyAccount: partnerIban || undefined,
        description: [transactionType, description].filter(Boolean).join(' - ') || undefined,
        variableSymbol: vs || undefined,
        constantSymbol: ks || undefined,
        specificSymbol: ss || undefined,
        rawData: {
          source: 'SLSP',
          format: 'CSV',
          filename,
          ownIban,
          transactionType,
          row: Object.fromEntries(headers.map((h, idx) => [h, row[idx]?.replace(/"/g, '')])),
        },
      };
      
      console.log('  Created transaction:', { date: transaction.date, amount: transaction.amount, partner });
      transactions.push(this.applyCategorization(transaction));
    }
    
    console.log('Total SLSP transactions parsed:', transactions.length);
    return transactions;
  }
  
  /**
   * Parsuje sumu z SLSP formátu (napr. "-480,00" alebo "-2 500,00")
   */
  private parseSLSPAmount(amountStr: string): number {
    if (!amountStr) return 0;
    
    // Odstráň medzery (tisícový oddeľovač) a nahraď čiarku bodkou
    const normalized = amountStr
      .replace(/\s/g, '')  // Odstráň medzery
      .replace(',', '.');   // Nahraď desatinnú čiarku
    
    const amount = parseFloat(normalized);
    return isNaN(amount) ? 0 : amount;
  }
  
  /**
   * Parsuje SEPA XML (camt.053) formát
   */
  private parseSepaXml(text: string, filename: string): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];
    
    // Jednoduchý XML parser pre camt.053
    const entryRegex = /<Ntry>([\s\S]*?)<\/Ntry>/g;
    let match;
    
    while ((match = entryRegex.exec(text)) !== null) {
      const entry = match[1];
      
      // Extrahuj základné údaje
      const amount = this.extractXmlValue(entry, 'Amt') || '0';
      const currency = this.extractXmlAttribute(entry, 'Amt', 'Ccy') || 'EUR';
      const creditDebit = this.extractXmlValue(entry, 'CdtDbtInd'); // CRDT alebo DBIT
      const bookingDate = this.extractXmlValue(entry, 'BookgDt/Dt') || this.extractXmlValue(entry, 'BookgDt');
      
      // Protistrana
      const counterpartyName = this.extractXmlValue(entry, 'RltdPties/Cdtr/Nm') || 
                               this.extractXmlValue(entry, 'RltdPties/Dbtr/Nm');
      const counterpartyIban = this.extractXmlValue(entry, 'RltdPties/CdtrAcct/Id/IBAN') ||
                               this.extractXmlValue(entry, 'RltdPties/DbtrAcct/Id/IBAN');
      
      // Popis a referenčné údaje
      const description = this.extractXmlValue(entry, 'AddtlNtryInf') ||
                          this.extractXmlValue(entry, 'NtryDtls/TxDtls/RmtInf/Ustrd');
      
      // Slovenské symboly
      const variableSymbol = this.extractXmlValue(entry, 'RmtInf/Strd/CdtrRefInf/Ref');
      
      const date = this.parseDate(bookingDate || '');
      if (!date) continue;
      
      let amountNum = this.parseAmount(amount);
      if (creditDebit === 'DBIT') {
        amountNum = -Math.abs(amountNum);
      } else {
        amountNum = Math.abs(amountNum);
      }
      
      const transaction: ParsedTransaction = {
        date,
        amount: amountNum,
        currency,
        counterparty: counterpartyName || undefined,
        counterpartyAccount: counterpartyIban || undefined,
        description: description || undefined,
        variableSymbol: variableSymbol || undefined,
        rawData: {
          source: 'SLSP',
          format: 'SEPA XML camt.053',
          filename,
        },
      };
      
      transactions.push(this.applyCategorization(transaction));
    }
    
    return transactions;
  }
  
  /**
   * Parsuje Excel (XLSX) formát
   */
  private parseExcel(content: string | ArrayBuffer, filename: string): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];
    
    try {
      const workbook = XLSX.read(content, { type: typeof content === 'string' ? 'string' : 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      // Konvertuj na JSON
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      
      if (data.length < 2) return transactions;
      
      // Nájdi hlavičku
      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(10, data.length); i++) {
        const row = data[i] as string[];
        if (row && row.some(cell => 
          String(cell).toLowerCase().includes('dátum') || 
          String(cell).toLowerCase().includes('suma')
        )) {
          headerRowIndex = i;
          break;
        }
      }
      
      const headers = (data[headerRowIndex] as string[]).map(h => String(h || '').toLowerCase().trim());
      
      // Mapovanie stĺpcov
      const dateIdx = headers.findIndex(h => h.includes('dátum') && (h.includes('účtov') || h.includes('transakc') || h.includes('splatnosti')));
      const amountIdx = headers.findIndex(h => h.includes('suma') || h.includes('čiastka'));
      const currencyIdx = headers.findIndex(h => h.includes('mena'));
      const counterpartyIdx = headers.findIndex(h => h.includes('názov protistrany') || h.includes('partner') || h.includes('protiúčet'));
      const counterpartyAccountIdx = headers.findIndex(h => h.includes('iban') && h.includes('partner'));
      const descIdx = headers.findIndex(h => h.includes('poznámka') || h.includes('popis'));
      const vsIdx = headers.findIndex(h => h.includes('variabilný'));
      const ksIdx = headers.findIndex(h => h.includes('konštantný'));
      const ssIdx = headers.findIndex(h => h.includes('špecifický'));
      
      // Fallback pre dátum
      const effectiveDateIdx = dateIdx >= 0 ? dateIdx : headers.findIndex(h => h.includes('dátum'));
      
      for (let i = headerRowIndex + 1; i < data.length; i++) {
        const row = data[i] as (string | number | Date)[];
        if (!row || row.length < 3) continue;
        
        // Spracuj dátum
        let date: Date | null = null;
        const dateValue = row[effectiveDateIdx];
        if (dateValue instanceof Date) {
          date = dateValue;
        } else if (typeof dateValue === 'number') {
          // Excel serial date
          date = new Date((dateValue - 25569) * 86400 * 1000);
        } else {
          date = this.parseDate(String(dateValue || ''));
        }
        
        if (!date) continue;
        
        // Spracuj sumu - môže byť vo formáte s medzerou
        const amountValue = row[amountIdx];
        const amount = typeof amountValue === 'number' 
          ? amountValue 
          : this.parseSLSPAmount(String(amountValue || '0'));
        
        const currency = String(row[currencyIdx] || 'EUR').toUpperCase();
        
        const transaction: ParsedTransaction = {
          date,
          amount,
          currency,
          counterparty: String(row[counterpartyIdx] || '') || undefined,
          counterpartyAccount: counterpartyAccountIdx >= 0 ? String(row[counterpartyAccountIdx] || '') || undefined : undefined,
          description: String(row[descIdx] || '') || undefined,
          variableSymbol: vsIdx >= 0 ? String(row[vsIdx] || '') || undefined : undefined,
          constantSymbol: ksIdx >= 0 ? String(row[ksIdx] || '') || undefined : undefined,
          specificSymbol: ssIdx >= 0 ? String(row[ssIdx] || '') || undefined : undefined,
          rawData: {
            source: 'SLSP',
            format: 'Excel',
            filename,
            row: Object.fromEntries(headers.map((h, idx) => [h, row[idx]])),
          },
        };
        
        transactions.push(this.applyCategorization(transaction));
      }
    } catch (error) {
      console.error('Error parsing SLSP Excel:', error);
    }
    
    return transactions;
  }
  
  /**
   * Pomocná metóda na extrahovanie hodnoty z XML
   */
  private extractXmlValue(xml: string, path: string): string | null {
    const parts = path.split('/');
    let current = xml;
    
    for (const part of parts) {
      const regex = new RegExp(`<${part}[^>]*>([\\s\\S]*?)<\\/${part}>`, 'i');
      const match = current.match(regex);
      if (!match) return null;
      current = match[1];
    }
    
    return current.trim();
  }
  
  /**
   * Pomocná metóda na extrahovanie atribútu z XML
   */
  private extractXmlAttribute(xml: string, element: string, attribute: string): string | null {
    const regex = new RegExp(`<${element}[^>]*${attribute}="([^"]*)"`, 'i');
    const match = xml.match(regex);
    return match ? match[1] : null;
  }
  
  detectAccountNumber(content: string | ArrayBuffer): string | null {
    let text: string;
    if (content instanceof ArrayBuffer) {
      try {
        text = new TextDecoder('utf-8').decode(content);
      } catch {
        text = new TextDecoder('windows-1250').decode(content);
      }
    } else {
      text = content;
    }
    
    // IBAN pattern - hľadaj "Vlastný IBAN" alebo prvý SK IBAN
    const ownIbanMatch = text.match(/"Vlastný IBAN"[;\s]*"?(SK\d{22})"?/i);
    if (ownIbanMatch) {
      return ownIbanMatch[1];
    }
    
    // Generický IBAN pattern
    const ibanMatch = text.match(/SK\d{22}/);
    if (ibanMatch) {
      return ibanMatch[0];
    }
    
    // SEPA XML účet
    const acctMatch = text.match(/<IBAN>([A-Z]{2}\d{22})<\/IBAN>/);
    if (acctMatch) {
      return acctMatch[1];
    }
    
    return null;
  }
}
