import { prisma } from "@/lib/prisma";
import { ConnectionsClient } from "./ConnectionsClient";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const connections = await prisma.bankConnection.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="container mx-auto max-w-5xl space-y-6 py-8">
      <h1 className="text-2xl font-semibold">Bankové prepojenia</h1>
      <ConnectionsClient
        initial={connections.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}

