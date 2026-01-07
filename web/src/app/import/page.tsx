import { prisma } from "@/lib/prisma";
import { ImportClient } from "./ImportClient";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const accounts = await prisma.account.findMany({
    orderBy: [{ bank_name: "asc" }, { account_number: "asc" }],
    select: { id: true, bank_name: true, account_number: true, owner_name: true },
  });

  return (
    <div className="container mx-auto max-w-5xl space-y-6 py-8">
      <h1 className="text-2xl font-semibold">Import</h1>
      <ImportClient accounts={accounts} />
    </div>
  );
}

