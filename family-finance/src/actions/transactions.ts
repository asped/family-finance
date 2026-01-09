"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { generateTransactionHash, categorizeTransaction } from "@/lib/utils"
import type { ParsedTransaction, TransactionFilters, FinancialSummary } from "@/types"

export interface CreateTransactionInput {
  accountId: string
  date: Date
  amount: number
  currency?: string
  counterparty?: string
  counterpartyAccount?: string
  description?: string
  variableSymbol?: string
  specificSymbol?: string
  constantSymbol?: string
  category?: string
  rawData?: Record<string, unknown>
  importSource?: string
}

export type SortField = 'date' | 'amount' | 'bankName' | 'counterparty' | 'category'
export type SortOrder = 'asc' | 'desc'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface PaginatedTransactions {
  transactions: any[] // Complex type with include relations
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function getTransactions(
  filters?: TransactionFilters,
  page: number = 1,
  pageSize: number = 50,
  sortField: SortField = 'date',
  sortOrder: SortOrder = 'desc'
): Promise<PaginatedTransactions> {
  const where: Record<string, unknown> = {}
  
  if (filters?.accountId) {
    where.accountId = filters.accountId
  }
  
  if (filters?.bankName) {
    where.account = { bankName: filters.bankName }
  }
  
  if (filters?.dateFrom || filters?.dateTo) {
    where.date = {}
    if (filters.dateFrom) {
      (where.date as Record<string, Date>).gte = filters.dateFrom
    }
    if (filters.dateTo) {
      (where.date as Record<string, Date>).lte = filters.dateTo
    }
  }
  
  if (filters?.amountMin !== undefined || filters?.amountMax !== undefined) {
    where.amount = {}
    if (filters.amountMin !== undefined) {
      (where.amount as Record<string, number>).gte = filters.amountMin
    }
    if (filters.amountMax !== undefined) {
      (where.amount as Record<string, number>).lte = filters.amountMax
    }
  }
  
  if (filters?.searchText) {
    where.OR = [
      { description: { contains: filters.searchText } },
      { counterparty: { contains: filters.searchText } },
    ]
  }
  
  if (filters?.category) {
    where.category = filters.category
  }
  
  if (filters?.showInternalTransfers === false) {
    where.isInternalTransfer = false
  }
  
  // Build orderBy based on sortField
  let orderBy: Record<string, unknown> = {}
  if (sortField === 'bankName') {
    orderBy = { account: { bankName: sortOrder } }
  } else {
    orderBy = { [sortField]: sortOrder }
  }
  
  // Get total count
  const total = await prisma.transaction.count({ where })
  
  // Get paginated transactions
  const transactions = await prisma.transaction.findMany({
    where,
    include: {
      account: {
        select: {
          id: true,
          bankName: true,
          accountNumber: true,
          ownerName: true,
        }
      }
    },
    orderBy,
    skip: (page - 1) * pageSize,
    take: pageSize,
  })
  
  return {
    transactions,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function createTransaction(input: CreateTransactionInput) {
  // Generuj hash pre deduplikáciu
  const transactionHash = generateTransactionHash(
    input.accountId,
    input.date,
    input.amount,
    input.description,
    input.counterparty
  )
  
  // Skontroluj či transakcia už existuje
  const existing = await prisma.transaction.findUnique({
    where: { transactionHash }
  })
  
  if (existing) {
    return { transaction: existing, isDuplicate: true }
  }
  
  // Auto-kategorizácia ak nie je zadaná
  let category = input.category
  if (!category) {
    category = categorizeTransaction(input.description || '', input.counterparty || '') || undefined
  }
  
  const transaction = await prisma.transaction.create({
    data: {
      accountId: input.accountId,
      date: input.date,
      amount: input.amount,
      currency: input.currency || 'EUR',
      counterparty: input.counterparty,
      counterpartyAccount: input.counterpartyAccount,
      description: input.description,
      variableSymbol: input.variableSymbol,
      specificSymbol: input.specificSymbol,
      constantSymbol: input.constantSymbol,
      category,
      transactionHash,
      rawData: input.rawData ? JSON.stringify(input.rawData) : null,
      importSource: input.importSource,
    }
  })
  
  return { transaction, isDuplicate: false }
}

export async function importTransactions(
  accountId: string,
  transactions: ParsedTransaction[],
  importSource: string
) {
  let imported = 0
  let duplicates = 0
  const errors: string[] = []
  
  for (const tx of transactions) {
    try {
      const result = await createTransaction({
        accountId,
        date: tx.date,
        amount: tx.amount,
        currency: tx.currency,
        counterparty: tx.counterparty,
        counterpartyAccount: tx.counterpartyAccount,
        description: tx.description,
        variableSymbol: tx.variableSymbol,
        specificSymbol: tx.specificSymbol,
        constantSymbol: tx.constantSymbol,
        category: tx.category,
        rawData: tx.rawData,
        importSource,
      })
      
      if (result.isDuplicate) {
        duplicates++
      } else {
        imported++
      }
    } catch (error) {
      errors.push(`Chyba pri importe transakcie z ${tx.date}: ${error instanceof Error ? error.message : 'Neznáma chyba'}`)
    }
  }
  
  // Po importe spusti detekciu interných prevodov
  await detectInternalTransfers()
  
  revalidatePath('/transactions')
  revalidatePath('/')
  
  return { imported, duplicates, errors }
}

export async function updateTransactionCategory(id: string, category: string) {
  await prisma.transaction.update({
    where: { id },
    data: { category }
  })
  
  revalidatePath('/transactions')
}

export async function deleteTransaction(id: string) {
  await prisma.transaction.delete({
    where: { id }
  })
  
  revalidatePath('/transactions')
  revalidatePath('/')
}

/**
 * Detekcia interných prevodov
 * Algoritmus: Označí transakciu ako interný prevod ak v rovnaký deň (alebo +/- 1 deň)
 * existuje transakcia s opačným znamienkom a identickou sumou na inom účte
 */
export async function detectInternalTransfers() {
  // Načítaj všetky transakcie
  const transactions = await prisma.transaction.findMany({
    orderBy: { date: 'asc' }
  })
  
  // Resetuj všetky interné prevody
  await prisma.transaction.updateMany({
    data: {
      isInternalTransfer: false,
      internalTransferPairId: null
    }
  })
  
  const processed = new Set<string>()
  
  for (const tx of transactions) {
    if (processed.has(tx.id)) continue
    
    // Hľadaj párovú transakciu
    const txDate = new Date(tx.date)
    const dayBefore = new Date(txDate)
    dayBefore.setDate(dayBefore.getDate() - 1)
    const dayAfter = new Date(txDate)
    dayAfter.setDate(dayAfter.getDate() + 1)
    
    // Hľadaj transakciu s opačným znamienkom a rovnakou absolútnou hodnotou
    const targetAmount = -tx.amount
    
    const pair = transactions.find(other => {
      if (other.id === tx.id) return false
      if (processed.has(other.id)) return false
      if (other.accountId === tx.accountId) return false // Musí byť iný účet
      
      // Kontrola sumy (s toleranciou pre zaokrúhlenie)
      if (Math.abs(other.amount - targetAmount) > 0.01) return false
      
      // Kontrola dátumu (+/- 1 deň)
      const otherDate = new Date(other.date)
      if (otherDate < dayBefore || otherDate > dayAfter) return false
      
      return true
    })
    
    if (pair) {
      // Označ obe transakcie ako interné prevody
      await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          isInternalTransfer: true,
          internalTransferPairId: pair.id
        }
      })
      
      await prisma.transaction.update({
        where: { id: pair.id },
        data: {
          isInternalTransfer: true,
          internalTransferPairId: tx.id
        }
      })
      
      processed.add(tx.id)
      processed.add(pair.id)
    }
  }
  
  revalidatePath('/transactions')
  revalidatePath('/')
}

