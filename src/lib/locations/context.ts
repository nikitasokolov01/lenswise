import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  organizationLocationFromRow,
  type OrganizationLocation,
  type OrganizationLocationRow,
} from "@/lib/locations/types";

export const ACTIVE_LOCATION_COOKIE = "lenswise_active_location";

export interface OrganizationLocationContext {
  locations: OrganizationLocation[];
  activeLocation: OrganizationLocation | null;
}

/**
 * Resolves the location selected on this device and validates it against the
 * signed-in user's organization through RLS. The cookie is only a preference;
 * it is never trusted as authorization or used without this database check.
 */
export const getOrganizationLocationContext = cache(
  async (organizationId: string): Promise<OrganizationLocationContext> => {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("organization_locations")
      .select(
        "id,organization_id,name,contact_email,contact_phone,contact_address,is_primary,is_active"
      )
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("is_primary", { ascending: false })
      .order("name");

    if (error) {
      throw new Error("Organization locations could not be loaded.");
    }

    const locations = ((data ?? []) as OrganizationLocationRow[]).map(
      organizationLocationFromRow
    );
    const requestedId = cookies().get(ACTIVE_LOCATION_COOKIE)?.value;
    const activeLocation =
      locations.find((location) => location.id === requestedId) ??
      locations.find((location) => location.isPrimary) ??
      locations[0] ??
      null;

    return { locations, activeLocation };
  }
);

export async function requireActiveOrganizationLocation(
  organizationId: string
): Promise<OrganizationLocation> {
  const { activeLocation } = await getOrganizationLocationContext(organizationId);
  if (!activeLocation) {
    throw new Error("This organization does not have an active location.");
  }
  return activeLocation;
}
