"use client"

import { useState, useRef } from "react"
import { processImportFile, getSupportedBanks } from "@/actions/import"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import type { BankName } from "@/types"

interface ImportResult {
  success: boolean
  bankName: BankName
  accountId?: string
  accountNumber?: string
  imported: number
  duplicates: number
  errors: string[]
}

const SUPPORTED_FORMATS = [
  { bank: 'mBank', formats: 'CSV (bodkočiarka ako oddeľovač)' },
  { bank: 'SLSP', formats: 'SEPA XML (camt.053), Excel (XLSX)' },
  { bank: 'Revolut', formats: 'CSV, Excel (XLSX)' },
  { bank: 'Patria', formats: 'Excel (XLSX), CSV' },
  { bank: 'Portu', formats: 'CSV' },
]

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [ownerName, setOwnerName] = useState("")
  const [forceBankName, setForceBankName] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)
    }
  }
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      setFile(droppedFile)
      setResult(null)
    }
  }
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!file) {
      alert('Vyberte súbor na import')
      return
    }
    
    setLoading(true)
    setResult(null)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const importResult = await processImportFile(
        formData,
        forceBankName as BankName || undefined,
        ownerName || undefined
      )
      
      setResult(importResult)
      
      // Clear form on success
      if (importResult.success) {
        setFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    } catch (error) {
      console.error('Import error:', error)
      setResult({
        success: false,
        bankName: 'Unknown',
        imported: 0,
        duplicates: 0,
        errors: [error instanceof Error ? error.message : 'Neznáma chyba pri importe']
      })
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import transakcií</h1>
        <p className="text-muted-foreground">
          Nahrajte výpis z banky a automaticky importujte transakcie
        </p>
      </div>
      
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Import Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Nahrať súbor
            </CardTitle>
            <CardDescription>
              Podporované formáty: CSV, XLSX, XML
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Drop Zone */}
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.xml"
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileSpreadsheet className="h-10 w-10 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">
                      Kliknite alebo presuňte súbor sem
                    </p>
                    <p className="text-sm text-muted-foreground">
                      CSV, XLSX, XML (max 10MB)
                    </p>
                  </div>
                )}
              </div>
              
              {/* Owner Name */}
              <div className="space-y-2">
                <Label htmlFor="ownerName">Meno majiteľa účtu (voliteľné)</Label>
                <Input
                  id="ownerName"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Ján Novák"
                />
              </div>
              
              {/* Force Bank Selection */}
              <div className="space-y-2">
                <Label htmlFor="forceBankName">Vybrať banku manuálne (voliteľné)</Label>
                <Select value={forceBankName} onValueChange={setForceBankName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Automatická detekcia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Automatická detekcia</SelectItem>
                    <SelectItem value="mBank">mBank</SelectItem>
                    <SelectItem value="SLSP">Slovenská sporiteľňa</SelectItem>
                    <SelectItem value="Revolut">Revolut</SelectItem>
                    <SelectItem value="Patria">Patria Finance</SelectItem>
                    <SelectItem value="Portu">Portu</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Použite ak automatická detekcia nefunguje správne
                </p>
              </div>
              
              <Button type="submit" disabled={!file || loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importujem...
                  </>
                ) : (
                  'Importovať transakcie'
                )}
              </Button>
            </form>
            
            {/* Result */}
            {result && (
              <div className="mt-4">
                <Alert variant={result.success ? "success" : "destructive"}>
                  {result.success ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertTitle>
                    {result.success ? 'Import úspešný' : 'Import zlyhal'}
                  </AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 space-y-1">
                      <p>Banka: <strong>{result.bankName}</strong></p>
                      {result.accountNumber && (
                        <p>Účet: <strong>{result.accountNumber}</strong></p>
                      )}
                      <p>Importované: <strong>{result.imported}</strong> transakcií</p>
                      {result.duplicates > 0 && (
                        <p>Preskočené (duplikáty): <strong>{result.duplicates}</strong></p>
                      )}
                      {result.errors.length > 0 && (
                        <div className="mt-2">
                          <p className="font-medium">Chyby:</p>
                          <ul className="list-disc list-inside text-sm">
                            {result.errors.map((error, i) => (
                              <li key={i}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Supported Formats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Podporované formáty
            </CardTitle>
            <CardDescription>
              Ako získať výpis z vašej banky
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {SUPPORTED_FORMATS.map((item) => (
                <div key={item.bank} className="border-b pb-4 last:border-0 last:pb-0">
                  <h4 className="font-medium">{item.bank}</h4>
                  <p className="text-sm text-muted-foreground">{item.formats}</p>
                </div>
              ))}
            </div>
            
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Ako exportovať výpis</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Prihláste sa do internet bankingu</li>
                <li>Prejdite do sekcie "Výpisy" alebo "História"</li>
                <li>Vyberte obdobie a formát exportu</li>
                <li>Stiahnite súbor a nahrajte ho sem</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
