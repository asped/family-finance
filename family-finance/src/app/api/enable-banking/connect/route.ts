import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const ENABLE_BANKING_API = 'https://api.enablebanking.com'

/**
 * Generuje JWT token pre Enable Banking API
 * kid = Application ID z Enable Banking
 */
function generateJWT(appId: string, privateKey: string): string {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: appId  // Key ID je Application ID
  }
  
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: appId,
    aud: 'https://api.enablebanking.com',
    iat: now,
    exp: now + 3600, // 1 hodina
  }
  
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url')
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  
  const signatureInput = `${encodedHeader}.${encodedPayload}`
  
  // Podpíš pomocou RSA private key
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(signatureInput)
  const signature = sign.sign(privateKey, 'base64url')
  
  return `${signatureInput}.${signature}`
}

export async function POST(request: NextRequest) {
  try {
    const { aspspId, bankName } = await request.json()
    
    const appId = process.env.ENABLE_BANKING_APP_ID
    const privateKey = process.env.ENABLE_BANKING_PRIVATE_KEY?.replace(/\\n/g, '\n')
    const redirectUri = process.env.ENABLE_BANKING_REDIRECT_URI
    
    console.log('Enable Banking Config:', {
      appId: appId ? `${appId.substring(0, 8)}...` : 'MISSING',
      privateKeyLength: privateKey?.length || 0,
      redirectUri: redirectUri || 'MISSING'
    })
    
    if (!appId || !privateKey || !redirectUri) {
      return NextResponse.json(
        { error: 'Enable Banking nie je nakonfigurované', details: { appId: !!appId, privateKey: !!privateKey, redirectUri: !!redirectUri } },
        { status: 500 }
      )
    }
    
    // Generuj JWT
    const jwt = generateJWT(appId, privateKey)
    
    // Debug: decode JWT header to verify kid is present
    const [headerB64] = jwt.split('.')
    const headerJson = Buffer.from(headerB64, 'base64url').toString()
    console.log('JWT Header:', headerJson)
    
    // Vytvor session v Enable Banking
    const response = await fetch(`${ENABLE_BANKING_API}/auth`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access: {
          valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 90 dní
        },
        aspsp: {
          name: aspspId,
          country: 'SK'
        },
        state: `bank_${aspspId}_${Date.now()}`,
        redirect_url: redirectUri,
        psu_type: 'personal'
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Enable Banking API error:', response.status, errorText)
      
      // Debug: decode JWT header and payload
      const [headerB64, payloadB64] = jwt.split('.')
      const headerJson = Buffer.from(headerB64, 'base64url').toString()
      const payloadJson = Buffer.from(payloadB64, 'base64url').toString()
      
      return NextResponse.json(
        { 
          error: `Enable Banking API chyba: ${response.status}`,
          details: errorText,
          debug: {
            jwtHeader: headerJson,
            jwtPayload: payloadJson,
            appIdUsed: appId?.substring(0, 8) + '...'
          }
        },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    
    return NextResponse.json({
      authorizationUrl: data.url,
      sessionId: data.session_id
    })
    
  } catch (error) {
    console.error('Error initiating Enable Banking connection:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Neznáma chyba' },
      { status: 500 }
    )
  }
}
