"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Account = {
  id: string;
  bank_name: string;
  account_number: string;
  owner_name: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function ImportClient(props: { accounts: Account[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [accountId, setAccountId] = useState<string>("");
  const [result, setResult] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setResult(null);
    if (!file) return;

    const fd = new FormData();
    fd.set("file", file);
    if (accountId) fd.set("accountId", accountId);

    const res = await fetch("/api/import/manual", { method: "POST", body: fd });
    const json: unknown = await res.json().catch(() => ({}));
    if (!res.ok || !isRecord(json) || json.ok !== true) {
      setError((isRecord(json) ? (json.error as string | undefined) : undefined) ?? "Import failed.");
      return;
    }
    setResult(json);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Manual Importer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accountId">Cieľový účet (voliteľné)</Label>
            <select
              id="accountId"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">(nechať auto)</option>
              {props.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.bank_name} • {a.account_number} • {a.owner_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="file">Súbor (CSV/XLSX/XML/ABO)</Label>
            <Input id="file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <Button onClick={submit} disabled={pending || !file}>
            Importovať
          </Button>
          {error ? <div className="text-sm text-red-600">{error}</div> : null}
          {result ? (
            <pre className="overflow-auto rounded-md border bg-muted p-3 text-xs">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

