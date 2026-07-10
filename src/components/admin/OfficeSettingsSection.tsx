"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function OfficeSettingsSection({
  officeName,
  disclaimerText,
  onChangeOfficeName,
  onChangeDisclaimerText,
}: {
  officeName: string;
  disclaimerText: string;
  onChangeOfficeName: (value: string) => void;
  onChangeDisclaimerText: (value: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Office Settings</CardTitle>
        <CardDescription>Displayed on the quote summary, Patient View, and printed quotes.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="office-name">Office display name</Label>
          <Input id="office-name" value={officeName} onChange={(e) => onChangeOfficeName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="disclaimer-text">Disclaimer text</Label>
          <Textarea
            id="disclaimer-text"
            rows={3}
            value={disclaimerText}
            onChange={(e) => onChangeDisclaimerText(e.target.value)}
          />
          <p className="mt-1 text-xs text-navy-400">
            Shown at the bottom of the quote summary, Patient View, and printed quotes.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
