import { AdminPinGate } from "@/components/admin/AdminPinGate";
import { AdminEditor } from "@/components/admin/AdminEditor";

export default function AdminPage() {
  return (
    <AdminPinGate>
      <AdminEditor />
    </AdminPinGate>
  );
}
