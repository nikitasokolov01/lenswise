export interface OrganizationLocation {
  id: string;
  organizationId: string;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  isPrimary: boolean;
  isActive: boolean;
}

export interface OrganizationLocationRow {
  id: string;
  organization_id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  contact_address: string | null;
  is_primary: boolean;
  is_active: boolean;
}

export function organizationLocationFromRow(
  row: OrganizationLocationRow
): OrganizationLocation {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    contactAddress: row.contact_address,
    isPrimary: row.is_primary,
    isActive: row.is_active,
  };
}
