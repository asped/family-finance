import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const connections = await prisma.bankConnection.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ ok: true, connections });
}

export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => null)) as null | { id?: string };
  if (!body?.id) return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });
  await prisma.bankConnection.delete({ where: { id: body.id } });
  return NextResponse.json({ ok: true });
}

