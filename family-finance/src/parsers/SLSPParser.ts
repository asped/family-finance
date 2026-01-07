import { BaseParser } from './BaseParser';
import { ParsedTransaction, BankName } from '@/types';
import * as XLSX from 'xlsx';

/**
 * Parser pre SLSP (Slovenská sporiteľňa) - George exporty
 * Podporuje SEPA XML (camt.053) a Excel (XLSX) formáty
 */
export class SLSPParser extends BaseParser {
  name: BankName = 'SLSP';
  
  // Známe hlavičky SLSP Excel exportov
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
    
    // Kontrola Excel hlavičiek
    const headerLower = headers.map(h => h.toLowerCase().trim());
    const matchCount = this.slspExcelHeaders.filter(h => 
      headerLower.some(header => header.includes(h))
    ).length;
    
    // Ak sa zhoduje aspoň 5 hlavičiek, je to pravdepodobne SLSP
    if (matchCount >= 5) return true;
    
    // Kontrola na "George" alebo "Slovenská sporiteľňa" v obsahu
    if (content.toLowerCase().includes('george') || 
        content.toLowerCase().includes('slovenská sporiteľňa') ||
        content.toLowerCase().includes('slovenska sporitelna')) {
      return true;
    }
    
    return false;
  }
  
  async parse(content: string | ArrayBuffer, filename: string): Promise<ParsedTransaction[]> {
    // Detekcia typu súboru
    if (filename.endsWith('.xml') || (typeof content === 'string' && content.includes('<?xml'))) {
      return this.parseSepaXml(content, filename);
    }
    
    // Excel alebo CSV
    return this.parseExcel(content, filename);
  }
  
  /**
   * Parsuje SEPA XML (camt.053) formát
   */
  private async parseSepaXml(content: string | ArrayBuffer, filename: string): Promise<ParsedTransaction[]> {
    const text = typeof content === 'string' ? content : new TextDecoder('utf-8').decode(content);
    const transactions: ParsedTransaction[] = [];
    
    // Jednoduchý XML parser pre camt.053
    // V produkčnom prostredí by sa použila knižnica ako fast-xml-parser
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
  private async parseExcel(content: string | ArrayBuffer, filename: string): Promise<ParsedTransaction[]> {
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
      const dateIdx = headers.findIndex(h => h.includes('dátum') && (h.includes('účtov') || h.includes('transakc')));
      const amountIdx = headers.findIndex(h => h.includes('suma') || h.includes('čiastka'));
      const currencyIdx = headers.findIndex(h => h.includes('mena'));
      const counterpartyIdx = headers.findIndex(h => h.includes('názov protistrany') || h.includes('protiúčet'));
      const counterpartyAccountIdx = headers.findIndex(h => h.includes('iban') || h.includes('účet protistrany'));
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
        
        const amount = this.parseAmount(String(row[amountIdx] || '0'));
        const currency = String(row[currencyIdx] || 'EUR').toUpperCase();
        
        const transaction: ParsedTransaction = {
          date,
          amount,
          currency,
          counterparty: String(row[counterpartyIdx] || '') || undefined,
          counterpartyAccount: String(row[counterpartyAccountIdx] || '') || undefined,
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
    const text = typeof content === 'string' ? content : new TextDecoder('utf-8').decode(content);
    
    // IBAN pattern
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
