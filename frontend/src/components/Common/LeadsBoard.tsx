import { useCallback, useEffect, useState } from "react";
import { Plus, Mail, Phone, DollarSign, Pencil, Trash2 } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { GlassCard } from "@/components/Common/GlassCard";
import { AuroraButton } from "@/components/Common/AuroraButton";
import { GlassInput, GlassTextarea } from "@/components/Common/GlassInput";
import { Modal } from "@/components/Common/Modal";
import { LoadingSpinner } from "@/components/Common/LoadingSpinner";
import { KanbanBoard, type KanbanColumn } from "@/components/Common/KanbanBoard";
import { useToast } from "@/components/Common/Toast";
import { formatCurrency } from "@/lib/utils";
import type { ModuleName } from "@/hooks/useTenant";

type LeadStage = "new" | "contacted" | "qualified" | "won" | "lost";

interface Lead {
  id: string;
  module: ModuleName;
  title: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  estimatedValue: string | null;
  stage: LeadStage;
  source: string | null;
  notes: string | null;
}

interface BoardResponse {
  stages: LeadStage[];
  board: Record<LeadStage, Lead[]>;
  total: number;
}

const STAGE_ACCENTS: Record<LeadStage, string> = {
  new: "text-aurora-blue",
  contacted: "text-aurora-cyan",
  qualified: "text-aurora-accent",
  won: "text-aurora-success",
  lost: "text-aurora-error",
};
const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: "new", label: "New", accentClass: STAGE_ACCENTS.new },
  { id: "contacted", label: "Contacted", accentClass: STAGE_ACCENTS.contacted },
  { id: "qualified", label: "Qualified", accentClass: STAGE_ACCENTS.qualified },
  { id: "won", label: "Won", accentClass: STAGE_ACCENTS.won },
  { id: "lost", label: "Lost", accentClass: STAGE_ACCENTS.lost },
];

const emptyForm = { title: "", contactName: "", contactEmail: "", contactPhone: "", estimatedValue: "", source: "", notes: "" };

export function LeadsBoard({ module, label }: { module: ModuleName; label: string }) {
  const { show } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [columns, setColumns] = useState<KanbanColumn[]>(DEFAULT_COLUMNS);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get<BoardResponse>("/leads", { params: { module } });
      setLeads(data.stages.flatMap((stage) => data.board[stage]));
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to load leads"), "error");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api
      .get<{ stage: LeadStage; label: string }[]>("/leads/stage-labels", { params: { module } })
      .then(({ data }) => setColumns(data.map((s) => ({ id: s.stage, label: s.label, accentClass: STAGE_ACCENTS[s.stage] }))))
      .catch(() => undefined);
  }, [module]);

  const handleRenameColumn = async (stage: string, newLabel: string) => {
    const previous = columns;
    setColumns((prev) => prev.map((c) => (c.id === stage ? { ...c, label: newLabel } : c)));
    try {
      const { data } = await api.patch<{ stage: LeadStage; label: string }[]>("/leads/stage-labels", { module, stage, label: newLabel });
      setColumns(data.map((s) => ({ id: s.stage, label: s.label, accentClass: STAGE_ACCENTS[s.stage] })));
    } catch (err) {
      setColumns(previous);
      show(getApiErrorMessage(err, "Failed to rename stage"), "error");
    }
  };

  const handleMove = async (leadId: string, newStage: string) => {
    const previous = leads;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: newStage as LeadStage } : l)));
    try {
      await api.patch(`/leads/${leadId}`, { stage: newStage });
    } catch (err) {
      setLeads(previous); // roll back the optimistic move
      show(getApiErrorMessage(err, "Failed to move lead"), "error");
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (lead: Lead) => {
    setEditing(lead);
    setForm({
      title: lead.title,
      contactName: lead.contactName ?? "",
      contactEmail: lead.contactEmail ?? "",
      contactPhone: lead.contactPhone ?? "",
      estimatedValue: lead.estimatedValue ?? "",
      source: lead.source ?? "",
      notes: lead.notes ?? "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const payload = { ...form, module, estimatedValue: form.estimatedValue === "" ? undefined : Number(form.estimatedValue) };
      if (editing) {
        await api.patch(`/leads/${editing.id}`, payload);
        show("Lead updated", "success");
      } else {
        await api.post("/leads", payload);
        show("Lead created", "success");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to save lead"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (lead: Lead) => {
    try {
      await api.delete(`/leads/${lead.id}`);
      show("Lead deleted", "success");
      await load();
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to delete lead"), "error");
    }
  };

  if (isLoading) return <LoadingSpinner fullscreen />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3>{label} pipeline</h3>
          <p className="text-sm text-aurora-text/60">Drag a card between stages to update it — click a stage name to rename it.</p>
        </div>
        <AuroraButton size="sm" icon={<Plus size={16} />} onClick={openCreate}>
          Add lead
        </AuroraButton>
      </div>

      <KanbanBoard
        columns={columns}
        items={leads}
        getColumnId={(lead) => lead.stage}
        onMove={handleMove}
        onRenameColumn={handleRenameColumn}
        renderCard={(lead) => (
          <GlassCard padding="sm" className="mb-2 flex flex-col gap-1.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold leading-snug">{lead.title}</p>
              <div className="flex shrink-0 gap-0.5">
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => openEdit(lead)}
                  className="rounded p-1 text-aurora-text/40 hover:bg-black/5 hover:text-aurora-cyan"
                  aria-label="Edit lead"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => handleDelete(lead)}
                  className="rounded p-1 text-aurora-text/40 hover:bg-black/5 hover:text-aurora-error"
                  aria-label="Delete lead"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            {lead.contactName && <p className="text-xs text-aurora-text/60">{lead.contactName}</p>}
            {lead.contactEmail && (
              <p className="flex items-center gap-1 text-xs text-aurora-text/50">
                <Mail size={11} /> {lead.contactEmail}
              </p>
            )}
            {lead.contactPhone && (
              <p className="flex items-center gap-1 text-xs text-aurora-text/50">
                <Phone size={11} /> {lead.contactPhone}
              </p>
            )}
            {lead.estimatedValue && (
              <p className="flex items-center gap-1 text-xs font-medium text-aurora-success">
                <DollarSign size={11} /> {formatCurrency(lead.estimatedValue)}
              </p>
            )}
          </GlassCard>
        )}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit lead" : "Add lead"}
        footer={
          <>
            <AuroraButton variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </AuroraButton>
            <AuroraButton isLoading={isSaving} onClick={handleSubmit}>
              {editing ? "Save changes" : "Create"}
            </AuroraButton>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <GlassInput label="Title" required value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          </div>
          <GlassInput label="Contact name" value={form.contactName} onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))} />
          <GlassInput
            label="Estimated value"
            type="number"
            step="0.01"
            value={form.estimatedValue}
            onChange={(e) => setForm((p) => ({ ...p, estimatedValue: e.target.value }))}
          />
          <GlassInput label="Contact email" type="email" value={form.contactEmail} onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))} />
          <GlassInput label="Contact phone" value={form.contactPhone} onChange={(e) => setForm((p) => ({ ...p, contactPhone: e.target.value }))} />
          <GlassInput label="Source" placeholder="Referral, website, walk-in..." value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))} />
          <div className="sm:col-span-2">
            <GlassTextarea label="Notes" rows={3} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
