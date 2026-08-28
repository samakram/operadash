import { EntityCrudPage } from "@/components/Common/EntityCrudPage";
import { titleCase } from "@/lib/utils";

interface StaffRow extends Record<string, unknown> {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  active: boolean;
}

export default function StaffPage() {
  return (
    <EntityCrudPage<StaffRow>
      title="Staff"
      description="Manage staff accounts for your organization"
      resource="/users"
      canExport={false}
      keyField="id"
      columns={[
        { key: "firstName", header: "Name", render: (row) => `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || "—" },
        { key: "email", header: "Email" },
        { key: "role", header: "Role", render: (row) => titleCase(row.role) },
        {
          key: "active",
          header: "Status",
          render: (row) => (
            <span className={`aurora-badge ${row.active ? "border-aurora-success/40 text-aurora-success" : "border-aurora-error/40 text-aurora-error"}`}>
              {row.active ? "Active" : "Disabled"}
            </span>
          ),
        },
      ]}
      fields={[
        { name: "firstName", label: "First name", type: "text", required: true },
        { name: "lastName", label: "Last name", type: "text", required: true },
        { name: "email", label: "Email", type: "email", required: true },
        { name: "active", label: "Active", type: "checkbox" },
      ]}
    />
  );
}
