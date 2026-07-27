"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Building2, MapPin, Plus } from "lucide-react";
import {
  createOrganizationLocationAction,
  updateOrganizationLocationAction,
  type LocationActionState,
} from "@/app/(app)/organization/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OrganizationLocation } from "@/lib/locations/types";

const EMPTY_STATE: LocationActionState = {};

export function LocationManager({
  locations,
  canEdit,
}: {
  locations: OrganizationLocation[];
  canEdit: boolean;
}) {
  return (
    <section className="rounded-2xl border border-navy-100 bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-navy-900">Locations</h3>
          <p className="mt-1 text-sm text-navy-500">
            Each location has its own frame quantities and low-stock alerts.
            Pricing and catalog access stay shared across the company.
          </p>
        </div>
        <Badge variant="teal">
          {locations.length} {locations.length === 1 ? "location" : "locations"}
        </Badge>
      </div>

      <div className="mt-4 space-y-4">
        {locations.map((location) => (
          <LocationCard key={location.id} location={location} canEdit={canEdit} />
        ))}
      </div>

      {canEdit ? (
        <details className="group mt-5 rounded-lg border border-dashed border-teal-300 bg-teal-50/40">
          <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold text-teal-800">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add another location
          </summary>
          <div className="border-t border-teal-200 p-4">
            <CreateLocationForm />
          </div>
        </details>
      ) : null}
    </section>
  );
}

function LocationCard({
  location,
  canEdit,
}: {
  location: OrganizationLocation;
  canEdit: boolean;
}) {
  if (!canEdit) {
    return (
      <div className="rounded-lg border border-navy-100 bg-navy-50/30 p-4">
        <LocationHeading location={location} />
        <LocationDetails location={location} />
      </div>
    );
  }

  return (
    <details className="group rounded-lg border border-navy-100 bg-navy-50/30">
      <summary className="cursor-pointer list-none p-4">
        <LocationHeading location={location} />
        <LocationDetails location={location} />
        <p className="mt-3 text-xs font-semibold text-teal-700 group-open:hidden">
          Select to edit
        </p>
      </summary>
      <div className="border-t border-navy-100 bg-white p-4">
        <UpdateLocationForm location={location} />
      </div>
    </details>
  );
}

function LocationHeading({ location }: { location: OrganizationLocation }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Building2 className="h-4 w-4 text-teal-700" aria-hidden="true" />
      <h4 className="font-semibold text-navy-900">{location.name}</h4>
      {location.isPrimary ? <Badge variant="outline">Primary</Badge> : null}
    </div>
  );
}

function LocationDetails({ location }: { location: OrganizationLocation }) {
  return (
    <div className="mt-2 space-y-1 text-sm text-navy-500">
      <p className="flex items-start gap-2">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{location.contactAddress || "No address entered"}</span>
      </p>
      {location.contactPhone || location.contactEmail ? (
        <p>{[location.contactPhone, location.contactEmail].filter(Boolean).join(" · ")}</p>
      ) : null}
    </div>
  );
}

function CreateLocationForm() {
  const [state, formAction] = useFormState(
    createOrganizationLocationAction,
    EMPTY_STATE
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <LocationFields idPrefix="new-location" />
      <ActionFeedback state={state} />
      <LocationSubmitButton label="Add location" />
    </form>
  );
}

function UpdateLocationForm({ location }: { location: OrganizationLocation }) {
  const [state, formAction] = useFormState(
    updateOrganizationLocationAction,
    EMPTY_STATE
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locationId" value={location.id} />
      <LocationFields idPrefix={location.id} location={location} />
      <ActionFeedback state={state} />
      <LocationSubmitButton label="Save location" />
    </form>
  );
}

function LocationFields({
  idPrefix,
  location,
}: {
  idPrefix: string;
  location?: OrganizationLocation;
}) {
  return (
    <>
      <div>
        <Label htmlFor={`${idPrefix}-name`}>Location name</Label>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          defaultValue={location?.name}
          placeholder="Downtown office"
          maxLength={120}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${idPrefix}-email`}>Contact email</Label>
          <Input
            id={`${idPrefix}-email`}
            name="contactEmail"
            type="email"
            defaultValue={location?.contactEmail ?? ""}
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-phone`}>Contact phone</Label>
          <Input
            id={`${idPrefix}-phone`}
            name="contactPhone"
            defaultValue={location?.contactPhone ?? ""}
            maxLength={40}
          />
        </div>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-address`}>Address</Label>
        <Textarea
          id={`${idPrefix}-address`}
          name="contactAddress"
          rows={3}
          defaultValue={location?.contactAddress ?? ""}
          maxLength={400}
        />
      </div>
    </>
  );
}

function ActionFeedback({ state }: { state: LocationActionState }) {
  if (state.error) {
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {state.error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
        {state.message}
      </p>
    );
  }
  return null;
}

function LocationSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}
