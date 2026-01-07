import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchTransactions } from "@/lib/enable-banking/client";
import { categorize } from "@/lib/categorize";
import { transactionDeterministicId } from "@/lib/importers/hash";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as null | { connection_id?: string };
  if (!body?.connection_id) {
    return NextResponse.json({ ok: false, error: "Missing connection_id." }, { status: 400 });
  }

  const conn = await prisma.bankConnection.findUnique({ where: { id: body.connection_id } });
  if (!conn) {
    return NextResponse.json({ ok: false, error: "Connection not found." }, { status: 404 });
  }

  const txs = await fetchTransactions({ session_id: conn.session_id });

  // PoC: store all synced transactions into a single account per connection.
  const account = await prisma.account.upsert({
    where: {
      bank_name_account_number_owner_name: {
        bank_name: conn.institution_name ?? "EnableBanking",
        account_number: conn.session_id,
        owner_name: "Family",
      },
    },
    create: {
      bank_name: conn.institution_name ?? "EnableBanking",
      account_number: conn.session_id,
      owner_name: "Family",
      type: "checking",
    },
    update: {},
  });

  const data = txs.map((tx) => {
    const category = tx.category ?? categorize(tx.description);
    const txWithCategory = { ...tx, category };
    const id = transactionDeterministicId({ accountId: account.id, tx: txWithCategory });
    return {
      id,
      account_id: account.id,
      date: txWithCategory.date,
      amount: txWithCategory.amount,
      currency: txWithCategory.currency.toUpperCase(),
      counterparty: txWithCategory.counterparty ?? null,
      description: txWithCategory.description ?? null,
      category: txWithCategory.category ?? null,
      variable_symbol: txWithCategory.variable_symbol ?? null,
      is_internal_transfer: false,
      internal_transfer_pair_id: null,
    };
  });

  let createdCount = 0;
  for (const row of data) {
    try {
      await prisma.transaction.create({ data: row });
      createdCount += 1;
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  await prisma.bankConnection.update({ where: { id: conn.id }, data: { status: "active" } });

  return NextResponse.json({
    ok: true,
    connection: { id: conn.id, session_id: conn.session_id, status: "active" },
    account,
    stats: { parsed: txs.length, created: createdCount, skipped: data.length - createdCount },
  });
}

