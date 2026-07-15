import { requireArea } from "@/lib/auth/guards";
import { AdminEditor } from "@/components/admin/AdminEditor";

/**
 * Admin Pricing. Access is enforced server-side: only Owners and Admins of an
 * active organization reach this page (Staff are redirected). RLS also blocks
 * Staff from writing pricing, so hiding the nav link is not the only defense.
 */
export default async function AdminPage() {
  await requireArea("admin_pricing");
  return <AdminEditor />;
}
