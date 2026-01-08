/**
 * Enable Banking API Integration
 * 
 * Dokumentácia: https://enablebanking.com/docs/api/reference/
 * 
 * Enable Banking poskytuje prístup k bankovým API bez nutnosti vlastnej TPP licencie.
 * Využíva AISP (Account Information Service Provider) licenciu.
 */

import type { EnableBankingSession, EnableBankingAccount, EnableBankingTransaction } from "@/types"

const ENABLE_BANKING_API = 'https://api.enablebanking.com'

interface EnableBankingConfig {
  appId: string
  privateKey: string
  redirectUri: string
}

function getConfig(): EnableBankingConfig {
  const appId = process.env.ENABLE_BANKING_APP_ID
  const privateKey = process.env.ENABLE_BANKING_PRIVATE_KEY
  const redirectUri = process.env.ENABLE_BANKING_REDIRECT_URI
  
  if (!appId || !privateKey || !redirectUri) {
    throw new Error('Enable Banking konfigurácia nie je kompletná. Nastavte ENABLE_BANKING_APP_ID, ENABLE_BANKING_PRIVATE_KEY a ENABLE_BANKING_REDIRECT_URI v .env súbore.')
  }
  
  return { appId, privateKey, redirectUri }
}

/**
 * Generuje JWT token pre autentifikáciu voči Enable Banking API
 */
async function generateJWT(): Promise<string> {
  const config = getConfig()
  
  // V produkčnom prostredí by sa použila knižnica ako jose
  // Pre PoC vrátime placeholder
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  }
  
  const payload = {
    iss: config.appId,
    aud: 'enablebanking.com',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hodina
  }
  
  // Toto je zjednodušená implementácia
  // V reálnej aplikácii by sa JWT podpisoval pomocou RSA privátneho kľúča
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url')
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  
  // Placeholder signature - v produkcii by sa použil crypto.sign()
  const signature = 'signature_placeholder'
  
  return `${encodedHeader}.${encodedPayload}.${signature}`
}

/**
 * Získa zoznam podporovaných bánk (ASPSP)
 */
export async function getAvailableASPSPs(country: string = 'SK'): Promise<Array<{
  name: string
  aspspId: string
  logo?: string
}>> {
  try {
    const jwt = await generateJWT()
    const config = getConfig()
    
    const response = await fetch(`${ENABLE_BANKING_API}/aspsps?country=${country}`, {
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      }
    })
    
    if (!response.ok) {
      throw new Error(`Enable Banking API error: ${response.status}`)
    }
    
    const data = await response.json()
    return data.aspsps || []
  } catch (error) {
    console.error('Error fetching ASPSPs:', error)
    // Vráť mock dáta pre development
    return [
      { name: 'Slovenská sporiteľňa', aspspId: 'GIBASKBX' },
      { name: 'mBank', aspspId: 'BREXSKBX' },
      { name: 'Tatra banka', aspspId: 'TATRSKBX' },
      { name: '365.bank', aspspId: 'POLOOPBX' },
      { name: 'ČSOB', aspspId: 'CABORSKX' },
      { name: 'VÚB banka', aspspId: 'SUBASKBX' },
    ]
  }
}

/**
 * Iniciuje autorizačný flow pre pripojenie banky
 */
export async function initiateAuthorization(aspspId: string): Promise<EnableBankingSession> {
  try {
    const jwt = await generateJWT()
    const config = getConfig()
    
    const response = await fetch(`${ENABLE_BANKING_API}/auth`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        aspsp: { name: aspspId },
        state: `session_${Date.now()}`,
        redirect_url: config.redirectUri,
        access: {
          valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90 dní
        }
      })
    })
    
    if (!response.ok) {
      throw new Error(`Enable Banking API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    return {
      sessionId: data.session_id,
      authorizationUrl: data.url,
      expiresAt: new Date(data.access?.valid_until || Date.now() + 90 * 24 * 60 * 60 * 1000)
    }
  } catch (error) {
    console.error('Error initiating authorization:', error)
    throw error
  }
}

/**
 * Získa účty po úspešnej autorizácii
 */
export async function getAccounts(sessionId: string): Promise<EnableBankingAccount[]> {
  try {
    const jwt = await generateJWT()
    
    const response = await fetch(`${ENABLE_BANKING_API}/sessions/${sessionId}/accounts`, {
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      }
    })
    
    if (!response.ok) {
      throw new Error(`Enable Banking API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    return (data.accounts || []).map((acc: Record<string, unknown>) => ({
      resourceId: acc.resource_id as string,
      iban: acc.iban as string,
      currency: acc.currency as string,
      ownerName: acc.owner_name as string || 'Neznámy',
      name: acc.name as string,
    }))
  } catch (error) {
    console.error('Error fetching accounts:', error)
    throw error
  }
}

/**
 * Získa transakcie pre daný účet
 */
export async function getTransactions(
  sessionId: string,
  accountId: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<EnableBankingTransaction[]> {
  try {
    const jwt = await generateJWT()
    
    const params = new URLSearchParams()
    if (dateFrom) {
      params.append('date_from', dateFrom.toISOString().split('T')[0])
    }
    if (dateTo) {
      params.append('date_to', dateTo.toISOString().split('T')[0])
    }
    
    const url = `${ENABLE_BANKING_API}/sessions/${sessionId}/accounts/${accountId}/transactions?${params}`
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      }
    })
    
    if (!response.ok) {
      throw new Error(`Enable Banking API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    return (data.transactions || []).map((tx: Record<string, unknown>) => ({
      transactionId: tx.transaction_id as string,
      bookingDate: tx.booking_date as string,
      valueDate: tx.value_date as string,
      transactionAmount: tx.transaction_amount as { amount: string; currency: string },
      creditorName: tx.creditor_name as string,
      creditorAccount: tx.creditor_account as { iban?: string },
      debtorName: tx.debtor_name as string,
      debtorAccount: tx.debtor_account as { iban?: string },
      remittanceInformationUnstructured: tx.remittance_information_unstructured as string,
      remittanceInformationStructured: tx.remittance_information_structured as string,
    }))
  } catch (error) {
    console.error('Error fetching transactions:', error)
    throw error
  }
}

/**
 * Konvertuje Enable Banking transakciu na ParsedTransaction
 */
export function convertToParsedTransaction(ebTx: EnableBankingTransaction) {
  const amount = parseFloat(ebTx.transactionAmount.amount)
  const isCredit = amount > 0
  
  return {
    date: new Date(ebTx.bookingDate),
    amount,
    currency: ebTx.transactionAmount.currency,
    counterparty: isCredit ? ebTx.debtorName : ebTx.creditorName,
    counterpartyAccount: isCredit ? ebTx.debtorAccount?.iban : ebTx.creditorAccount?.iban,
    description: ebTx.remittanceInformationUnstructured || ebTx.remittanceInformationStructured,
    rawData: {
      source: 'Enable Banking',
      transactionId: ebTx.transactionId,
    }
  }
}
