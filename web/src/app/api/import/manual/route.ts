import { NextResponse } from "next/server";
import { manualImportFromUpload } from "@/lib/importers/manual-import";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  const accountId = (form.get("accountId") as string | null) ?? null;

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Missing file field 'file'." }, { status: 400 });
  }

  const result = await manualImportFromUpload({ file, accountId });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

