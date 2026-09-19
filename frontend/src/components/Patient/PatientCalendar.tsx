import { useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Clock, Scissors, CalendarClock, Plus } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { GlassCard } from "@/components/Common/GlassCard";
import { GlassInput, GlassSelect } from "@/components/Common/GlassInput";
import { Modal } from "@/components/Common/Modal";
import { AuroraButton } from "@/components/Common/AuroraButton";
import { LoadingSpinner } from "@/components/Common/LoadingSpinner";
import { useToast } from "@/components/Common/Toast";
import { cn, formatDateTime } from "@/lib/utils";

interface ShiftEvent {
  id: string;
  startTime: string;
  endTime: string;
  department: string | null;
  status: string;
  staff: { firstName: string; lastName: string } | null;
}

interface SurgeryEvent {
  id: string;
  procedure: string;
  operatingRoom: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  patient: { firstName: string; lastName: string } | null;
  surgeon: { firstName: string; lastName: string } | null;
}

interface AppointmentEvent {
  id: string;
  appointmentDatetime: string;
  reasonForVisit: string | null;
  status: string;
  patient: { firstName: string; lastName: string } | null;
  provider: { firstName: string; lastName: string } | null;
}

interface CalendarResponse {
  shifts: ShiftEvent[];
  surgeries: SurgeryEvent[];
  appointments: AppointmentEvent[];
}

