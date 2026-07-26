"use client";

import { useEffect, useState, type Dispatch } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SPHERE_OPTIONS,
  CYLINDER_OPTIONS,
  AXIS_OPTIONS,
  ADD_OPTIONS,
  createBlankPrescription,
  isValidPrescription,
  formatPrescriptionSummaryLines,
} from "@/lib/prescriptionOptions";
import { prescriptionDisplayLabel, prescriptionHasAdd, toggledDisplayMode } from "@/lib/prescriptionDisplay";
import { sanitizePupillaryDistanceValue, type PupillaryDistanceField } from "@/lib/pupillaryDistance";
import type { PrescriptionEyeValues, PrescriptionInput, QuoteInput } from "@/lib/types";
import type { QuoteAction } from "@/components/quote/quoteReducer";

interface PrescriptionStepProps {
  input: QuoteInput;
  dispatch: Dispatch<QuoteAction>;
}

/**
 * Required OD/OS prescription entry (sphere, cylinder, axis, add) for
 * Complete Pair and Lens Only orders — not applicable for Frame Only.
 *
 * A prescription is never active as soon as a dropdown changes. It lives in
 * this component's own local `draft` state until "Apply Prescription" is
 * pressed, at which point it is validated and committed to quote state via
 * APPLY_PRESCRIPTION — only then does it unlock lens configuration and feed
 * the calculation engine (see QuoteBuilder.tsx / calculateQuote.ts). Nothing
 * entered here is ever persisted to LocalStorage or sent anywhere.
 */
