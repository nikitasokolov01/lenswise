"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuthContext } from "@/lib/auth/guards";
import { CURRENT_CHANGELOG_RELEASE_ID } from "@/lib/changelog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface ChangelogActionState {
  ok?: boolean;
  error?: string;
}

const releaseSchema = z.literal(CURRENT_CHANGELOG_RELEASE_ID);

export async function dismissWhatsNewAction(
  _previous: ChangelogActionState,
  formData: FormData
): Promise<ChangelogActionState> {
  const ctx = await requireAuthContext();
  const releaseId = releaseSchema.safeParse(formData.get("releaseId"));
  if (!releaseId.success) return { error: "This update notice is no longer current." };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("user_changelog_reads").insert({
    user_id: ctx.user.id,
    release_id: releaseId.data,
  });

  if (error && error.code !== "23505") {
    return { error: "The notice could not be dismissed. Please try again." };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

