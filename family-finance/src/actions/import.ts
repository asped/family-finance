"use server"

import { parserManager } from "@/parsers"
import { findOrCreateAccount } from "./accounts"
import { importTransactions } from "./transactions"
import type { BankName, ImportResult } from "@/types"

export interface ImportFileResult {
  success: boolean
  bankName: BankName
  accountId?: string
  accountNumber?: string
  imported: number
  duplicates: number
  errors: string[]
  debugInfo?: string  // Jednoduchý string pre debug
}

export async function processImportFile(
  formData: FormData,
  forceBankName?: BankName,
  ownerName?: string
): Promise<ImportFileResult> {
  const debugLines: string[] = []
  let detectedBank: BankName = 'Unknown'
  
  try {
    const file = formData.get('file') as File
    
    if (!file) {
      return {
        success: false,
        bankName: 'Unknown',
        imported: 0,
        duplicates: 0,
        errors: ['Súbor nebol poskytnutý'],
        debugInfo: 'No file provided'
      }
    }
    
    // Načítaj obsah súboru
    const content = await file.arrayBuffer()
    const filename = file.name
    const fileSize = content.byteLength
    
    debugLines.push(`Súbor: ${filename} (${fileSize} bytes)`)
    
    // Debug: konvertuj na text pre náhľad
    let textContent = ''
    try {
      // Skús UTF-8
      let text = new TextDecoder('utf-8').decode(content)
      if (text.includes('\uFFFD')) {
        // Fallback na Windows-1250
        text = new TextDecoder('windows-1250').decode(content)
        debugLines.push('Kódovanie: Windows-1250')
      } else {
        debugLines.push('Kódovanie: UTF-8')
      }
      textContent = text
      
      // Extrahuj prvých pár riadkov pre debug
      const lines = text.split(/\r?\n/).filter(l => l.trim()).slice(0, 5)
      debugLines.push(`Počet riadkov: ${text.split(/\r?\n/).filter(l => l.trim()).length}`)
      debugLines.push(`Prvý riadok: ${lines[0]?.substring(0, 80) || 'prázdny'}...`)
      
      // Nájdi riadok s hlavičkami
      for (let i = 0; i < Math.min(30, lines.length); i++) {
        const line = text.split(/\r?\n/)[i] || ''
        if (line.toLowerCase().includes('dátum') || line.toLowerCase().includes('datum')) {
          debugLines.push(`Hlavičky na riadku ${i}: ${line.substring(0, 100)}...`)
          break
        }
      }
    } catch (e) {
      debugLines.push(`Chyba dekódovania: ${e}`)
    }
    
    // Parsuj súbor
    debugLines.push('Spúšťam parser...')
    const parseResult: ImportResult = await parserManager.parseFile(content, filename, forceBankName)
    detectedBank = parseResult.bankName
    
    debugLines.push(`Detekovaná banka: ${parseResult.bankName}`)
    debugLines.push(`Nájdených transakcií: ${parseResult.transactions.length}`)
    if (parseResult.errors.length > 0) {
      debugLines.push(`Parser chyby: ${parseResult.errors.join(', ')}`)
    }
    
    console.log('=== IMPORT DEBUG ===')
    console.log(debugLines.join('\n'))
    
    if (!parseResult.success || parseResult.transactions.length === 0) {
      // Pridaj debug info priamo do errors
      const allErrors = [
        ...(parseResult.errors.length > 0 ? parseResult.errors : ['V súbore neboli nájdené žiadne transakcie']),
        '--- DEBUG ---',
        ...debugLines
      ]
      
      return {
        success: false,
        bankName: parseResult.bankName,
        imported: 0,
        duplicates: 0,
        errors: allErrors,
        debugInfo: debugLines.join(' | ')
      }
    }
    
    // Nájdi alebo vytvor účet
    const accountNumber = parseResult.accountNumber || `${parseResult.bankName}-${Date.now()}`
    const account = await findOrCreateAccount(
      parseResult.bankName,
      accountNumber,
      ownerName || 'Neznámy'
    )
    
    // Importuj transakcie
    const importResult = await importTransactions(
      account.id,
      parseResult.transactions,
      filename
    )
    
    return {
      success: importResult.imported > 0,
      bankName: parseResult.bankName,
      accountId: account.id,
      accountNumber: account.accountNumber,
      imported: importResult.imported,
      duplicates: importResult.duplicates,
      errors: [...parseResult.errors, ...importResult.errors],
      debugInfo: debugLines.join(' | ')
    }
    
  } catch (error) {
    // Zachyť všetky chyby
    const errorMessage = error instanceof Error ? error.message : 'Neznáma chyba'
    debugLines.push(`EXCEPTION: ${errorMessage}`)
    console.error('Import error:', error)
    
    return {
      success: false,
      bankName: detectedBank,
      imported: 0,
      duplicates: 0,
      errors: [`Chyba pri spracovaní: ${errorMessage}`, '--- DEBUG ---', ...debugLines],
      debugInfo: debugLines.join(' | ')
    }
  }
}

export async function getSupportedBanks(): Promise<BankName[]> {
  return parserManager.getSupportedBanks()
}
