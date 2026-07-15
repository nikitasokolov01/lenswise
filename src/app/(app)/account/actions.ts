"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { requireAuthContext } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AccountState {
  error?: string;
  ok?: boolean;
  resetSent?: boolean;
}

function requestOrigin(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

export async function updateFullNameAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const ctx = await requireAuthContext();
  const parsed = z.string().trim().min(1, "Enter your name.").max(120).safeParse(formData.get("fullName"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter your name." };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data, updated_at: new Date().toISOString() })
    .eq("id", ctx.user.id);
  if (error) return { error: `Could not save: ${error.message}` };

  revalidatePath("/account");
  return { ok: true };
}

export async function sendPasswordResetAction(_prev: AccountState): Promise<AccountState> {
  const ctx = await requireAuthContext();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(ctx.user.email, {
    redirectTo: `${requestOrigin()}/reset-password`,
  });
  if (error) return { error: "Could not send the reset email. Please try again." };
  return { resetSent: true };
}
