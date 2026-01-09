"use client"

import { useEffect, useState, useCallback } from "react"
import { getTransactions, getCategories, updateTransactionCategory, deleteTransaction, SortField, SortOrder } from "@/actions/transactions"
import { getAccounts } from "@/actions/accounts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, formatDate, CATEGORIES } from "@/lib/utils"
import { Search, Filter, Trash2, ArrowUpDown, ArrowUp, ArrowDown, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
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

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200]

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  
  // Pagination state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  
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
      
      const [result, accs, cats] = await Promise.all([
        getTransactions(appliedFilters, page, pageSize, sortField, sortOrder),
        getAccounts(),
        getCategories()
      ])
      
      setTransactions(result.transactions as Transaction[])
      setTotal(result.total)
      setTotalPages(result.totalPages)
      setAccounts(accs as Account[])
      setCategories(cats)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }, [filters, searchText, selectedAccount, selectedBank, selectedCategory, dateFrom, dateTo, amountMin, amountMax, page, pageSize, sortField, sortOrder])
  
  useEffect(() => {
    loadData()
  }, [loadData])
  
  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [searchText, selectedAccount, selectedBank, selectedCategory, dateFrom, dateTo, amountMin, amountMax, filters])
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
    setPage(1)
  }
  
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />
    }
    return sortOrder === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />
  }
  
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
    setPage(1)
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transakcie ({total.toLocaleString()})</CardTitle>
              <CardDescription>
                Strana {page} z {totalPages} • Kliknutím na hlavičku zoraďte
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Na stránku:</Label>
              <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(parseInt(v)); setPage(1); }}>
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead 
                        className="w-[100px] cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('date')}
                      >
                        <div className="flex items-center">
                          Dátum
                          <SortIcon field="date" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('bankName')}
                      >
                        <div className="flex items-center">
                          Banka
                          <SortIcon field="bankName" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('counterparty')}
                      >
                        <div className="flex items-center">
                          Protistrana
                          <SortIcon field="counterparty" />
                        </div>
                      </TableHead>
                      <TableHead>Popis</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('category')}
                      >
                        <div className="flex items-center">
                          Kategória
                          <SortIcon field="category" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="text-right cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('amount')}
                      >
                        <div className="flex items-center justify-end">
                          Suma
                          <SortIcon field="amount" />
                        </div>
                      </TableHead>
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
              
              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Zobrazené {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} z {total.toLocaleString()}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <div className="flex items-center gap-1 mx-2">
                    <Input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={page}
                      onChange={(e) => {
                        const p = parseInt(e.target.value)
                        if (p >= 1 && p <= totalPages) {
                          setPage(p)
                        }
                      }}
                      className="w-16 text-center"
                    />
                    <span className="text-sm text-muted-foreground">/ {totalPages}</span>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
