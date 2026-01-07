"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export interface CreateAccountInput {
  bankName: string
  accountNumber: string
  ownerName: string
  type?: string
  currency?: string
}

export async function getAccounts() {
  const accounts = await prisma.account.findMany({
    include: {
      _count: {
        select: { transactions: true }
      }
    },
    orderBy: { bankName: 'asc' }
  })
  return accounts
}

export async function getAccountById(id: string) {
  return prisma.account.findUnique({
    where: { id },
    include: {
      _count: {
        select: { transactions: true }
      }
    }
  })
}

export async function createAccount(input: CreateAccountInput) {
  const account = await prisma.account.create({
    data: {
      bankName: input.bankName,
      accountNumber: input.accountNumber,
      ownerName: input.ownerName,
      type: input.type || 'CHECKING',
      currency: input.currency || 'EUR',
    }
  })
  
  revalidatePath('/accounts')
  revalidatePath('/')
  
  return account
}

export async function updateAccount(id: string, input: Partial<CreateAccountInput>) {
  const account = await prisma.account.update({
    where: { id },
    data: input
  })
  
  revalidatePath('/accounts')
  revalidatePath('/')
  
  return account
}

export async function deleteAccount(id: string) {
  // Vymaže aj všetky transakcie kvôli onDelete: Cascade
  await prisma.account.delete({
    where: { id }
  })
  
  revalidatePath('/accounts')
  revalidatePath('/transactions')
  revalidatePath('/')
}

export async function findOrCreateAccount(bankName: string, accountNumber: string, ownerName: string = 'Neznámy') {
  // Skús nájsť existujúci účet
  let account = await prisma.account.findFirst({
    where: {
      bankName,
      accountNumber
    }
  })
  
  // Ak neexistuje, vytvor ho
  if (!account) {
    account = await prisma.account.create({
      data: {
        bankName,
        accountNumber,
        ownerName,
        type: bankName === 'Patria' || bankName === 'Portu' ? 'INVESTMENT' : 'CHECKING',
        currency: 'EUR'
      }
    })
  }
  
  return account
}
