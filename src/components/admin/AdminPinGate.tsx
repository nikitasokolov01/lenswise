"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldAlert, Lock } from "lucide-react";
import { getDemoAdminPin, isUsingDefaultPin, SESSION_STORAGE_ADMIN_UNLOCK_KEY } from "@/lib/constants";

export function AdminPinGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checkedStorage, setCheckedStorage] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(SESSION_STORAGE_ADMIN_UNLOCK_KEY);
    if (stored === "true") setUnlocked(true);
    setCheckedStorage(true);
  }, []);

  if (!checkedStorage) return null;

  if (unlocked) {
    return <>{children}</>;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pinInput.trim() === getDemoAdminPin()) {
      window.sessionStorage.setItem(SESSION_STORAGE_ADMIN_UNLOCK_KEY, "true");
      setUnlocked(true);
      setError(null);
    } else {
      setError("Incorrect PIN. Try again.");
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <Card>
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-navy-100">
            <Lock className="h-5 w-5 text-navy-700" aria-hidden="true" />
          </div>
          <CardTitle>Admin Pricing</CardTitle>
          <CardDescription>Enter the demonstration admin PIN to edit pricing.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="admin-pin">Admin PIN</Label>
              <Input
                id="admin-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                aria-describedby={error ? "admin-pin-error" : undefined}
                aria-invalid={Boolean(error)}
              />
              {error ? (
                <p id="admin-pin-error" role="alert" className="mt-1.5 text-sm text-red-700">
                  {error}
                </p>
              ) : null}
            </div>
            <Button type="submit" className="w-full">
              Unlock
            </Button>
          </form>

          <div className="mt-5 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            <p className="text-xs text-amber-900">
              This PIN is demonstration-level protection only, stored and checked in the browser. It is not secure
              enough to gate real business or pricing data in production.
              {isUsingDefaultPin()
                ? " No NEXT_PUBLIC_DEMO_ADMIN_PIN environment variable is set, so the default development PIN 1234 is active."
                : null}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
