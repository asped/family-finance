"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { 
  Link2, 
  Building2, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink,
  RefreshCw,
  Info
} from "lucide-react"

interface ASPSP {
  name: string
  aspspId: string
  logo?: string
}

interface BankConnection {
  id: string
  bankName: string
  status: string
  consentExpiresAt?: Date
}

export default function EnableBankingPage() {
  const [banks, setBanks] = useState<ASPSP[]>([])
  const [connections, setConnections] = useState<BankConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    loadData()
  }, [])
  
  const loadData = async () => {
    setLoading(true)
    try {
      // Mock data pre demo - v produkcii by sa volalo API
      setBanks([
        { name: 'Slovenská sporiteľňa', aspspId: 'GIBASKBX' },
        { name: 'mBank', aspspId: 'BREXSKBX' },
        { name: 'Tatra banka', aspspId: 'TATRSKBX' },
        { name: '365.bank', aspspId: 'POLOOPBX' },
        { name: 'ČSOB', aspspId: 'CABORSKX' },
        { name: 'VÚB banka', aspspId: 'SUBASKBX' },
        { name: 'UniCredit Bank', aspspId: 'UNCRSKBX' },
        { name: 'Fio banka', aspspId: 'FIOZSKBA' },
      ])
    } catch (err) {
      setError('Nepodarilo sa načítať zoznam bánk')
    } finally {
      setLoading(false)
    }
  }
  
  const handleConnect = async (bank: ASPSP) => {
    setConnecting(bank.aspspId)
    setError(null)
    
    try {
      // Tu by sa volalo Enable Banking API na získanie autorizačnej URL
      // const session = await initiateAuthorization(bank.aspspId)
      // window.location.href = session.authorizationUrl
      
      // Pre demo zobrazíme info modal
      alert(`Pre prepojenie s ${bank.name} je potrebné:\n\n1. Registrovať sa na enablebanking.com\n2. Nastaviť ENABLE_BANKING_APP_ID a ENABLE_BANKING_PRIVATE_KEY v .env\n3. Implementovať callback endpoint\n\nPo nastavení budete presmerovaný do banky na autorizáciu.`)
    } catch (err) {
      setError(`Nepodarilo sa prepojiť s ${bank.name}`)
    } finally {
      setConnecting(null)
    }
  }
  
  const isConfigured = process.env.NEXT_PUBLIC_ENABLE_BANKING_CONFIGURED === 'true'
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Enable Banking</h1>
        <p className="text-muted-foreground">
          Automatická synchronizácia transakcií cez Open Banking API
        </p>
      </div>
      
      {/* Info Banner */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Čo je Enable Banking?</AlertTitle>
        <AlertDescription>
          <p className="mb-2">
            Enable Banking je agregátor, ktorý umožňuje prístup k bankovým dátam cez PSD2 API 
            bez nutnosti vlastnej TPP licencie. Po prepojení sa transakcie automaticky synchronizujú.
          </p>
          <a 
            href="https://enablebanking.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center text-primary hover:underline"
          >
            Viac informácií <ExternalLink className="h-3 w-3 ml-1" />
          </a>
        </AlertDescription>
      </Alert>
      
      {/* Configuration Status */}
      {!isConfigured && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Enable Banking nie je nakonfigurované</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              Pre použitie Enable Banking je potrebné nastaviť tieto premenné v .env súbore:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>ENABLE_BANKING_APP_ID - ID aplikácie z Enable Banking</li>
              <li>ENABLE_BANKING_PRIVATE_KEY - RSA privátny kľúč</li>
              <li>ENABLE_BANKING_REDIRECT_URI - Callback URL</li>
            </ul>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Active Connections */}
      {connections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Prepojené banky
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {connections.map((conn) => (
                <div 
                  key={conn.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium">{conn.bankName}</p>
                      <p className="text-sm text-muted-foreground">
                        {conn.consentExpiresAt 
                          ? `Platný do: ${new Date(conn.consentExpiresAt).toLocaleDateString('sk-SK')}`
                          : 'Aktívny'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={conn.status === 'active' ? 'default' : 'secondary'}>
                      {conn.status === 'active' ? 'Aktívny' : conn.status}
                    </Badge>
                    <Button variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Synchronizovať
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Available Banks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Dostupné banky
          </CardTitle>
          <CardDescription>
            Vyberte banku na prepojenie
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {banks.map((bank) => (
                <div
                  key={bank.aspspId}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{bank.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {bank.aspspId}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleConnect(bank)}
                    disabled={connecting === bank.aspspId}
                  >
                    {connecting === bank.aspspId ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      'Prepojiť'
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle>Ako to funguje</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                1
              </span>
              <div>
                <p className="font-medium">Vyberte banku</p>
                <p className="text-sm text-muted-foreground">
                  Zo zoznamu podporovaných bánk vyberte tú, ktorú chcete prepojiť
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                2
              </span>
              <div>
                <p className="font-medium">Autorizujte prístup</p>
                <p className="text-sm text-muted-foreground">
                  Budete presmerovaný do internet bankingu, kde povolíte prístup k údajom
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                3
              </span>
              <div>
                <p className="font-medium">Automatická synchronizácia</p>
                <p className="text-sm text-muted-foreground">
                  Transakcie sa budú automaticky synchronizovať. Súhlas je platný 90 dní.
                </p>
              </div>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
