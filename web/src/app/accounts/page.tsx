import { prisma } from "@/lib/prisma";
import { createAccount } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  type AccountRow = Prisma.AccountGetPayload<{
    include: { _count: { select: { transactions: true } } };
  }>;

  const accounts: AccountRow[] = await prisma.account.findMany({
    orderBy: [{ bank_name: "asc" }, { owner_name: "asc" }, { account_number: "asc" }],
    include: { _count: { select: { transactions: true } } },
  });

  return (
    <div className="container mx-auto max-w-5xl space-y-6 py-8">
      <h1 className="text-2xl font-semibold">Účty</h1>

      <Card>
        <CardHeader>
          <CardTitle>Pridať účet</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAccount} className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="bank_name">Banka</Label>
              <Input id="bank_name" name="bank_name" placeholder="mBank / SLSP / Revolut / Patria / Portu" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account_number">Číslo účtu</Label>
              <Input id="account_number" name="account_number" placeholder="IBAN alebo interný identifikátor" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner_name">Majiteľ</Label>
              <Input id="owner_name" name="owner_name" placeholder="Manžel / Manželka / Spoločný" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Typ</Label>
              <select
                id="type"
                name="type"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue="checking"
              >
                <option value="checking">checking</option>
                <option value="investment">investment</option>
                <option value="savings">savings</option>
              </select>
            </div>
            <div className="md:col-span-4">
              <Button type="submit">Vytvoriť</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existujúce účty</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Banka</TableHead>
                <TableHead>Účet</TableHead>
                <TableHead>Majiteľ</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead className="text-right">Transakcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.bank_name}</TableCell>
                  <TableCell className="font-mono text-xs">{a.account_number}</TableCell>
                  <TableCell>{a.owner_name}</TableCell>
                  <TableCell className="text-xs">{a.type}</TableCell>
                  <TableCell className="text-right">{a._count.transactions}</TableCell>
                </TableRow>
              ))}
              {accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    Zatiaľ žiadne účty.
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

