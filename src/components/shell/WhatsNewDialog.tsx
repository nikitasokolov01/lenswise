"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { CheckCircle2, MapPin, PackageOpen, Ruler, Sparkles } from "lucide-react";
import {
  dismissWhatsNewAction,
  type ChangelogActionState,
} from "@/app/(app)/changelog/actions";
import {
  CURRENT_CHANGELOG,
  CURRENT_CHANGELOG_RELEASE_ID,
} from "@/lib/changelog";
import { Button } from "@/components/ui/button";

const EMPTY_STATE: ChangelogActionState = {};
const ICONS = [Sparkles, Ruler, PackageOpen, MapPin, CheckCircle2] as const;

function DismissButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" className="w-full sm:w-auto" disabled={pending}>
      {pending ? "Saving…" : "Got it — let’s go"}
    </Button>
  );
}

export function WhatsNewDialog({ initiallyOpen }: { initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [state, formAction] = useFormState(dismissWhatsNewAction, EMPTY_STATE);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

  if (!open) return null;

  return (
    <div className="no-print fixed inset-0 z-[80] flex items-center justify-center bg-navy-950/60 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-navy-100 bg-white shadow-lifted"
      >
        <div className="bg-gradient-to-br from-navy-950 via-navy-900 to-teal-800 px-6 py-6 text-white sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">
            {CURRENT_CHANGELOG.eyebrow}
          </p>
          <h2 id="whats-new-title" className="mt-2 text-2xl font-bold sm:text-3xl">
            {CURRENT_CHANGELOG.title}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-navy-100">
            {CURRENT_CHANGELOG.summary}
          </p>
        </div>

        <div className="px-6 py-6 sm:px-8">
          <div className="space-y-4">
            {CURRENT_CHANGELOG.highlights.map((highlight, index) => {
              const Icon = ICONS[index];
              return (
                <div key={highlight.title} className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-navy-950">{highlight.title}</h3>
                    <p className="mt-0.5 text-sm leading-5 text-navy-500">{highlight.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <form action={formAction} className="mt-6 flex flex-col items-stretch justify-between gap-3 border-t border-navy-100 pt-5 sm:flex-row sm:items-center">
            <input
              type="hidden"
              name="releaseId"
              value={CURRENT_CHANGELOG_RELEASE_ID}
            />
            <p className="text-xs text-navy-400">You’ll only see this update once.</p>
            <DismissButton />
          </form>
          {state.error ? (
            <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
