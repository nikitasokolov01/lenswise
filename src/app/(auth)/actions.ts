"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createDefaultConfiguration, SCHEMA_VERSION } from "@/lib/pricing/seedConfiguration";

export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const registerSchema = z
  .object({
    registrationKey: z.string().trim().min(1, "Registration key is required."),
    officeName: z.string().trim().min(1, "Office name is required."),
    fullName: z.string().trim().min(1, "Your name is required."),
    email: z.string().trim().email("Enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

function mapRegistrationError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid_registration_key")) return "That registration key is not valid.";
  if (m.includes("registration_key_revoked")) return "That registration key has been revoked.";
  if (m.includes("registration_key_expired")) return "That registration key has expired.";
  if (m.includes("registration_key_used_up")) return "That registration key has already been used.";
  if (m.includes("already been registered") || m.includes("already registered") || m.includes("user already"))
    return "An account with this email already exists. Try signing in instead.";
  return "Registration failed. Please check your details and try again.";
}

/**
 * Atomic organization registration:
 *  1. validate the form,
 *  2. create the Supabase Auth user (service role),
 *  3. redeem the registration key + create org/settings/owner/default pricing
 *     via the atomic DB function,
 *  4. on any failure after the user is created, DELETE the incomplete auth
 *     user (rollback),
 *  5. sign the owner in and redirect into the app.
 * The service-role key is used only here, on the server.
 */
export async function registerOrganizationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    registrationKey: formData.get("registrationKey"),
    officeName: formData.get("officeName"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const { registrationKey, officeName, fullName, email, password } = parsed.data;
  const admin = createSupabaseAdminClient();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createErr || !created?.user) {
    return { error: mapRegistrationError(createErr?.message ?? "could not create account") };
  }

  const userId = created.user.id;
  const { error: rpcErr } = await admin.rpc("redeem_key_and_create_org", {
    p_user_id: userId,
    p_key: registrationKey,
    p_org_name: officeName,
    p_default_pricing: createDefaultConfiguration(),
    p_schema_version: SCHEMA_VERSION,
  });

  if (rpcErr) {
    // Roll back the incomplete auth user so registration is all-or-nothing.
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    return { error: mapRegistrationError(rpcErr.message) };
  }

  // Establish the session (writes the SSR auth cookies).
  const supabase = createSupabaseServerClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signInErr) {
    return { error: "Your organization was created, but automatic sign-in failed. Please sign in." };
  }

  redirect("/");
}

export async function signOutAction(): Promise<void> {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
