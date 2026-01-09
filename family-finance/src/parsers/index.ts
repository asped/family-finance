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
    
    console.log('=== BANK DETECTION DEBUG ===');
    console.log('Filename:', filename);
    console.log('Extracted headers:', headers);
    console.log('Content preview:', textContent.substring(0, 200));
    
    for (const parser of this.parsers) {
      const canParse = parser.canParse(headers, textContent);
      console.log(`  ${parser.name}: canParse = ${canParse}`);
      if (canParse) {
        console.log(`Detected bank: ${parser.name}`);
        return parser.name;
      }
    }
    
    console.log('No bank detected');
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
      
      // CSV súbory - hľadaj riadok s hlavičkami
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      
      // Detekuj delimiter z celého súboru
      const fullText = lines.slice(0, 30).join('\n');
      const semicolonCount = (fullText.match(/;/g) || []).length;
      const commaCount = (fullText.match(/,/g) || []).length;
      const delimiter = semicolonCount > commaCount ? ';' : ',';
      
      // Hľadaj riadok s hlavičkami (môže byť na riadku 10+ pre mBank)
      for (let i = 0; i < Math.min(30, lines.length); i++) {
        const line = lines[i];
        const parts = line.split(delimiter).map(h => h.replace(/"/g, '').trim());
        
        // Hľadaj riadok s "#Dátum" alebo "Dátum" alebo aspoň 4 neprázdne časti
        const hasDateHeader = parts.some(p => 
          p.toLowerCase().includes('dátum') || 
          p.toLowerCase().includes('datum') ||
          p.toLowerCase().includes('date')
        );
        
        if (hasDateHeader && parts.filter(Boolean).length >= 3) {
          return parts;
        }
      }
      
      // Fallback - prvý riadok
      if (lines.length > 0) {
        return lines[0].split(delimiter).map(h => h.replace(/"/g, '').trim());
      }
      
      return [];
    } catch {
      return [];
    }
  }
  
  /**
   * Konvertuje ArrayBuffer na string
   * Podporuje: UTF-16 LE/BE, UTF-8, Windows-1250
   */
  private getTextContent(content: string | ArrayBuffer): string {
    if (typeof content === 'string') {
      return content;
    }
    
    const bytes = new Uint8Array(content);
    
    // UTF-16 LE BOM: FF FE (SLSP používa toto!)
    if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
      return new TextDecoder('utf-16le').decode(content);
    }
    
    // UTF-16 BE BOM: FE FF
    if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
      return new TextDecoder('utf-16be').decode(content);
    }
    
    // UTF-8 BOM: EF BB BF
    if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      return new TextDecoder('utf-8').decode(content);
    }
    
    // Skús UTF-8
    const utf8Text = new TextDecoder('utf-8').decode(content);
    if (!utf8Text.includes('\uFFFD')) {
      return utf8Text;
    }
    
    // Fallback na Windows-1250 (mBank)
    return new TextDecoder('windows-1250').decode(content);
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
