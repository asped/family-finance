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
  debug?: {
    fileSize: number
    filename: string
    detectedBank: BankName
    contentPreview: string
    headersFound: string[]
  }
}

export async function processImportFile(
  formData: FormData,
  forceBankName?: BankName,
  ownerName?: string
): Promise<ImportFileResult> {
  const file = formData.get('file') as File
  
  if (!file) {
    return {
      success: false,
      bankName: 'Unknown',
      imported: 0,
      duplicates: 0,
      errors: ['Súbor nebol poskytnutý']
    }
  }
  
  // Načítaj obsah súboru
  const content = await file.arrayBuffer()
  const filename = file.name
  
  // Debug: konvertuj na text pre náhľad
  let textPreview = ''
  try {
    // Skús UTF-8
    let text = new TextDecoder('utf-8').decode(content)
    if (text.includes('\uFFFD')) {
      // Fallback na Windows-1250
      text = new TextDecoder('windows-1250').decode(content)
    }
    textPreview = text.substring(0, 500)
    console.log('=== IMPORT DEBUG ===')
    console.log('Filename:', filename)
    console.log('File size:', content.byteLength)
    console.log('Content preview:', textPreview)
  } catch (e) {
    console.error('Error decoding content:', e)
  }
  
  // Parsuj súbor
  const parseResult: ImportResult = await parserManager.parseFile(content, filename, forceBankName)
  
  console.log('Parse result:', {
    success: parseResult.success,
    bankName: parseResult.bankName,
    transactionCount: parseResult.transactions.length,
    errors: parseResult.errors,
    accountNumber: parseResult.accountNumber
  })
  
  if (!parseResult.success || parseResult.transactions.length === 0) {
    // Extrahuj hlavičky pre debug
    let headersFound: string[] = []
    try {
      let text = new TextDecoder('utf-8').decode(content)
      if (text.includes('\uFFFD')) {
        text = new TextDecoder('windows-1250').decode(content)
      }
      const lines = text.split(/\r?\n/).filter(l => l.trim())
      // Nájdi prvý riadok s viacerými stĺpcami
      for (let i = 0; i < Math.min(20, lines.length); i++) {
        const parts = lines[i].split(/[;,]/)
        if (parts.length >= 3) {
          headersFound = parts.map(p => p.replace(/"/g, '').trim()).slice(0, 10)
          break
        }
      }
    } catch (e) {
      console.error('Error extracting headers:', e)
    }
    
    return {
      success: false,
      bankName: parseResult.bankName,
      imported: 0,
      duplicates: 0,
      errors: parseResult.errors.length > 0 
        ? parseResult.errors 
        : ['V súbore neboli nájdené žiadne transakcie'],
      debug: {
        fileSize: content.byteLength,
        filename,
        detectedBank: parseResult.bankName,
        contentPreview: textPreview,
        headersFound
      }
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
    errors: [...parseResult.errors, ...importResult.errors]
  }
}

export async function getSupportedBanks(): Promise<BankName[]> {
  return parserManager.getSupportedBanks()
}
