"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createAccount(formData: FormData) {
  const bank_name = String(formData.get("bank_name") ?? "").trim();
  const account_number = String(formData.get("account_number") ?? "").trim();
  const owner_name = String(formData.get("owner_name") ?? "").trim();
  const type = String(formData.get("type") ?? "checking") as "checking" | "investment" | "savings";

  if (!bank_name || !account_number || !owner_name) {
    throw new Error("bank_name, account_number, owner_name are required");
  }

  await prisma.account.create({
    data: { bank_name, account_number, owner_name, type },
  });

  revalidatePath("/accounts");
}

