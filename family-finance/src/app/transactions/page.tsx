"use client"

import { useEffect, useState, useCallback } from "react"
import { getTransactions, getCategories, updateTransactionCategory, deleteTransaction } from "@/actions/transactions"
import { getAccounts } from "@/actions/accounts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, formatDate, CATEGORIES } from "@/lib/utils"
import { Search, Filter, Trash2, ArrowUpDown, X } from "lucide-react"
import type { TransactionFilters } from "@/types"

interface Transaction {
  id: string
  date: Date
  amount: number
  currency: string
  counterparty: string | null
  description: string | null
  category: string | null
  isInternalTransfer: boolean
  account: {
    id: string
    bankName: string
    accountNumber: string
    ownerName: string
  }
}

interface Account {
  id: string
  bankName: string
  accountNumber: string
  ownerName: string
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  
  // Filter state
  const [filters, setFilters] = useState<TransactionFilters>({
    showInternalTransfers: true
  })
  const [searchText, setSearchText] = useState("")
  const [selectedAccount, setSelectedAccount] = useState<string>("")
  const [selectedBank, setSelectedBank] = useState<string>("")
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [amountMin, setAmountMin] = useState<string>("")
  const [amountMax, setAmountMax] = useState<string>("")
  
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const appliedFilters: TransactionFilters = {
        ...filters,
        searchText: searchText || undefined,
        accountId: selectedAccount || undefined,
        bankName: selectedBank || undefined,
        category: selectedCategory || undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        amountMin: amountMin ? parseFloat(amountMin) : undefined,
        amountMax: amountMax ? parseFloat(amountMax) : undefined,
      }
      
      const [txs, accs, cats] = await Promise.all([
        getTransactions(appliedFilters),
        getAccounts(),
        getCategories()
      ])
      
      setTransactions(txs as Transaction[])
      setAccounts(accs as Account[])
      setCategories(cats)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }, [filters, searchText, selectedAccount, selectedBank, selectedCategory, dateFrom, dateTo, amountMin, amountMax])
  
  useEffect(() => {
    loadData()
  }, [loadData])
  
  const handleCategoryChange = async (transactionId: string, category: string) => {
    await updateTransactionCategory(transactionId, category)
    loadData()
  }
  
  const handleDelete = async (transactionId: string) => {
    if (confirm('Naozaj chcete vymazať túto transakciu?')) {
      await deleteTransaction(transactionId)
      loadData()
    }
  }
  
  const clearFilters = () => {
    setSearchText("")
    setSelectedAccount("")
    setSelectedBank("")
    setSelectedCategory("")
    setDateFrom("")
    setDateTo("")
    setAmountMin("")
    setAmountMax("")
    setFilters({ showInternalTransfers: true })
  }
  
  const uniqueBanks = Array.from(new Set(accounts.map(a => a.bankName)))
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Všetky transakcie</h1>
          <p className="text-muted-foreground">
            Prehľad transakcií zo všetkých účtov
          </p>
        </div>
        
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filtre
        </Button>
      </div>
      
      {/* Filter Panel */}
      {showFilters && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Filtre</CardTitle>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Vyčistiť
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Search */}
              <div className="space-y-2">
                <Label>Vyhľadávanie</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Hľadať v popise..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              
              {/* Bank */}
              <div className="space-y-2">
                <Label>Banka</Label>
                <Select value={selectedBank} onValueChange={setSelectedBank}>
                  <SelectTrigger>
                    <SelectValue placeholder="Všetky banky" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Všetky banky</SelectItem>
                    {uniqueBanks.map((bank) => (
                      <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Account */}
              <div className="space-y-2">
                <Label>Účet</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Všetky účty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Všetky účty</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.bankName} - {account.accountNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Category */}
              <div className="space-y-2">
                <Label>Kategória</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Všetky kategórie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Všetky kategórie</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Date From */}
              <div className="space-y-2">
                <Label>Dátum od</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              
              {/* Date To */}
              <div className="space-y-2">
                <Label>Dátum do</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              
              {/* Amount Min */}
              <div className="space-y-2">
                <Label>Suma od</Label>
                <Input
                  type="number"
                  placeholder="Min"
                  value={amountMin}
                  onChange={(e) => setAmountMin(e.target.value)}
                />
              </div>
              
              {/* Amount Max */}
              <div className="space-y-2">
                <Label>Suma do</Label>
                <Input
                  type="number"
                  placeholder="Max"
                  value={amountMax}
                  onChange={(e) => setAmountMax(e.target.value)}
                />
              </div>
            </div>
            
            {/* Internal transfers toggle */}
            <div className="mt-4 flex items-center gap-2">
              <input
                type="checkbox"
                id="showTransfers"
                checked={filters.showInternalTransfers}
                onChange={(e) => setFilters({ ...filters, showInternalTransfers: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="showTransfers">Zobrazovať interné prevody</Label>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transakcie ({transactions.length})</CardTitle>
          <CardDescription>
            Kliknutím na kategóriu ju môžete zmeniť
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Žiadne transakcie</p>
              <p className="text-sm">Importujte súbor alebo prepojte banku</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Dátum</TableHead>
                    <TableHead>Banka</TableHead>
                    <TableHead>Protistrana</TableHead>
                    <TableHead>Popis</TableHead>
                    <TableHead>Kategória</TableHead>
                    <TableHead className="text-right">Suma</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow 
                      key={tx.id}
                      className={tx.isInternalTransfer ? 'bg-blue-50/50' : ''}
                    >
                      <TableCell className="font-mono text-sm">
                        {formatDate(tx.date)}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{tx.account.bankName}</span>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {tx.counterparty || '-'}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate text-muted-foreground">
                        {tx.description || '-'}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={tx.category || ''}
                          onValueChange={(val) => handleCategoryChange(tx.id, val)}
                        >
                          <SelectTrigger className="w-[140px] h-8">
                            <SelectValue placeholder="Kategória" />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {tx.isInternalTransfer && (
                            <Badge variant="transfer" className="text-xs">
                              Prevod
                            </Badge>
                          )}
                          <span className={`font-mono font-medium ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount, tx.currency)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(tx.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
