"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Connection = {
  id: string;
  provider: "ENABLE_BANKING";
  status: "created" | "active" | "expired" | "error";
  session_id: string;
  institution_id: string | null;
  institution_name: string | null;
  createdAt: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function ConnectionsClient(props: { initial: Connection[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [institutionId, setInstitutionId] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [lastAuthUrl, setLastAuthUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const defaultRedirect = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/connections`;
  }, []);

  async function createConnection() {
    setError(null);
    setLastAuthUrl(null);
    const res = await fetch("/api/enable-banking/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        institution_id: institutionId,
        institution_name: institutionName || undefined,
        redirect_url: redirectUrl || defaultRedirect,
      }),
    });
    const json: unknown = await res.json().catch(() => ({}));
    if (!res.ok || !isRecord(json) || json.ok !== true) {
      setError((isRecord(json) ? (json.error as string | undefined) : undefined) ?? "Failed to create connection.");
      return;
    }
    setLastAuthUrl((json.auth_url as string | null | undefined) ?? null);
    startTransition(() => router.refresh());
  }

  async function syncConnection(id: string) {
    setError(null);
    const res = await fetch("/api/enable-banking/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connection_id: id }),
    });
    const json: unknown = await res.json().catch(() => ({}));
    if (!res.ok || !isRecord(json) || json.ok !== true) {
      setError((isRecord(json) ? (json.error as string | undefined) : undefined) ?? "Sync failed.");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function deleteConnection(id: string) {
    setError(null);
    const res = await fetch("/api/enable-banking/connections", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json: unknown = await res.json().catch(() => ({}));
    if (!res.ok || !isRecord(json) || json.ok !== true) {
      setError((isRecord(json) ? (json.error as string | undefined) : undefined) ?? "Delete failed.");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Enable Banking – prepojenia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="institutionId">Institution ID</Label>
              <Input
                id="institutionId"
                value={institutionId}
                onChange={(e) => setInstitutionId(e.target.value)}
                placeholder="napr. slsp_sk / mbank_sk (podľa EB)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="institutionName">Názov (voliteľné)</Label>
              <Input
                id="institutionName"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                placeholder="SLSP"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="redirectUrl">Redirect URL</Label>
              <Input
                id="redirectUrl"
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
                placeholder={defaultRedirect || "http://localhost:3000/connections"}
              />
            </div>
          </div>
          <Button onClick={createConnection} disabled={pending || !institutionId}>
            Vytvoriť prepojenie
          </Button>

          {lastAuthUrl ? (
            <div className="text-sm">
              Auth URL:{" "}
              <a className="underline" href={lastAuthUrl} target="_blank" rel="noreferrer">
                {lastAuthUrl}
              </a>
            </div>
          ) : null}
          {error ? <div className="text-sm text-red-600">{error}</div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aktívne / vytvorené prepojenia</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inštitúcia</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.initial.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{c.institution_name ?? "(bez názvu)"}</div>
                    <div className="text-xs text-muted-foreground">{c.institution_id ?? ""}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{c.session_id}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="secondary" onClick={() => syncConnection(c.id)} disabled={pending}>
                      Sync
                    </Button>
                    <Button variant="destructive" onClick={() => deleteConnection(c.id)} disabled={pending}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {props.initial.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">
                    Zatiaľ žiadne prepojenia.
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

