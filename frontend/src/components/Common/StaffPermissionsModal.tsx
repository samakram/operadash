import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { Modal } from "@/components/Common/Modal";
import { Toggle } from "@/components/Common/Toggle";
import { AuroraButton } from "@/components/Common/AuroraButton";
import { useToast } from "@/components/Common/Toast";
import { titleCase } from "@/lib/utils";

interface PermissionRow {
  module: string;
  key: string;
  label: string;
  allowed: boolean;
}

interface StaffPermissionsModalProps {
  userId: string | null;
  userName: string;
  onClose: () => void;
}

/** Lets a tenant/super admin hide specific module sub-features from one staff member — see backend staffPermission.service.ts. */
export function StaffPermissionsModal({ userId, userName, onClose }: StaffPermissionsModalProps) {
  const { show } = useToast();
  const [rows, setRows] = useState<PermissionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    setIsLoading(true);
    api
      .get<PermissionRow[]>(`/users/${userId}/permissions`)
      .then(({ data }) => setRows(data))
      .catch((err) => show(getApiErrorMessage(err, "Failed to load permissions"), "error"))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const toggle = async (row: PermissionRow) => {
    const rowKey = `${row.module}:${row.key}`;
    setSavingKey(rowKey);
    try {
      await api.put(`/users/${userId}/permissions`, { module: row.module, key: row.key, allowed: !row.allowed });
      setRows((prev) => prev.map((r) => (r.module === row.module && r.key === row.key ? { ...r, allowed: !r.allowed } : r)));
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to update permission"), "error");
    } finally {
      setSavingKey(null);
    }
  };

  const grouped = rows.reduce<Record<string, PermissionRow[]>>((acc, row) => {
    (acc[row.module] ??= []).push(row);
    return acc;
  }, {});

  return (
    <Modal
      open={Boolean(userId)}
      onClose={onClose}
      title={`Permissions — ${userName}`}
      footer={
        <AuroraButton variant="ghost" onClick={onClose}>
          Done
        </AuroraButton>
      }
    >
      <p className="mb-4 flex items-center gap-2 text-sm text-aurora-text/60">
        <ShieldCheck size={16} />
        Off hides this feature for this staff member only, even if it's on for the rest of the account.
      </p>
      {isLoading ? (
        <p className="text-sm text-aurora-text/60">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-aurora-text/60">No toggleable features are available.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {Object.entries(grouped).map(([module, features]) => (
            <div key={module}>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-aurora-text/50">{titleCase(module)}</h4>
              <div className="flex flex-col gap-2">
                {features.map((row) => (
                  <div key={row.key} className="flex items-center justify-between rounded-lg border border-black/10 px-3 py-2">
                    <span className="text-sm">{row.label}</span>
                    <Toggle checked={row.allowed} disabled={savingKey === `${row.module}:${row.key}`} onChange={() => toggle(row)} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
