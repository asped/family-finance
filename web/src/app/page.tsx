import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { recomputeInternalTransfers } from "./actions";
import { Prisma } from "@prisma/client";

export default async function Home() {
  const incomeAgg = await prisma.transaction.aggregate({
    where: { is_internal_transfer: false, amount: { gt: "0" } },
    _sum: { amount: true },
  });
  const expenseAgg = await prisma.transaction.aggregate({
    where: { is_internal_transfer: false, amount: { lt: "0" } },
    _sum: { amount: true },
  });
  const income = incomeAgg._sum.amount ?? new Prisma.Decimal(0);
  const expense = expenseAgg._sum.amount ?? new Prisma.Decimal(0);
  const net = income.add(expense);

  const totalCount = await prisma.transaction.count();
  const internalCount = await prisma.transaction.count({ where: { is_internal_transfer: true } });

  return (
    <div className="container mx-auto max-w-5xl space-y-6 py-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Celkový príjem</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-emerald-600">{income.toString()}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Celkový výdavok</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-red-600">{expense.toString()}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Čistý cash-flow</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{net.toString()}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Interné prevody (alpha)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Interné označené: <span className="font-medium text-foreground">{internalCount}</span> /{" "}
            <span className="font-medium text-foreground">{totalCount}</span>
          </div>
          <form action={recomputeInternalTransfers}>
            <Button type="submit" variant="secondary">
              Prepočítať interné prevody
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