export function PrescriptionStep({ input, dispatch }: PrescriptionStepProps) {
  const { orderType, prescription, prescriptionDisplayMode } = input;
  const hasAdd = prescriptionHasAdd(prescription);

  const [draft, setDraft] = useState<PrescriptionInput>(() => prescription ?? createBlankPrescription());
  const [isEditing, setIsEditing] = useState(prescription === null);
  const [showValidation, setShowValidation] = useState(false);

  // Whenever the applied prescription is cleared from outside this
  // component (Clear Prescription, or the order type switching to/from
  // Frame Only), return to a fresh entry form instead of showing a stale
  // draft. This never fires from Apply itself, since Apply only ever sets
  // `prescription` to a non-null value.
  useEffect(() => {
    if (prescription === null) {
      setDraft(createBlankPrescription());
      setIsEditing(true);
      setShowValidation(false);
    }
  }, [prescription]);

  if (orderType === "frame_only") {
    return null;
  }

  function updateEye(eye: "od" | "os", patch: Partial<PrescriptionEyeValues>) {
    setDraft((current) => ({ ...current, [eye]: { ...current[eye], ...patch } }));
  }

  function handleCylinderChange(eye: "od" | "os", cylinder: number) {
    // Axis only applies to a non-zero cylinder — clear it automatically
    // whenever cylinder is changed back to CYL / 0.00.
    setDraft((current) => ({
      ...current,
      [eye]: { ...current[eye], cylinder, axis: cylinder === 0 ? null : current[eye].axis },
    }));
  }

  function handleEdit() {
    setDraft(prescription ?? createBlankPrescription());
    setShowValidation(false);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    if (!prescription) return;
    setDraft(prescription);
    setShowValidation(false);
    setIsEditing(false);
  }

  function handleApply() {
    if (!isValidPrescription(draft)) {
      setShowValidation(true);
      return;
    }
    dispatch({ type: "APPLY_PRESCRIPTION", prescription: draft });
    setShowValidation(false);
    setIsEditing(false);
  }

  function handleClear() {
    dispatch({ type: "CLEAR_PRESCRIPTION" });
  }

  function updatePupillaryDistance(field: PupillaryDistanceField, value: string) {
    dispatch({
      type: "SET_PUPILLARY_DISTANCE_VALUE",
      field,
      value: sanitizePupillaryDistanceValue(value),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prescription details</CardTitle>
        <CardDescription>
          Required to configure lenses for this order. Used only to calculate this quote — never saved or
          transmitted.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-navy-100 bg-navy-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-navy-700">Pupillary distance (PD)</p>
              <p className="mt-0.5 text-xs text-navy-500">Choose how the prescription lists the measurement.</p>
            </div>
            <div
              className="inline-flex rounded-lg border border-navy-200 bg-white p-1"
              role="group"
              aria-label="Pupillary distance format"
            >
              <Button
                size="sm"
                variant={input.pupillaryDistance.mode === "binocular" ? "accent" : "ghost"}
                className="h-8 px-3"
                aria-pressed={input.pupillaryDistance.mode === "binocular"}
                onClick={() => dispatch({ type: "SET_PUPILLARY_DISTANCE_MODE", mode: "binocular" })}
              >
                One number
              </Button>
              <Button
                size="sm"
                variant={input.pupillaryDistance.mode === "monocular" ? "accent" : "ghost"}
                className="h-8 px-3"
                aria-pressed={input.pupillaryDistance.mode === "monocular"}
                onClick={() => dispatch({ type: "SET_PUPILLARY_DISTANCE_MODE", mode: "monocular" })}
              >
                Two numbers
              </Button>
            </div>
          </div>

          {input.pupillaryDistance.mode === "binocular" ? (
            <div className="mt-3 max-w-[180px]">
              <Label htmlFor="pd-binocular" className="text-xs">
                PD (mm)
              </Label>
              <Input
                id="pd-binocular"
                value={input.pupillaryDistance.binocular}
                onChange={(event) => updatePupillaryDistance("binocular", event.target.value)}
                placeholder="63"
                inputMode="decimal"
                maxLength={4}
                autoComplete="off"
                aria-describedby="pupillary-distance-help"
              />
            </div>
          ) : (
            <div className="mt-3 grid max-w-sm grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pd-right" className="text-xs">
                  OD / Right
                </Label>
                <Input
                  id="pd-right"
                  value={input.pupillaryDistance.right}
                  onChange={(event) => updatePupillaryDistance("right", event.target.value)}
                  placeholder="31.5"
                  inputMode="decimal"
                  maxLength={4}
                  autoComplete="off"
                  aria-describedby="pupillary-distance-help"
                />
              </div>
              <div>
                <Label htmlFor="pd-left" className="text-xs">
                  OS / Left
                </Label>
                <Input
                  id="pd-left"
                  value={input.pupillaryDistance.left}
                  onChange={(event) => updatePupillaryDistance("left", event.target.value)}
                  placeholder="31.5"
                  inputMode="decimal"
                  maxLength={4}
                  autoComplete="off"
                  aria-describedby="pupillary-distance-help"
                />
              </div>
            </div>
          )}
          <p id="pupillary-distance-help" className="mt-1.5 text-xs text-navy-500">
            Up to two digits plus one decimal. This appears only on the Internal Worksheet.
          </p>
        </div>

        {isEditing ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <EyeFields
                eye="od"
                label="OD / Right Eye"
                values={draft.od}
                onChange={(patch) => updateEye("od", patch)}
                onCylinderChange={(cylinder) => handleCylinderChange("od", cylinder)}
                showValidation={showValidation}
              />
              <EyeFields
                eye="os"
                label="OS / Left Eye"
                values={draft.os}
                onChange={(patch) => updateEye("os", patch)}
                onCylinderChange={(cylinder) => handleCylinderChange("os", cylinder)}
                showValidation={showValidation}
              />
            </div>

            {showValidation && !isValidPrescription(draft) ? (
              <p className="text-sm font-medium text-red-600" role="alert">
                Select an axis (1-180) for each eye with a non-zero cylinder before applying.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button variant="accent" onClick={handleApply}>
                Apply Prescription
              </Button>
              {prescription ? (
                <Button variant="secondary" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </>
        ) : prescription ? (
          <div className="space-y-3">
            <div className="rounded-md border border-navy-100 bg-navy-50 p-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-navy-500">
                Applied prescription
              </p>
              <pre className="whitespace-pre-wrap font-mono text-sm leading-6 text-navy-900">
                {formatPrescriptionSummaryLines(prescription).join("\n")}
              </pre>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={handleEdit}>
                Edit Prescription
              </Button>
              <Button variant="secondary" onClick={handleClear}>
                Clear Prescription
              </Button>
            </div>

            <div className="rounded-md border border-navy-100 p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-navy-500">
                Prescription calculation (Internal Worksheet display only)
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={prescriptionDisplayMode === "reading" ? "accent" : "secondary"}
                  disabled={!hasAdd}
                  aria-pressed={prescriptionDisplayMode === "reading"}
                  onClick={() =>
                    dispatch({
                      type: "SET_PRESCRIPTION_DISPLAY_MODE",
                      mode: toggledDisplayMode(prescriptionDisplayMode, "reading"),
                    })
                  }
                >
                  Reading Calculation
                </Button>
                <Button
                  variant={prescriptionDisplayMode === "computer" ? "accent" : "secondary"}
                  disabled={!hasAdd}
                  aria-pressed={prescriptionDisplayMode === "computer"}
                  onClick={() =>
                    dispatch({
                      type: "SET_PRESCRIPTION_DISPLAY_MODE",
                      mode: toggledDisplayMode(prescriptionDisplayMode, "computer"),
                    })
                  }
                >
                  Computer Calculation
                </Button>
              </div>
              {!hasAdd ? (
                <p className="mt-2 text-xs text-amber-700">
                  An ADD value is required to calculate a reading or computer prescription.
                </p>
              ) : prescriptionDisplayMode !== "original" ? (
                <p className="mt-2 text-xs text-navy-500">
                  The Internal Worksheet will show the {prescriptionDisplayLabel(prescriptionDisplayMode)}. The applied
                  prescription above is never changed.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {!prescription ? (
          <p className="text-xs text-navy-400">
            Enter and apply a valid prescription to continue configuring lenses.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EyeFields({
  eye,
  label,
  values,
  onChange,
  onCylinderChange,
  showValidation,
}: {
  eye: "od" | "os";
  label: string;
  values: PrescriptionEyeValues;
  onChange: (patch: Partial<PrescriptionEyeValues>) => void;
  onCylinderChange: (cylinder: number) => void;
  showValidation: boolean;
}) {
  const axisRequired = values.cylinder !== 0;
  const axisInvalid = showValidation && axisRequired && values.axis === null;

  return (
    <div className="rounded-md border border-navy-100 p-3">
      <p className="mb-2 text-sm font-medium text-navy-700">{label}</p>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <Label htmlFor={`prescription-${eye}-sphere`} className="text-xs">
            Sphere
          </Label>
          <Select
            id={`prescription-${eye}-sphere`}
            value={String(values.sphere)}
            onChange={(e) => onChange({ sphere: Number(e.target.value) })}
            aria-label={`${label} sphere`}
          >
            {SPHERE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor={`prescription-${eye}-cylinder`} className="text-xs">
            Cylinder
          </Label>
          <Select
            id={`prescription-${eye}-cylinder`}
            value={String(values.cylinder)}
            onChange={(e) => onCylinderChange(Number(e.target.value))}
            aria-label={`${label} cylinder`}
          >
            {CYLINDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor={`prescription-${eye}-axis`} className="text-xs">
            Axis {axisRequired ? <span className="text-red-600">*</span> : null}
          </Label>
          <Select
            id={`prescription-${eye}-axis`}
            value={values.axis === null ? "" : String(values.axis)}
            disabled={!axisRequired}
            onChange={(e) => onChange({ axis: e.target.value === "" ? null : Number(e.target.value) })}
            aria-label={`${label} axis`}
            aria-invalid={axisInvalid}
          >
            <option value="">{axisRequired ? "Select axis" : "—"}</option>
            {AXIS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          {axisInvalid ? <p className="mt-1 text-xs text-red-600">Required</p> : null}
        </div>

        <div>
          <Label htmlFor={`prescription-${eye}-add`} className="text-xs">
            Add
          </Label>
          <Select
            id={`prescription-${eye}-add`}
            value={values.add === null ? "" : String(values.add)}
            onChange={(e) => onChange({ add: e.target.value === "" ? null : Number(e.target.value) })}
            aria-label={`${label} add`}
          >
            <option value="">None</option>
            {ADD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );
}
