import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuthSession } from "@/lib/enable-banking/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as null | {
    institution_id?: string;
    institution_name?: string;
    redirect_url?: string;
  };

  if (!body?.institution_id || !body?.redirect_url) {
    return NextResponse.json(
      { ok: false, error: "Missing institution_id or redirect_url." },
      { status: 400 }
    );
  }

  const auth = await createAuthSession({
    institution_id: body.institution_id,
    redirect_url: body.redirect_url,
  });

  const conn = await prisma.bankConnection.create({
    data: {
      session_id: auth.session_id,
      status: "created",
      institution_id: body.institution_id,
      institution_name: body.institution_name ?? null,
    },
  });

  return NextResponse.json({
    ok: true,
    connection: conn,
    auth_url: auth.auth_url ?? null,
  });
}

