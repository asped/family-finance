import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function asString(v: string | string[] | undefined): string {
  if (!v) return "";
  return Array.isArray(v) ? v[0] ?? "" : v;
}

export default async function TransactionsPage(props: { searchParams: Promise<SearchParams> }) {
  const sp = await props.searchParams;
  const accountId = asString(sp.accountId);
  const bank = asString(sp.bank);
  const q = asString(sp.q);
  const category = asString(sp.category);
  const dateFrom = asString(sp.dateFrom);
  const dateTo = asString(sp.dateTo);
  const amountMin = asString(sp.amountMin);
  const amountMax = asString(sp.amountMax);

  const accounts = await prisma.account.findMany({ orderBy: [{ bank_name: "asc" }, { account_number: "asc" }] });
  const banks = Array.from(new Set(accounts.map((a) => a.bank_name))).sort((a, b) => a.localeCompare(b));

  const where: Prisma.TransactionWhereInput = {
    ...(accountId ? { account_id: accountId } : {}),
    ...(bank ? { account: { bank_name: bank } } : {}),
    ...(category ? { category: { contains: category } } : {}),
    ...(q
      ? {
          OR: [
            { description: { contains: q } },
            { counterparty: { contains: q } },
            { variable_symbol: { contains: q } },
          ],
        }
      : {}),
    ...(dateFrom || dateTo
      ? {
          date: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
    ...(amountMin || amountMax
      ? {
          amount: {
            ...(amountMin ? { gte: amountMin } : {}),
            ...(amountMax ? { lte: amountMax } : {}),
          },
        }
      : {}),
  };

  const txs = await prisma.transaction.findMany({
    where,
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: 500,
    include: { account: true },
  });

  return (
    <div className="container mx-auto max-w-5xl space-y-6 py-8">
      <h1 className="text-2xl font-semibold">Všetky transakcie</h1>

      <Card>
        <CardHeader>
          <CardTitle>Filtre</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-3" action="/transactions" method="get">
            <div className="space-y-2">
              <Label htmlFor="bank">Banka</Label>
              <select
                id="bank"
                name="bank"
                defaultValue={bank}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">(všetky)</option>
                {banks.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountId">Účet</Label>
              <select
                id="accountId"
                name="accountId"
                defaultValue={accountId}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">(všetky)</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.bank_name} • {a.account_number} • {a.owner_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="q">Text (popis/protistrana/VS)</Label>
              <Input id="q" name="q" defaultValue={q} placeholder="TESCO / SHELL / ..." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Kategória</Label>
              <Input id="category" name="category" defaultValue={category} placeholder="Groceries / Fuel / ..." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateFrom">Dátum od</Label>
              <Input id="dateFrom" name="dateFrom" type="date" defaultValue={dateFrom} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo">Dátum do</Label>
              <Input id="dateTo" name="dateTo" type="date" defaultValue={dateTo} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amountMin">Suma min</Label>
              <Input id="amountMin" name="amountMin" defaultValue={amountMin} placeholder="-100.00" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amountMax">Suma max</Label>
              <Input id="amountMax" name="amountMax" defaultValue={amountMax} placeholder="100.00" />
            </div>

            <div className="flex items-end gap-2">
              <Button type="submit">Použiť</Button>
              <Button type="submit" variant="secondary" formAction="/transactions">
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Výsledky (max 500)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dátum</TableHead>
                <TableHead>Účet</TableHead>
                <TableHead>Popis</TableHead>
                <TableHead>Protistrana</TableHead>
                <TableHead>Kategória</TableHead>
                <TableHead className="text-right">Suma</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txs.map((t) => {
                const amt = Number(String(t.amount));
                const isIncome = amt > 0;
                return (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap">{t.date.toISOString().slice(0, 10)}</TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium">{t.account.bank_name}</div>
                      <div className="text-muted-foreground">{t.account.account_number}</div>
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate">{t.description ?? ""}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{t.counterparty ?? ""}</TableCell>
                    <TableCell className="max-w-[160px] truncate">{t.category ?? ""}</TableCell>
                    <TableCell
                      className={`text-right font-medium ${isIncome ? "text-emerald-600" : amt < 0 ? "text-red-600" : ""}`}
                    >
                      {String(t.amount)} {t.currency}
                    </TableCell>
                  </TableRow>
                );
              })}
              {txs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground">
                    Žiadne transakcie pre dané filtre.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

