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
  
  // Parsuj súbor
  const parseResult: ImportResult = await parserManager.parseFile(content, filename, forceBankName)
  
  if (!parseResult.success || parseResult.transactions.length === 0) {
    return {
      success: false,
      bankName: parseResult.bankName,
      imported: 0,
      duplicates: 0,
      errors: parseResult.errors.length > 0 
        ? parseResult.errors 
        : ['V súbore neboli nájdené žiadne transakcie']
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
