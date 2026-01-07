import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAccounts as getEnableBankingAccounts, getTransactions, convertToParsedTransaction } from '@/lib/enable-banking'
import { findOrCreateAccount } from '@/actions/accounts'
import { importTransactions } from '@/actions/transactions'

/**
 * Callback endpoint pre Enable Banking OAuth flow
 * 
 * Po úspešnej autorizácii v banke je používateľ presmerovaný sem
 * s parametrami: code, state
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  
  // Kontrola chýb
  if (error) {
    return NextResponse.redirect(
      new URL(`/enable-banking?error=${encodeURIComponent(error)}`, request.url)
    )
  }
  
  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/enable-banking?error=missing_params', request.url)
    )
  }
  
  try {
    // Získaj session ID zo state (v produkcii by mal byť uložený v databáze)
    const sessionId = state.replace('session_', '')
    
    // Získaj účty z Enable Banking
    const ebAccounts = await getEnableBankingAccounts(sessionId)
    
    if (ebAccounts.length === 0) {
      return NextResponse.redirect(
        new URL('/enable-banking?error=no_accounts', request.url)
      )
    }
    
    // Pre každý účet vytvor záznam a stiahni transakcie
    for (const ebAccount of ebAccounts) {
      // Nájdi alebo vytvor účet
      const account = await findOrCreateAccount(
        'Enable Banking', // V produkcii by sa použil skutočný názov banky
        ebAccount.iban,
        ebAccount.ownerName
      )
      
      // Aktualizuj účet so session ID
      await prisma.account.update({
        where: { id: account.id },
        data: {
          enableBankingSessionId: sessionId,
          consentExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 dní
        }
      })
      
      // Stiahni transakcie za posledných 90 dní
      const dateFrom = new Date()
      dateFrom.setDate(dateFrom.getDate() - 90)
      
      const ebTransactions = await getTransactions(
        sessionId,
        ebAccount.resourceId,
        dateFrom,
        new Date()
      )
      
      // Konvertuj a importuj transakcie
      const parsedTransactions = ebTransactions.map(convertToParsedTransaction)
      
      await importTransactions(
        account.id,
        parsedTransactions,
        `enable_banking_${sessionId}`
      )
    }
    
    // Úspešné presmerovanie
    return NextResponse.redirect(
      new URL('/transactions?success=import_complete', request.url)
    )
    
  } catch (err) {
    console.error('Enable Banking callback error:', err)
    return NextResponse.redirect(
      new URL('/enable-banking?error=callback_failed', request.url)
    )
  }
}
