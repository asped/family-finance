import { ParserStrategy, BankName, ParsedTransaction, ImportResult } from '@/types';
import { MBankParser } from './MBankParser';
import { SLSPParser } from './SLSPParser';
import { RevolutParser } from './RevolutParser';
import { PatriaParser } from './PatriaParser';
import { PortuParser } from './PortuParser';
import * as XLSX from 'xlsx';

/**
 * Parser Manager - implementácia Strategy pattern pre bankové parsery
 * 
 * Umožňuje ľahké pridávanie nových parserov pre ďalšie banky
 */
export class ParserManager {
  private parsers: ParserStrategy[] = [];
  
  constructor() {
    // Registrácia všetkých dostupných parserov
    this.registerParser(new MBankParser());
    this.registerParser(new SLSPParser());
    this.registerParser(new RevolutParser());
    this.registerParser(new PatriaParser());
    this.registerParser(new PortuParser());
  }
  
  /**
   * Registruje nový parser
   */
  registerParser(parser: ParserStrategy): void {
    this.parsers.push(parser);
  }
  
  /**
   * Detekuje banku na základe obsahu súboru
   */
  detectBank(content: string | ArrayBuffer, filename: string): BankName {
    const textContent = this.getTextContent(content);
    const headers = this.extractHeaders(content, filename);
    
    for (const parser of this.parsers) {
      if (parser.canParse(headers, textContent)) {
        return parser.name;
      }
    }
    
    return 'Unknown';
  }
  
  /**
   * Parsuje súbor a vracia výsledok importu
   */
  async parseFile(
    content: string | ArrayBuffer,
    filename: string,
    forceBankName?: BankName
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      transactions: [],
      errors: [],
      bankName: 'Unknown',
      duplicatesSkipped: 0,
    };
    
    try {
      // Detekcia banky
      const bankName = forceBankName || this.detectBank(content, filename);
      result.bankName = bankName;
      
      if (bankName === 'Unknown') {
        result.errors.push('Nepodarilo sa rozpoznať formát súboru. Skúste manuálne vybrať banku.');
        return result;
      }
      
      // Nájdi správny parser
      const parser = this.parsers.find(p => p.name === bankName);
      if (!parser) {
        result.errors.push(`Parser pre banku ${bankName} nie je dostupný.`);
        return result;
      }
      
      // Parsuj transakcie
      const transactions = await parser.parse(content, filename);
      result.transactions = transactions;
      
      // Detekuj číslo účtu
      result.accountNumber = parser.detectAccountNumber(content) || undefined;
      
      result.success = transactions.length > 0;
      
      if (transactions.length === 0) {
        result.errors.push('V súbore neboli nájdené žiadne transakcie.');
      }
      
    } catch (error) {
      result.errors.push(`Chyba pri spracovaní súboru: ${error instanceof Error ? error.message : 'Neznáma chyba'}`);
    }
    
    return result;
  }
  
  /**
   * Extrahuje hlavičky zo súboru
   */
  private extractHeaders(content: string | ArrayBuffer, filename: string): string[] {
    try {
      // Excel súbory
      if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
        const workbook = XLSX.read(content, { 
          type: typeof content === 'string' ? 'string' : 'array' 
        });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
        
        // Hľadaj prvý neprázdny riadok s aspoň 3 bunkami
        for (let i = 0; i < Math.min(10, data.length); i++) {
          if (data[i] && data[i].filter(Boolean).length >= 3) {
            return data[i].map(h => String(h || ''));
          }
        }
        return [];
      }
      
      // Text súbory (CSV, XML)
      const text = this.getTextContent(content);
      
      // XML súbory
      if (text.includes('<?xml') || filename.endsWith('.xml')) {
        return ['xml'];
      }
      
      // CSV súbory - extrahuj prvý riadok
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      if (lines.length > 0) {
        // Detekuj delimiter
        const firstLine = lines[0];
        const semicolonCount = (firstLine.match(/;/g) || []).length;
        const commaCount = (firstLine.match(/,/g) || []).length;
        const delimiter = semicolonCount > commaCount ? ';' : ',';
        
        return firstLine.split(delimiter).map(h => h.replace(/"/g, '').trim());
      }
      
      return [];
    } catch {
      return [];
    }
  }
  
  /**
   * Konvertuje ArrayBuffer na string
   */
  private getTextContent(content: string | ArrayBuffer): string {
    if (typeof content === 'string') {
      return content;
    }
    return new TextDecoder('utf-8').decode(content);
  }
  
  /**
   * Zoznam podporovaných bánk
   */
  getSupportedBanks(): BankName[] {
    return this.parsers.map(p => p.name);
  }
}

// Singleton instance
export const parserManager = new ParserManager();

// Re-export jednotlivých parserov pre priame použitie
export { MBankParser } from './MBankParser';
export { SLSPParser } from './SLSPParser';
export { RevolutParser } from './RevolutParser';
export { PatriaParser } from './PatriaParser';
export { PortuParser } from './PortuParser';
