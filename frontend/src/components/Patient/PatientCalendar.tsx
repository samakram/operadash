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
import { ChevronLeft, ChevronRight, Clock, Scissors } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { GlassCard } from "@/components/Common/GlassCard";
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

interface CalendarResponse {
  shifts: ShiftEvent[];
  surgeries: SurgeryEvent[];
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function PatientCalendar() {
  const { show } = useToast();
  const [monthAnchor, setMonthAnchor] = useState(() => new Date());
  const [data, setData] = useState<CalendarResponse>({ shifts: [], surgeries: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());

  const gridStart = startOfWeek(startOfMonth(monthAnchor));
  const gridEnd = endOfWeek(endOfMonth(monthAnchor));
  const days = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart, gridEnd]);

  useEffect(() => {
    setIsLoading(true);
    api
      .get<CalendarResponse>("/patient/calendar", { params: { from: gridStart.toISOString(), to: gridEnd.toISOString() } })
      .then(({ data }) => setData(data))
      .catch((err) => show(getApiErrorMessage(err, "Failed to load calendar"), "error"))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridStart.getTime(), gridEnd.getTime()]);

  const eventsForDay = (day: Date) => ({
    shifts: data.shifts.filter((s) => isSameDay(new Date(s.startTime), day)),
    surgeries: data.surgeries.filter((s) => isSameDay(new Date(s.scheduledStart), day)),
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
            const { shifts, surgeries } = eventsForDay(day);
            const inMonth = isSameMonth(day, monthAnchor);
            const isSelected = isSameDay(day, selectedDay);
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
                  {shifts.slice(0, 2).map((s) => (
                    <span key={s.id} className="truncate rounded bg-aurora-cyan/15 px-1.5 py-0.5 text-[10px] font-medium text-aurora-cyan">
                      {format(new Date(s.startTime), "h:mm a")} {s.staff ? s.staff.lastName : "Shift"}
                    </span>
                  ))}
                  {surgeries.slice(0, 2).map((s) => (
                    <span key={s.id} className="truncate rounded bg-aurora-error/15 px-1.5 py-0.5 text-[10px] font-medium text-aurora-error">
                      {s.procedure}
                    </span>
                  ))}
                  {shifts.length + surgeries.length > 4 && (
                    <span className="text-[10px] text-aurora-text/40">+{shifts.length + surgeries.length - 4} more</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </GlassCard>

      <GlassCard className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{format(selectedDay, "EEEE, MMMM d")}</h3>
        {selected.shifts.length === 0 && selected.surgeries.length === 0 ? (
          <p className="text-sm text-aurora-text/40">Nothing scheduled</p>
        ) : (
          <div className="flex flex-col divide-y divide-black/5">
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
    </div>
  );
}