/**
 * Vypočíta finančný súhrn
 */
export async function getFinancialSummary(filters?: TransactionFilters): Promise<FinancialSummary> {
  const result = await getTransactions(filters, 1, 10000) // Get all for summary
  const transactions = result.transactions
  
  let totalIncome = 0
  let totalExpense = 0
  let incomeWithoutTransfers = 0
  let expenseWithoutTransfers = 0
  
  const categoryMap = new Map<string, { income: number; expense: number; count: number }>()
  const monthMap = new Map<string, { income: number; expense: number }>()
  
  for (const tx of transactions) {
    const amount = tx.amount
    const category = tx.category || 'Uncategorized'
    const month = new Date(tx.date).toISOString().substring(0, 7) // YYYY-MM
    
    // Celkové súčty
    if (amount > 0) {
      totalIncome += amount
      if (!tx.isInternalTransfer) {
        incomeWithoutTransfers += amount
      }
    } else {
      totalExpense += Math.abs(amount)
      if (!tx.isInternalTransfer) {
        expenseWithoutTransfers += Math.abs(amount)
      }
    }
    
    // Kategórie
    if (!categoryMap.has(category)) {
      categoryMap.set(category, { income: 0, expense: 0, count: 0 })
    }
    const catData = categoryMap.get(category)!
    if (amount > 0) {
      catData.income += amount
    } else {
      catData.expense += Math.abs(amount)
    }
    catData.count++
    
    // Mesiace
    if (!monthMap.has(month)) {
      monthMap.set(month, { income: 0, expense: 0 })
    }
    const monthData = monthMap.get(month)!
    if (amount > 0) {
      monthData.income += amount
    } else {
      monthData.expense += Math.abs(amount)
    }
  }
  
  // Konvertuj mapy na polia
  const byCategory = Array.from(categoryMap.entries())
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => (b.income + b.expense) - (a.income + a.expense))
  
  const byMonth = Array.from(monthMap.entries())
    .map(([month, data]) => ({ 
      month, 
      ...data, 
      netCashFlow: data.income - data.expense 
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
  
  return {
    totalIncome,
    totalExpense,
    netCashFlow: totalIncome - totalExpense,
    incomeWithoutTransfers,
    expenseWithoutTransfers,
    netCashFlowWithoutTransfers: incomeWithoutTransfers - expenseWithoutTransfers,
    byCategory,
    byMonth,
  }
}

/**
 * Získa unikátne kategórie
 */
export async function getCategories(): Promise<string[]> {
  const result = await prisma.transaction.findMany({
    where: { category: { not: null } },
    select: { category: true },
    distinct: ['category']
  })
  
  return result.map(r => r.category!).sort()
}
