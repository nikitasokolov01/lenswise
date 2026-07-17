"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createDefaultConfiguration, SCHEMA_VERSION } from "@/lib/pricing/seedConfiguration";
import { createOnboardingCheckout } from "@/lib/stripe/onboarding";

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

  redirect("/app");
}

const startTrialSchema = z
  .object({
    practiceName: z.string().trim().min(1, "Practice name is required."),
    ownerName: z.string().trim().min(1, "Your name is required."),
    email: z.string().trim().email("Enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

/**
 * Public self-service onboarding (no registration key):
 *  1. validate the form,
 *  2. create the Supabase Auth user (service role) — but NOT the organization,
 *  3. sign the owner in (so success/cancel/resume have a session),
 *  4. open Stripe Checkout with the org/owner details as metadata.
 * The organization is created by the webhook only after Checkout completes, so a
 * canceled/abandoned Checkout leaves no organization and redeems no trial.
 */
export async function startTrialAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = startTrialSchema.safeParse({
    practiceName: formData.get("practiceName"),
    ownerName: formData.get("ownerName"),
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

  const { practiceName, ownerName, email, password } = parsed.data;
  const admin = createSupabaseAdminClient();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: ownerName, practice_name: practiceName },
  });
  if (createErr || !created?.user) {
    const m = (createErr?.message ?? "").toLowerCase();
    if (m.includes("already") || m.includes("registered")) {
      return { error: "An account with this email already exists. Sign in instead." };
    }
    return { error: "Could not create your account. Please try again." };
  }

  // Establish the session so the success / cancel / resume flows work.
  const supabase = createSupabaseServerClient();
  await supabase.auth.signInWithPassword({ email, password });

  const result = await createOnboardingCheckout({ userId: created.user.id, email, practiceName, ownerName });
  if (result.error || !result.url) {
    return { error: result.error ?? "Could not start checkout. Please try again." };
  }
  redirect(result.url);
}

/**
 * Resume an abandoned Checkout for a signed-in owner who has no organization yet
 * (their account exists, but they closed Checkout before completing it). Uses
 * the practice/owner details stored on their auth account. If they already own
 * an organization, sends them into the app.
 */
export async function resumeCheckoutAction(): Promise<void> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (membership?.organization_id) redirect("/app");

  const meta = (user.user_metadata ?? {}) as { practice_name?: string; full_name?: string };
  const result = await createOnboardingCheckout({
    userId: user.id,
    email: user.email ?? "",
    practiceName: meta.practice_name?.trim() || "My Optical Office",
    ownerName: meta.full_name?.trim() || user.email || "Owner",
  });
  redirect(result.url ?? "/checkout-cancel");
}

export async function signOutAction(): Promise<void> {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
