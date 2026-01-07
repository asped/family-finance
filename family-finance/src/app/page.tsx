import { Suspense } from "react"
import { getFinancialSummary } from "@/actions/transactions"
import { getAccounts } from "@/actions/accounts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowLeftRight,
  Wallet,
  PiggyBank,
  CreditCard
} from "lucide-react"

async function DashboardContent() {
  const [summary, accounts] = await Promise.all([
    getFinancialSummary(),
    getAccounts()
  ])
  
  return (
    <div className="space-y-8">
      {/* Hlavné metriky */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Celkový Rodinný Príjem
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.incomeWithoutTransfers)}
            </div>
            <p className="text-xs text-muted-foreground">
              Bez interných prevodov
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Celkový Rodinný Výdavok
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(summary.expenseWithoutTransfers)}
            </div>
            <p className="text-xs text-muted-foreground">
              Bez interných prevodov
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Čistý Cash-flow
            </CardTitle>
            <ArrowLeftRight className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.netCashFlowWithoutTransfers >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.netCashFlowWithoutTransfers)}
            </div>
            <p className="text-xs text-muted-foreground">
              Príjem - Výdavok
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Prepojené účty */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Prepojené účty
          </CardTitle>
          <CardDescription>
            Prehľad všetkých bankových účtov a platforiem
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Zatiaľ nemáte žiadne prepojené účty</p>
              <p className="text-sm">Začnite importom transakcií alebo prepojením banky cez Enable Banking</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center gap-4 p-4 border rounded-lg"
                >
                  <div className="p-2 bg-primary/10 rounded-full">
                    {account.type === 'INVESTMENT' ? (
                      <PiggyBank className="h-5 w-5 text-primary" />
                    ) : (
                      <CreditCard className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{account.bankName}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {account.accountNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {account._count.transactions} transakcií
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Výdavky podľa kategórií */}
      {summary.byCategory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Výdavky podľa kategórií</CardTitle>
            <CardDescription>
              Prehľad výdavkov za všetky účty
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary.byCategory
                .filter(cat => cat.expense > 0)
                .slice(0, 10)
                .map((cat) => {
                  const total = summary.expenseWithoutTransfers || 1
                  const percentage = (cat.expense / total) * 100
                  
                  return (
                    <div key={cat.category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{cat.category}</span>
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(cat.expense)} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Mesačný prehľad */}
      {summary.byMonth.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Mesačný prehľad</CardTitle>
            <CardDescription>
              Cash-flow za posledné mesiace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary.byMonth.slice(-6).map((month) => (
                <div key={month.month} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="font-medium">{month.month}</span>
                  <div className="flex gap-6 text-sm">
                    <span className="text-green-600">+{formatCurrency(month.income)}</span>
                    <span className="text-red-600">-{formatCurrency(month.expense)}</span>
                    <span className={month.netCashFlow >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                      {formatCurrency(month.netCashFlow)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Prehľad rodinných financií
        </p>
      </div>
      
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
