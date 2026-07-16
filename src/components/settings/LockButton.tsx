"use client";

import { Lock } from "lucide-react";
import { lockSettingsAction } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";

/** Immediately clears the Office-PIN unlock session and re-locks protected settings. */
export function LockButton() {
  return (
    <form action={lockSettingsAction}>
      <Button type="submit" variant="secondary" size="sm">
        <Lock className="h-4 w-4" aria-hidden="true" />
        Lock Protected Settings
      </Button>
    </form>
  );
}
