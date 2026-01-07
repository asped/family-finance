"use server";

import { revalidatePath } from "next/cache";
import { detectInternalTransfersAlpha, resetInternalTransferFlags } from "@/lib/internal-transfer-detection";

export async function recomputeInternalTransfers() {
  await resetInternalTransferFlags();
  await detectInternalTransfersAlpha();
  revalidatePath("/");
  revalidatePath("/transactions");
}