interface PickOption {
  value: string;
  label: string;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EMPTY_DATA: CalendarResponse = { shifts: [], surgeries: [], appointments: [] };

type ScheduleType = "shift" | "surgery" | "appointment";

const SCHEDULE_TYPE_META: Record<ScheduleType, { label: string; icon: typeof Clock }> = {
  shift: { label: "Shift", icon: Clock },
  surgery: { label: "Surgery", icon: Scissors },
  appointment: { label: "Appointment", icon: CalendarClock },
};

function toLocalDateTimeInput(date: Date, hour: number): string {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Quick-create modal for the calendar's "+ Schedule" action — a trimmed subset of the fields on the Staff/Surgery/Appointments tabs, prefilled to the clicked day. */
function ScheduleModal({ day, onClose, onScheduled }: { day: Date; onClose: () => void; onScheduled: () => void }) {
  const { show } = useToast();
  const [type, setType] = useState<ScheduleType>("shift");
  const [isSaving, setIsSaving] = useState(false);
  const [staffOptions, setStaffOptions] = useState<PickOption[]>([]);
  const [patientOptions, setPatientOptions] = useState<PickOption[]>([]);
  const [providerOptions, setProviderOptions] = useState<PickOption[]>([]);

  const [shiftForm, setShiftForm] = useState({ staffId: "", startTime: toLocalDateTimeInput(day, 9), endTime: toLocalDateTimeInput(day, 17), department: "" });
  const [surgeryForm, setSurgeryForm] = useState({
    patientId: "",
    surgeonId: "",
    procedure: "",
    operatingRoom: "",
    scheduledStart: toLocalDateTimeInput(day, 9),
    scheduledEnd: toLocalDateTimeInput(day, 11),
  });
  const [apptForm, setApptForm] = useState({ patientId: "", providerId: "", appointmentDatetime: toLocalDateTimeInput(day, 9), reasonForVisit: "" });

  useEffect(() => {
    const mapPeople = (rows: Record<string, unknown>[]) =>
      rows.map((r) => ({ value: String(r.id), label: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() }));
    Promise.all([api.get("/patient/staff", { params: { pageSize: 200 } }), api.get("/patient/patients", { params: { pageSize: 200 } }), api.get("/patient/providers", { params: { pageSize: 200 } })])
      .then(([staffRes, patientsRes, providersRes]) => {
        setStaffOptions(mapPeople(staffRes.data.data));
        setPatientOptions(mapPeople(patientsRes.data.data));
        setProviderOptions(mapPeople(providersRes.data.data));
      })
      .catch((err) => show(getApiErrorMessage(err, "Failed to load staff/patients"), "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      if (type === "shift") {
        if (!shiftForm.staffId) throw new Error("Pick a staff member");
        await api.post("/patient/shifts", shiftForm);
      } else if (type === "surgery") {
        if (!surgeryForm.patientId || !surgeryForm.surgeonId || !surgeryForm.procedure) throw new Error("Fill in patient, surgeon, and procedure");
        await api.post("/patient/surgery", surgeryForm);
      } else {
        if (!apptForm.patientId || !apptForm.providerId) throw new Error("Pick a patient and provider");
        await api.post("/patient/appointments", apptForm);
      }
      show(`${SCHEDULE_TYPE_META[type].label} scheduled`, "success");
      onScheduled();
      onClose();
    } catch (err) {
      show(err instanceof Error && !("response" in err) ? err.message : getApiErrorMessage(err, "Failed to schedule"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Schedule for ${format(day, "MMMM d, yyyy")}`}
      footer={
        <>
          <AuroraButton variant="ghost" onClick={onClose}>
            Cancel
          </AuroraButton>
          <AuroraButton isLoading={isSaving} onClick={handleSubmit}>
            Schedule
          </AuroraButton>
        </>
      }
    >
      <div className="mb-4 flex gap-2">
        {(Object.keys(SCHEDULE_TYPE_META) as ScheduleType[]).map((t) => {
          const meta = SCHEDULE_TYPE_META[t];
          return (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition",
                type === t ? "border-aurora-accent bg-aurora-accent-soft text-aurora-accent" : "border-aurora-border text-aurora-text/60 hover:bg-black/[0.03]",
              )}
            >
              <meta.icon size={14} />
              {meta.label}
            </button>
          );
        })}
      </div>

      {type === "shift" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <GlassSelect
              label="Staff member"
              required
              placeholder="Select staff member"
              options={staffOptions}
              value={shiftForm.staffId}
              onChange={(e) => setShiftForm((p) => ({ ...p, staffId: e.target.value }))}
            />
          </div>
          <GlassInput label="Start" type="datetime-local" required value={shiftForm.startTime} onChange={(e) => setShiftForm((p) => ({ ...p, startTime: e.target.value }))} />
          <GlassInput label="End" type="datetime-local" required value={shiftForm.endTime} onChange={(e) => setShiftForm((p) => ({ ...p, endTime: e.target.value }))} />
          <div className="sm:col-span-2">
            <GlassInput label="Department" value={shiftForm.department} onChange={(e) => setShiftForm((p) => ({ ...p, department: e.target.value }))} />
          </div>
        </div>
      )}

      {type === "surgery" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <GlassSelect
            label="Patient"
            required
            placeholder="Select patient"
            options={patientOptions}
            value={surgeryForm.patientId}
            onChange={(e) => setSurgeryForm((p) => ({ ...p, patientId: e.target.value }))}
          />
          <GlassSelect
            label="Surgeon"
            required
            placeholder="Select surgeon"
            options={staffOptions}
            value={surgeryForm.surgeonId}
            onChange={(e) => setSurgeryForm((p) => ({ ...p, surgeonId: e.target.value }))}
          />
          <div className="sm:col-span-2">
            <GlassInput label="Procedure" required value={surgeryForm.procedure} onChange={(e) => setSurgeryForm((p) => ({ ...p, procedure: e.target.value }))} />
          </div>
          <GlassInput label="Operating room" value={surgeryForm.operatingRoom} onChange={(e) => setSurgeryForm((p) => ({ ...p, operatingRoom: e.target.value }))} />
          <div />
          <GlassInput
            label="Scheduled start"
            type="datetime-local"
            required
            value={surgeryForm.scheduledStart}
            onChange={(e) => setSurgeryForm((p) => ({ ...p, scheduledStart: e.target.value }))}
          />
          <GlassInput
            label="Scheduled end"
            type="datetime-local"
            required
            value={surgeryForm.scheduledEnd}
            onChange={(e) => setSurgeryForm((p) => ({ ...p, scheduledEnd: e.target.value }))}
          />
        </div>
      )}

      {type === "appointment" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <GlassSelect
            label="Patient"
            required
            placeholder="Select patient"
            options={patientOptions}
            value={apptForm.patientId}
            onChange={(e) => setApptForm((p) => ({ ...p, patientId: e.target.value }))}
          />
          <GlassSelect
            label="Provider"
            required
            placeholder="Select provider"
            options={providerOptions}
            value={apptForm.providerId}
            onChange={(e) => setApptForm((p) => ({ ...p, providerId: e.target.value }))}
          />
          <div className="sm:col-span-2">
            <GlassInput
              label="Date & time"
              type="datetime-local"
              required
              value={apptForm.appointmentDatetime}
              onChange={(e) => setApptForm((p) => ({ ...p, appointmentDatetime: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <GlassInput label="Reason for visit" value={apptForm.reasonForVisit} onChange={(e) => setApptForm((p) => ({ ...p, reasonForVisit: e.target.value }))} />
          </div>
        </div>
      )}
    </Modal>
  );
}

export function PatientCalendar() {
  const { show } = useToast();
  const [monthAnchor, setMonthAnchor] = useState(() => new Date());
  const [data, setData] = useState<CalendarResponse>(EMPTY_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const [scheduling, setScheduling] = useState(false);

  const gridStart = startOfWeek(startOfMonth(monthAnchor));
  const gridEnd = endOfWeek(endOfMonth(monthAnchor));
  const days = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart, gridEnd]);

  const load = () => {
    setIsLoading(true);
    api
      .get<CalendarResponse>("/patient/calendar", { params: { from: gridStart.toISOString(), to: gridEnd.toISOString() } })
      .then(({ data }) => setData(data))
      .catch((err) => show(getApiErrorMessage(err, "Failed to load calendar"), "error"))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridStart.getTime(), gridEnd.getTime()]);

  const eventsForDay = (day: Date) => ({
    shifts: data.shifts.filter((s) => isSameDay(new Date(s.startTime), day)),
    surgeries: data.surgeries.filter((s) => isSameDay(new Date(s.scheduledStart), day)),
    appointments: data.appointments.filter((a) => isSameDay(new Date(a.appointmentDatetime), day)),
  });

  const selected = eventsForDay(selectedDay);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3>{format(monthAnchor, "MMMM yyyy")}</h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setMonthAnchor((m) => subMonths(m, 1))} className="rounded-lg p-1.5 hover:bg-black/10" aria-label="Previous month">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => setMonthAnchor(new Date())} className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-black/10">
            Today
          </button>
          <button onClick={() => setMonthAnchor((m) => addMonths(m, 1))} className="rounded-lg p-1.5 hover:bg-black/10" aria-label="Next month">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <GlassCard padding="none" className="relative overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
            <LoadingSpinner />
          </div>
        )}
        <div className="grid grid-cols-7 border-b border-black/10 text-center text-xs font-semibold uppercase tracking-wide text-aurora-text/40">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="py-2.5">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const { shifts, surgeries, appointments } = eventsForDay(day);
            const inMonth = isSameMonth(day, monthAnchor);
            const isSelected = isSameDay(day, selectedDay);
            const total = shifts.length + surgeries.length + appointments.length;
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "flex min-h-[92px] flex-col items-start gap-1 border-b border-r border-black/[0.05] p-2 text-left transition hover:bg-black/[0.03]",
                  !inMonth && "bg-black/[0.015] text-aurora-text/30",
                  isSelected && "bg-aurora-accent-soft",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                    isToday(day) && "bg-aurora-accent text-white",
                  )}
                >
                  {format(day, "d")}
                </span>
                <div className="flex w-full flex-col gap-0.5">
                  {appointments.slice(0, 1).map((a) => (
                    <span key={a.id} className="truncate rounded bg-aurora-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-aurora-accent">
                      {format(new Date(a.appointmentDatetime), "h:mm a")} {a.patient ? a.patient.lastName : "Appt"}
                    </span>
                  ))}
                  {shifts.slice(0, 1).map((s) => (
                    <span key={s.id} className="truncate rounded bg-aurora-cyan/15 px-1.5 py-0.5 text-[10px] font-medium text-aurora-cyan">
                      {format(new Date(s.startTime), "h:mm a")} {s.staff ? s.staff.lastName : "Shift"}
                    </span>
                  ))}
                  {surgeries.slice(0, 1).map((s) => (
                    <span key={s.id} className="truncate rounded bg-aurora-error/15 px-1.5 py-0.5 text-[10px] font-medium text-aurora-error">
                      {s.procedure}
                    </span>
                  ))}
                  {total > 3 && <span className="text-[10px] text-aurora-text/40">+{total - 3} more</span>}
                </div>
              </button>
            );
          })}
        </div>
      </GlassCard>

      <GlassCard className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{format(selectedDay, "EEEE, MMMM d")}</h3>
          <AuroraButton size="sm" icon={<Plus size={14} />} onClick={() => setScheduling(true)}>
            Schedule
          </AuroraButton>
        </div>
        {selected.shifts.length === 0 && selected.surgeries.length === 0 && selected.appointments.length === 0 ? (
          <p className="text-sm text-aurora-text/40">Nothing scheduled</p>
        ) : (
          <div className="flex flex-col divide-y divide-black/5">
            {selected.appointments.map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aurora-accent/15 text-aurora-accent">
                  <CalendarClock size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : "Patient"}</p>
                  <p className="text-xs text-aurora-text/50">
                    {formatDateTime(a.appointmentDatetime)}
                    {a.provider ? ` · Dr. ${a.provider.lastName}` : ""}
                    {a.reasonForVisit ? ` · ${a.reasonForVisit}` : ""}
                  </p>
                </div>
              </div>
            ))}
            {selected.shifts.map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aurora-cyan/15 text-aurora-cyan">
                  <Clock size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.staff ? `${s.staff.firstName} ${s.staff.lastName}` : "Unassigned"}</p>
                  <p className="text-xs text-aurora-text/50">
                    {formatDateTime(s.startTime)} &ndash; {formatDateTime(s.endTime)}
                    {s.department ? ` · ${s.department}` : ""}
                  </p>
                </div>
              </div>
            ))}
            {selected.surgeries.map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aurora-error/15 text-aurora-error">
                  <Scissors size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.procedure}</p>
                  <p className="text-xs text-aurora-text/50">
                    {s.patient ? `${s.patient.firstName} ${s.patient.lastName}` : "Patient"} &middot;{" "}
                    {s.surgeon ? `Dr. ${s.surgeon.lastName}` : "Unassigned"}
                    {s.operatingRoom ? ` · OR ${s.operatingRoom}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {scheduling && <ScheduleModal day={selectedDay} onClose={() => setScheduling(false)} onScheduled={load} />}
    </div>
  );
}
