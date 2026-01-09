"use client"

import { useEffect, useState } from "react"
import { getAccounts, createAccount, deleteAccount, updateAccount } from "@/actions/accounts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Wallet, Plus, Trash2, CreditCard, PiggyBank, Building, Pencil, X, Check } from "lucide-react"

interface Account {
  id: string
  bankName: string
  accountNumber: string
  ownerName: string
  type: string
  currency: string
  _count: {
    transactions: number
  }
}

const BANK_OPTIONS = ['mBank', 'SLSP', 'Revolut', 'Patria', 'Portu', 'PSS', 'Tatra banka', '365.bank', 'ČSOB', 'VÚB', 'Iné']
const TYPE_OPTIONS = [
  { value: 'CHECKING', label: 'Bežný účet' },
  { value: 'INVESTMENT', label: 'Investičný účet' },
  { value: 'SAVINGS', label: 'Sporenie' },
]
const CURRENCY_OPTIONS = ['EUR', 'USD', 'CZK', 'GBP', 'PLN', 'HUF', 'CHF']

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  
  // Form state for new account
  const [bankName, setBankName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [ownerName, setOwnerName] = useState("")
  const [accountType, setAccountType] = useState("CHECKING")
  const [currency, setCurrency] = useState("EUR")
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBankName, setEditBankName] = useState("")
  const [editAccountNumber, setEditAccountNumber] = useState("")
  const [editOwnerName, setEditOwnerName] = useState("")
  const [editAccountType, setEditAccountType] = useState("")
  const [editCurrency, setEditCurrency] = useState("")
  const [saving, setSaving] = useState(false)
  
  const loadAccounts = async () => {
    setLoading(true)
    try {
      const accs = await getAccounts()
      setAccounts(accs as Account[])
    } catch (error) {
      console.error('Error loading accounts:', error)
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    loadAccounts()
  }, [])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      await createAccount({
        bankName,
        accountNumber,
        ownerName,
        type: accountType,
        currency,
      })
      
      // Reset form
      setBankName("")
      setAccountNumber("")
      setOwnerName("")
      setAccountType("CHECKING")
      setCurrency("EUR")
      setShowForm(false)
      
      loadAccounts()
    } catch (error) {
      console.error('Error creating account:', error)
      alert('Chyba pri vytváraní účtu')
    }
  }
  
  const handleDelete = async (id: string) => {
    if (confirm('Naozaj chcete vymazať tento účet? Všetky transakcie budú tiež vymazané!')) {
      await deleteAccount(id)
      loadAccounts()
    }
  }
  
  const startEdit = (account: Account) => {
    setEditingId(account.id)
    setEditBankName(account.bankName)
    setEditAccountNumber(account.accountNumber)
    setEditOwnerName(account.ownerName)
    setEditAccountType(account.type)
    setEditCurrency(account.currency)
  }
  
  const cancelEdit = () => {
    setEditingId(null)
  }
  
  const saveEdit = async () => {
    if (!editingId) return
    
    setSaving(true)
    try {
      await updateAccount(editingId, {
        bankName: editBankName,
        accountNumber: editAccountNumber,
        ownerName: editOwnerName,
        type: editAccountType,
        currency: editCurrency,
      })
      setEditingId(null)
      loadAccounts()
    } catch (error) {
      console.error('Error updating account:', error)
      alert('Chyba pri aktualizácii účtu')
    } finally {
      setSaving(false)
    }
  }
  
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'INVESTMENT':
        return <PiggyBank className="h-5 w-5" />
      case 'SAVINGS':
        return <Building className="h-5 w-5" />
      default:
        return <CreditCard className="h-5 w-5" />
    }
  }
  
  const getTypeLabel = (type: string) => {
    return TYPE_OPTIONS.find(t => t.value === type)?.label || type
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Účty</h1>
          <p className="text-muted-foreground">
            Správa bankových účtov a investičných platforiem
          </p>
        </div>
        
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="h-4 w-4" />
          Pridať účet
        </Button>
      </div>
      
      {/* Add Account Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Nový účet</CardTitle>
            <CardDescription>
              Manuálne pridajte bankový účet alebo investičnú platformu
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bankName">Banka / Platforma</Label>
                  <Select value={bankName} onValueChange={setBankName}>
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte banku" />
                    </SelectTrigger>
                    <SelectContent>
                      {BANK_OPTIONS.map((bank) => (
                        <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Číslo účtu / IBAN</Label>
                  <Input
                    id="accountNumber"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="SK1234567890"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="ownerName">Meno majiteľa</Label>
                  <Input
                    id="ownerName"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Ján Novák"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="accountType">Typ účtu</Label>
                  <Select value={accountType} onValueChange={setAccountType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_OPTIONS.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="currency">Mena</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCY_OPTIONS.map((cur) => (
                        <SelectItem key={cur} value={cur}>{cur}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button type="submit">Vytvoriť účet</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Zrušiť
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      
      {/* Accounts List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          [1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))
        ) : accounts.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Žiadne účty</p>
              <p className="text-muted-foreground text-sm">
                Pridajte účet manuálne alebo importujte transakcie
              </p>
            </CardContent>
          </Card>
        ) : (
          accounts.map((account) => (
            <Card key={account.id}>
              <CardContent className="p-6">
                {editingId === account.id ? (
                  // Edit mode
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Banka</Label>
                      <Select value={editBankName} onValueChange={setEditBankName}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BANK_OPTIONS.map((bank) => (
                            <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs">IBAN</Label>
                      <Input
                        value={editAccountNumber}
                        onChange={(e) => setEditAccountNumber(e.target.value)}
                        className="h-8 text-sm font-mono"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs">Majiteľ</Label>
                      <Input
                        value={editOwnerName}
                        onChange={(e) => setEditOwnerName(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label className="text-xs">Typ</Label>
                        <Select value={editAccountType} onValueChange={setEditAccountType}>
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TYPE_OPTIONS.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-xs">Mena</Label>
                        <Select value={editCurrency} onValueChange={setEditCurrency}>
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CURRENCY_OPTIONS.map((cur) => (
                              <SelectItem key={cur} value={cur}>{cur}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" onClick={saveEdit} disabled={saving} className="flex-1">
                        <Check className="h-4 w-4 mr-1" />
                        {saving ? 'Ukladám...' : 'Uložiť'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEdit}>
                        <X className="h-4 w-4 mr-1" />
                        Zrušiť
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full text-primary">
                          {getTypeIcon(account.type)}
                        </div>
                        <div>
                          <h3 className="font-semibold">{account.bankName}</h3>
                          <p className="text-sm text-muted-foreground font-mono">
                            {account.accountNumber}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(account)}
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(account.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Majiteľ:</span>
                        <span>{account.ownerName}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Typ:</span>
                        <Badge variant="secondary">{getTypeLabel(account.type)}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Mena:</span>
                        <span>{account.currency}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Transakcií:</span>
                        <span className="font-medium">{account._count.transactions}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
