import { ParsedTransaction, ParserStrategy, BankName } from '@/types';
import { parseDate, parseAmount, categorizeTransaction } from '@/lib/utils';

/**
 * Abstraktná základná trieda pre všetky bankové parsery
 * Implementuje Strategy pattern pre ľahké pridávanie nových bánk
 */
export abstract class BaseParser implements ParserStrategy {
  abstract name: BankName;
  
  /**
   * Kontroluje či parser vie spracovať daný súbor na základe hlavičiek alebo obsahu
   */
  abstract canParse(headers: string[], content: string): boolean;
  
  /**
   * Parsuje obsah súboru a vracia pole transakcií
   */
  abstract parse(content: string | ArrayBuffer, filename: string): Promise<ParsedTransaction[]>;
  
  /**
   * Detekuje číslo účtu z obsahu súboru
   */
  abstract detectAccountNumber(content: string | ArrayBuffer): string | null;
  
  /**
   * Pomocná metóda na parsovanie CSV
   */
  protected parseCSV(content: string, delimiter: string = ','): string[][] {
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    return lines.map(line => this.parseCSVLine(line, delimiter));
  }
  
  /**
   * Parsuje jeden riadok CSV s ohľadom na úvodzovky
   */
  protected parseCSVLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }
  
  /**
   * Aplikuje automatickú kategorizáciu
   */
  protected applyCategorization(transaction: ParsedTransaction): ParsedTransaction {
    if (!transaction.category) {
      const category = categorizeTransaction(
        transaction.description || '',
        transaction.counterparty || ''
      );
      if (category) {
        transaction.category = category;
      }
    }
    return transaction;
  }
  
  /**
   * Pomocné metódy pre parsovanie
   */
  protected parseDate = parseDate;
  protected parseAmount = parseAmount;
}
