import { useEffect, useState } from "react";
import axios from "axios";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { Users, CalendarClock, Pill, FlaskConical, FileText, ArrowLeft, UserPlus, Clock } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { GlassCard } from "@/components/Common/GlassCard";
import { LoadingSpinner } from "@/components/Common/LoadingSpinner";
import { useToast } from "@/components/Common/Toast";
import { AuroraButton } from "@/components/Common/AuroraButton";
import { EntityCrudPage, type FieldDef } from "@/components/Common/EntityCrudPage";
import { LeadsBoard } from "@/components/Common/LeadsBoard";
import { PatientEnrollModal } from "@/components/Patient/PatientEnrollModal";
import { PatientCalendar } from "@/components/Patient/PatientCalendar";
import type { Column } from "@/components/Common/Table";
import { cn, formatCurrency, formatDate, formatDateTime, titleCase } from "@/lib/utils";

// ============================================================
// Shared display helpers
// ============================================================

const STATUS_BADGE_STYLES: Record<string, string> = {
  scheduled: "border-aurora-cyan/40 text-aurora-cyan",
  checked_in: "border-aurora-blue/40 text-aurora-blue",
  completed: "border-aurora-success/40 text-aurora-success",
  cancelled: "border-aurora-error/40 text-aurora-error",
  no_show: "border-aurora-warning/40 text-aurora-warning",
  normal: "border-aurora-success/40 text-aurora-success",
  abnormal: "border-aurora-warning/40 text-aurora-warning",
  critical: "border-aurora-error/40 text-aurora-error",
  pending: "border-black/20 text-aurora-text/70",
  submitted: "border-aurora-cyan/40 text-aurora-cyan",
  approved: "border-aurora-success/40 text-aurora-success",
  denied: "border-aurora-error/40 text-aurora-error",
};

function StatusBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-aurora-text/40">—</span>;
  return <span className={cn("aurora-badge", STATUS_BADGE_STYLES[value] ?? "border-black/20 text-aurora-text/70")}>{titleCase(value)}</span>;
}

function personName(row: unknown): string {
  const r = row as { firstName?: string; lastName?: string } | null | undefined;
  if (!r) return "—";
  return `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || "—";
}

function appointmentOptionMapper(row: Record<string, unknown>): { value: string; label: string } {
  const patient = row.patient as { firstName?: string; lastName?: string } | undefined;
  const when = row.appointmentDatetime ? formatDateTime(row.appointmentDatetime as string) : "";
  return { value: String(row.id), label: `${personName(patient)} — ${when}` };
}

// ============================================================
// Dashboard tab
// ============================================================

interface DashboardAppointment {
  id: string;
  appointmentDatetime: string;
  durationMinutes: number;
  status: string;
  reasonForVisit: string | null;
  patient: { firstName: string; lastName: string } | null;
  provider: { firstName: string; lastName: string } | null;
}

interface DashboardVisit {
  id: string;
  visitDate: string;
  diagnosis: string | null;
  patient: { firstName: string; lastName: string } | null;
  provider: { firstName: string; lastName: string } | null;
}

interface DashboardData {
  totalPatients: number;
  appointmentsToday: number;
  resultsNeedingReview: number;
  refillsDue: number;
  upcomingAppointments: DashboardAppointment[];
  recentVisits: DashboardVisit[];
}

function KpiCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <GlassCard className="flex items-center gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-aurora-accent">{icon}</div>
      <div>
        <p className="text-xs uppercase tracking-wide text-aurora-text/50">{label}</p>
        <p className="text-xl font-bold">{value}</p>
        {hint && <p className="text-xs text-aurora-text/50">{hint}</p>}
      </div>
    </GlassCard>
  );
}

function DashboardTab() {
  const { show } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: res } = await api.get<DashboardData>("/patient/dashboard");
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) show(getApiErrorMessage(err, "Failed to load dashboard"), "error");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading || !data) return <LoadingSpinner fullscreen />;

  return (
    <div className="flex flex-col gap-5">
      <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={<Users size={20} />} label="Total patients" value={String(data.totalPatients)} />
        <KpiCard icon={<CalendarClock size={20} />} label="Appointments today" value={String(data.appointmentsToday)} />
        <KpiCard icon={<FlaskConical size={20} />} label="Results needing review" value={String(data.resultsNeedingReview)} hint="Abnormal/critical, last 7 days" />
        <KpiCard icon={<Pill size={20} />} label="Refills due" value={String(data.refillsDue)} hint="1 or fewer refills remaining" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <GlassCard padding="none">
          <div className="border-b border-black/10 px-6 py-4">
            <h3>Upcoming appointments</h3>
          </div>
          <div className="divide-y divide-black/5">
            {data.upcomingAppointments.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-aurora-text/50">No scheduled appointments coming up.</p>
            ) : (
              data.upcomingAppointments.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium">{personName(a.patient)}</p>
                    <p className="text-xs text-aurora-text/50">
                      {personName(a.provider)} &middot; {formatDateTime(a.appointmentDatetime)}
                    </p>
                  </div>
                  <StatusBadge value={a.status} />
                </div>
              ))
            )}
          </div>
        </GlassCard>

        <GlassCard padding="none">
          <div className="border-b border-black/10 px-6 py-4">
            <h3>Recent visits</h3>
          </div>
          <div className="divide-y divide-black/5">
            {data.recentVisits.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-aurora-text/50">No medical records yet.</p>
            ) : (
              data.recentVisits.map((v) => (
                <div key={v.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium">{personName(v.patient)}</p>
                    <p className="text-xs text-aurora-text/50">
                      {personName(v.provider)} &middot; {formatDate(v.visitDate)}
                    </p>
                  </div>
                  <p className="max-w-[45%] truncate text-right text-xs text-aurora-text/60">{v.diagnosis ?? "—"}</p>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

// ============================================================
// Patients tab
// ============================================================

interface PatientRow extends Record<string, unknown> {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string;
  allergies: string[];
  chronicConditions: string[];
  bloodType: string | null;
}

function PatientsTab() {
  const navigate = useNavigate();
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const columns: Column<PatientRow>[] = [
    { key: "firstName", header: "Name", sortable: true, render: (r) => `${r.firstName} ${r.lastName}` },
    { key: "email", header: "Email" },
    { key: "phone", header: "Phone" },
    { key: "dateOfBirth", header: "Date of birth", sortable: true, render: (r) => formatDate(r.dateOfBirth) },
    { key: "allergies", header: "Allergies", render: (r) => (r.allergies.length > 0 ? r.allergies.join(", ") : "—") },
    { key: "bloodType", header: "Blood type", render: (r) => r.bloodType ?? "—" },
  ];

  const fields: FieldDef[] = [
    { name: "firstName", label: "First name", type: "text", required: true },
    { name: "lastName", label: "Last name", type: "text", required: true },
    { name: "email", label: "Email", type: "email" },
    { name: "phone", label: "Phone", type: "text" },
    { name: "dateOfBirth", label: "Date of birth", type: "date", required: true },
    { name: "gender", label: "Gender", type: "text" },
    { name: "bloodType", label: "Blood type", type: "text", placeholder: "e.g. O+" },
    { name: "address", label: "Address", type: "text" },
    { name: "city", label: "City", type: "text" },
    { name: "country", label: "Country", type: "text" },
    { name: "emergencyContactName", label: "Emergency contact name", type: "text" },
    { name: "emergencyContactPhone", label: "Emergency contact phone", type: "text" },
    { name: "allergies", label: "Allergies", type: "tags", hint: "Comma-separated — checked against new prescriptions" },
    { name: "chronicConditions", label: "Chronic conditions", type: "tags" },
    { name: "medicalHistorySummary", label: "Medical history summary", type: "textarea" },
  ];

  return (
    <>
      <EntityCrudPage<PatientRow>
        key={refreshKey}
        title="Patients"
        description="Patient directory — allergies drive the prescription safety check"
        resource="/patient/patients"
        searchPlaceholder="Search patients by name, email, or phone..."
        columns={columns}
        fields={fields}
        canCreate={false}
        toolbarExtra={
          <AuroraButton size="sm" icon={<UserPlus size={16} />} onClick={() => setEnrollOpen(true)}>
            Enroll patient
          </AuroraButton>
        }
        rowActions={(row) => (
          <button
            onClick={() => navigate(`chart/${row.id}`)}
            className="rounded-lg p-1.5 text-aurora-text/60 transition hover:bg-black/10 hover:text-aurora-accent"
            aria-label="View chart"
            title="View chart"
          >
            <FileText size={16} />
          </button>
        )}
      />
      <PatientEnrollModal open={enrollOpen} onClose={() => setEnrollOpen(false)} onEnrolled={() => setRefreshKey((k) => k + 1)} />
    </>
  );
}

// ============================================================
// Patient chart — everything about one patient, read-only, one screen
// ============================================================

interface ChartPerson {
  firstName: string;
  lastName: string;
}

interface ChartData {
  patient: PatientRow & { address: string | null; city: string | null; country: string | null; emergencyContactName: string | null; emergencyContactPhone: string | null; medicalHistorySummary: string | null };
  appointments: { id: string; appointmentDatetime: string; status: string; reasonForVisit: string | null; provider: ChartPerson }[];
  medicalRecords: { id: string; visitDate: string; diagnosis: string | null; treatmentPlan: string | null; chiefComplaint: string | null; provider: ChartPerson }[];
  prescriptions: { id: string; medicationName: string; dosage: string; frequency: string; startDate: string; endDate: string | null; prescribingProvider: ChartPerson }[];
  vitalSigns: { id: string; visitDate: string; bloodPressure: string | null; heartRate: number | null; temperature: string | null; weight: string | null }[];
  labResults: { id: string; testName: string; testDate: string; resultValue: string | null; status: string }[];
  insurance: { id: string; providerName: string | null; policyNumber: string | null; expirationDate: string | null }[];
  billing: { id: string; amountCharged: string; insuranceClaimStatus: string | null; patientResponsibility: string | null }[];
}

function ChartSection({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) {
  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-aurora-accent-soft text-aurora-accent">{icon}</div>
        <h3 className="text-sm font-semibold">
          {title} <span className="font-normal text-aurora-text/40">({count})</span>
        </h3>
      </div>
      {count === 0 ? <p className="text-xs text-aurora-text/40">None recorded</p> : <div className="flex flex-col divide-y divide-black/5">{children}</div>}
    </GlassCard>
  );
}

function PatientChart() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { show } = useToast();
  const [data, setData] = useState<ChartData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    api
      .get<ChartData>(`/patient/patients/${id}/chart`)
      .then(({ data }) => setData(data))
      .catch((err) => show(getApiErrorMessage(err, "Failed to load patient chart"), "error"))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (isLoading || !data) return <LoadingSpinner fullscreen />;
  const { patient } = data;

  return (
    <div className="animate-fade-in flex flex-col gap-5">
      <button onClick={() => navigate(-1)} className="inline-flex w-fit items-center gap-1 text-sm text-aurora-text/60 hover:text-aurora-text">
        <ArrowLeft size={14} /> Back to patients
      </button>

      <GlassCard className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2>
              {patient.firstName} {patient.lastName}
            </h2>
            <p className="mt-1 text-sm text-aurora-text/60">
              {formatDate(patient.dateOfBirth)} &middot; {patient.bloodType ?? "Blood type unknown"}
              {patient.city ? ` · ${patient.city}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {patient.allergies.length > 0 ? (
              patient.allergies.map((a) => (
                <span key={a} className="aurora-badge border-aurora-error/40 text-aurora-error">
                  {a}
                </span>
              ))
            ) : (
              <span className="aurora-badge border-aurora-success/40 text-aurora-success">No known allergies</span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-aurora-text/40">Contact</p>
            <p>{patient.email ?? "—"}</p>
            <p>{patient.phone ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-aurora-text/40">Emergency contact</p>
            <p>{patient.emergencyContactName ?? "—"}</p>
            <p>{patient.emergencyContactPhone ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-aurora-text/40">Chronic conditions</p>
            <p>{patient.chronicConditions.length > 0 ? patient.chronicConditions.join(", ") : "—"}</p>
          </div>
        </div>
        {patient.medicalHistorySummary && (
          <div>
            <p className="text-xs uppercase tracking-wide text-aurora-text/40">Medical history</p>
            <p className="text-sm text-aurora-text/80">{patient.medicalHistorySummary}</p>
          </div>
        )}
      </GlassCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartSection title="Appointments" icon={<CalendarClock size={16} />} count={data.appointments.length}>
          {data.appointments.map((a) => (
            <div key={a.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-medium">{formatDateTime(a.appointmentDatetime)}</p>
                <p className="text-xs text-aurora-text/50">
                  {a.reasonForVisit ?? "Visit"} with Dr. {a.provider.lastName}
                </p>
              </div>
              <span className="aurora-badge border-black/20">{titleCase(a.status)}</span>
            </div>
          ))}
        </ChartSection>

        <ChartSection title="Medical Records" icon={<Users size={16} />} count={data.medicalRecords.length}>
          {data.medicalRecords.map((r) => (
            <div key={r.id} className="py-2 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium">{r.diagnosis ?? "Visit"}</p>
                <span className="text-xs text-aurora-text/40">{formatDate(r.visitDate)}</span>
              </div>
              <p className="text-xs text-aurora-text/50">Dr. {r.provider.lastName}</p>
              <p className="mt-1 text-xs text-aurora-text/60">
                <span className="font-medium text-aurora-text/40">Doctor's notes: </span>
                {r.treatmentPlan ?? r.chiefComplaint ?? "—"}
              </p>
            </div>
          ))}
        </ChartSection>

        <ChartSection title="Prescriptions" icon={<Pill size={16} />} count={data.prescriptions.length}>
          {data.prescriptions.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-medium">{p.medicationName}</p>
                <p className="text-xs text-aurora-text/50">
                  {p.dosage} &middot; {titleCase(p.frequency)}
                </p>
                <p className="text-xs text-aurora-text/40">Prescribed by Dr. {p.prescribingProvider.lastName}</p>
              </div>
              <span className="text-xs text-aurora-text/40">{formatDate(p.startDate)}</span>
            </div>
          ))}
        </ChartSection>

        <ChartSection title="Vitals" icon={<Users size={16} />} count={data.vitalSigns.length}>
          {data.vitalSigns.map((v) => (
            <div key={v.id} className="py-2 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium">{formatDate(v.visitDate)}</p>
              </div>
              <p className="text-xs text-aurora-text/50">
                {v.bloodPressure ?? "—"} &middot; HR {v.heartRate ?? "—"} &middot; {v.temperature ?? "—"}&deg; &middot; {v.weight ?? "—"} lb
              </p>
            </div>
          ))}
        </ChartSection>

        <ChartSection title="Lab Results" icon={<FlaskConical size={16} />} count={data.labResults.length}>
          {data.labResults.map((l) => (
            <div key={l.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-medium">{l.testName}</p>
                <p className="text-xs text-aurora-text/50">{formatDate(l.testDate)}</p>
              </div>
              <span
                className={cn(
                  "aurora-badge",
                  l.status === "critical" ? "border-aurora-error/40 text-aurora-error" : l.status === "abnormal" ? "border-aurora-warning/40 text-aurora-warning" : "border-aurora-success/40 text-aurora-success",
                )}
              >
                {l.resultValue ?? titleCase(l.status)}
              </span>
            </div>
          ))}
        </ChartSection>

        <ChartSection title="Insurance & Billing" icon={<FileText size={16} />} count={data.insurance.length + data.billing.length}>
          {data.insurance.map((i) => (
            <div key={i.id} className="py-2 text-sm">
              <p className="font-medium">{i.providerName ?? "Insurance"}</p>
              <p className="text-xs text-aurora-text/50">
                Policy {i.policyNumber ?? "—"} &middot; expires {i.expirationDate ? formatDate(i.expirationDate) : "—"}
              </p>
            </div>
          ))}
          {data.billing.map((b) => (
            <div key={b.id} className="flex items-center justify-between py-2 text-sm">
              <p className="font-medium">{formatCurrency(b.amountCharged)}</p>
              <span className="aurora-badge border-black/20">{b.insuranceClaimStatus ? titleCase(b.insuranceClaimStatus) : "Self-pay"}</span>
            </div>
          ))}
        </ChartSection>
      </div>
    </div>
  );
}

// ============================================================
// Providers tab
// ============================================================

interface ProviderRow extends Record<string, unknown> {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  specialization: string | null;
  licenseNumber: string | null;
}

function ProvidersTab() {
  const columns: Column<ProviderRow>[] = [
    { key: "firstName", header: "Name", sortable: true, render: (r) => `${r.firstName} ${r.lastName}` },
    { key: "specialization", header: "Specialization", sortable: true, render: (r) => r.specialization ?? "—" },
    { key: "email", header: "Email" },
    { key: "phone", header: "Phone" },
    { key: "licenseNumber", header: "License #", render: (r) => r.licenseNumber ?? "—" },
  ];

  const fields: FieldDef[] = [
    { name: "firstName", label: "First name", type: "text", required: true },
    { name: "lastName", label: "Last name", type: "text", required: true },
    { name: "email", label: "Email", type: "email" },
    { name: "phone", label: "Phone", type: "text" },
    { name: "specialization", label: "Specialization", type: "text" },
    { name: "licenseNumber", label: "License number", type: "text" },
    { name: "bio", label: "Bio", type: "textarea" },
  ];

  return (
    <EntityCrudPage<ProviderRow>
      title="Providers"
      description="Clinicians who see patients and prescribe medication"
      resource="/patient/providers"
      searchPlaceholder="Search providers by name or specialization..."
      columns={columns}
      fields={fields}
    />
  );
}

// ============================================================
// Appointments tab
// ============================================================

interface AppointmentRow extends Record<string, unknown> {
  id: string;
  appointmentDatetime: string;
  durationMinutes: number;
  reasonForVisit: string | null;
  status: string;
  patient: { firstName: string; lastName: string } | null;
  provider: { firstName: string; lastName: string } | null;
}

const APPOINTMENT_STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "checked_in", label: "Checked in" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No show" },
];

function AppointmentsTab() {
  const columns: Column<AppointmentRow>[] = [
    { key: "patient", header: "Patient", render: (r) => personName(r.patient) },
    { key: "provider", header: "Provider", render: (r) => personName(r.provider) },
    { key: "appointmentDatetime", header: "When", sortable: true, render: (r) => formatDateTime(r.appointmentDatetime) },
    { key: "durationMinutes", header: "Duration", render: (r) => `${r.durationMinutes} min` },
    { key: "reasonForVisit", header: "Reason", render: (r) => r.reasonForVisit ?? "—" },
    { key: "status", header: "Status", sortable: true, render: (r) => <StatusBadge value={r.status} /> },
  ];

  const fields: FieldDef[] = [
    { name: "patientId", label: "Patient", type: "select", required: true, optionsEndpoint: "/patient/patients" },
    { name: "providerId", label: "Provider", type: "select", required: true, optionsEndpoint: "/patient/providers" },
    { name: "appointmentDatetime", label: "Date & time", type: "datetime-local", required: true },
    { name: "durationMinutes", label: "Duration (minutes)", type: "number", placeholder: "30" },
    { name: "reasonForVisit", label: "Reason for visit", type: "text" },
    { name: "status", label: "Status", type: "select", options: APPOINTMENT_STATUS_OPTIONS },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <EntityCrudPage<AppointmentRow>
      title="Appointments"
      description="Scheduling — a provider cannot be double-booked for an overlapping time slot"
      resource="/patient/appointments"
      searchPlaceholder="Search appointments by patient, provider, or reason..."
      columns={columns}
      fields={fields}
    />
  );
}

// ============================================================
// Medical Records tab
// ============================================================

interface MedicalRecordRow extends Record<string, unknown> {
  id: string;
  visitDate: string;
  diagnosis: string | null;
  followUpDate: string | null;
  createdAt: string;
  patient: { firstName: string; lastName: string } | null;
  provider: { firstName: string; lastName: string } | null;
}

function MedicalRecordsTab() {
  const columns: Column<MedicalRecordRow>[] = [
    { key: "patient", header: "Patient", render: (r) => personName(r.patient) },
    { key: "provider", header: "Provider", render: (r) => personName(r.provider) },
    { key: "visitDate", header: "Visit date", sortable: true, render: (r) => formatDate(r.visitDate) },
    { key: "diagnosis", header: "Diagnosis", render: (r) => r.diagnosis ?? "—" },
    { key: "followUpDate", header: "Follow-up", render: (r) => formatDate(r.followUpDate) },
  ];

  const fields: FieldDef[] = [
    { name: "patientId", label: "Patient", type: "select", required: true, optionsEndpoint: "/patient/patients" },
    { name: "providerId", label: "Provider", type: "select", required: true, optionsEndpoint: "/patient/providers" },
    { name: "visitDate", label: "Visit date", type: "date", required: true },
    { name: "chiefComplaint", label: "Chief complaint", type: "textarea" },
    { name: "examinationFindings", label: "Examination findings", type: "textarea" },
    { name: "diagnosis", label: "Diagnosis", type: "textarea" },
    { name: "treatmentPlan", label: "Treatment plan", type: "textarea" },
    { name: "followUpDate", label: "Follow-up date", type: "date" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <EntityCrudPage<MedicalRecordRow>
      title="Medical Records"
      description="Visit notes — locked from edits 24 hours after creation for audit integrity"
      resource="/patient/medical-records"
      searchPlaceholder="Search records by patient, diagnosis, or notes..."
      columns={columns}
      fields={fields}
    />
  );
}

// ============================================================
// Prescriptions tab
// ============================================================

interface PrescriptionRow extends Record<string, unknown> {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate: string | null;
  refillsRemaining: number;
  patient: { firstName: string; lastName: string } | null;
  prescribingProvider: { firstName: string; lastName: string } | null;
}

const PRESCRIPTION_FREQUENCY_OPTIONS = [
  { value: "once_daily", label: "Once daily" },
  { value: "twice_daily", label: "Twice daily" },
  { value: "three_times_daily", label: "Three times daily" },
  { value: "as_needed", label: "As needed" },
];

function PrescriptionsTab() {
  const columns: Column<PrescriptionRow>[] = [
    { key: "patient", header: "Patient", render: (r) => personName(r.patient) },
    { key: "medicationName", header: "Medication", sortable: true },
    { key: "dosage", header: "Dosage" },
    { key: "frequency", header: "Frequency", render: (r) => titleCase(r.frequency) },
    { key: "startDate", header: "Start", sortable: true, render: (r) => formatDate(r.startDate) },
    { key: "endDate", header: "End", render: (r) => formatDate(r.endDate) },
    { key: "refillsRemaining", header: "Refills left" },
  ];

  const fields: FieldDef[] = [
    { name: "patientId", label: "Patient", type: "select", required: true, optionsEndpoint: "/patient/patients" },
    { name: "medicationName", label: "Medication name", type: "text", required: true },
    { name: "dosage", label: "Dosage", type: "text", required: true, placeholder: "e.g. 500mg" },
    { name: "frequency", label: "Frequency", type: "select", required: true, options: PRESCRIPTION_FREQUENCY_OPTIONS },
    { name: "startDate", label: "Start date", type: "date", required: true },
    { name: "endDate", label: "End date", type: "date" },
    { name: "refillsRemaining", label: "Refills remaining", type: "number", placeholder: "0" },
    { name: "prescribingProviderId", label: "Prescribing provider", type: "select", required: true, optionsEndpoint: "/patient/providers" },
    { name: "specialInstructions", label: "Special instructions", type: "textarea" },
  ];

  return (
    <EntityCrudPage<PrescriptionRow>
      title="Prescriptions"
      description="A prescription that matches a documented patient allergy is blocked outright"
      resource="/patient/prescriptions"
      searchPlaceholder="Search prescriptions by medication or patient..."
      columns={columns}
      fields={fields}
    />
  );
}

// ============================================================
// Vitals tab
// ============================================================

interface VitalSignRow extends Record<string, unknown> {
  id: string;
  visitDate: string;
  bloodPressure: string | null;
  heartRate: number | null;
  temperature: string | number | null;
  weight: string | number | null;
  height: string | number | null;
  bmi: string | number | null;
  patient: { firstName: string; lastName: string } | null;
}

function VitalsTab() {
  const columns: Column<VitalSignRow>[] = [
    { key: "patient", header: "Patient", render: (r) => personName(r.patient) },
    { key: "visitDate", header: "Visit date", sortable: true, render: (r) => formatDate(r.visitDate) },
    { key: "bloodPressure", header: "BP", render: (r) => r.bloodPressure ?? "—" },
    { key: "heartRate", header: "HR", render: (r) => (r.heartRate != null ? `${r.heartRate} bpm` : "—") },
    { key: "temperature", header: "Temp", render: (r) => (r.temperature != null ? `${r.temperature}°C` : "—") },
    { key: "weight", header: "Weight", render: (r) => (r.weight != null ? `${r.weight} kg` : "—") },
    { key: "bmi", header: "BMI", render: (r) => r.bmi ?? "—" },
  ];

  const fields: FieldDef[] = [
    { name: "patientId", label: "Patient", type: "select", required: true, optionsEndpoint: "/patient/patients" },
    { name: "visitDate", label: "Visit date", type: "date", required: true },
    { name: "bloodPressure", label: "Blood pressure", type: "text", placeholder: "120/80" },
    { name: "heartRate", label: "Heart rate (bpm)", type: "number" },
    { name: "temperature", label: "Temperature (°C)", type: "number", step: "0.1" },
    { name: "weight", label: "Weight (kg)", type: "number", step: "0.1" },
    { name: "height", label: "Height (cm)", type: "number", step: "0.1" },
    { name: "bmi", label: "BMI", type: "number", step: "0.1", hint: "Auto-calculated from weight & height if left blank" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <EntityCrudPage<VitalSignRow>
      title="Vital Signs"
      description="BMI is calculated automatically from weight and height unless entered directly"
      resource="/patient/vitals"
      searchPlaceholder="Search vitals by patient or notes..."
      columns={columns}
      fields={fields}
    />
  );
}

// ============================================================
// Lab Results tab
// ============================================================

interface LabResultRow extends Record<string, unknown> {
  id: string;
  testName: string;
  testDate: string;
  resultValue: string | null;
  referenceRange: string | null;
  unit: string | null;
  status: string;
  patient: { firstName: string; lastName: string } | null;
}

const LAB_STATUS_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "abnormal", label: "Abnormal" },
  { value: "critical", label: "Critical" },
];

function LabResultsTab() {
  const columns: Column<LabResultRow>[] = [
    { key: "patient", header: "Patient", render: (r) => personName(r.patient) },
    { key: "testName", header: "Test", sortable: true },
    { key: "testDate", header: "Date", sortable: true, render: (r) => formatDate(r.testDate) },
    { key: "resultValue", header: "Result", render: (r) => `${r.resultValue ?? "—"}${r.unit ? ` ${r.unit}` : ""}` },
    { key: "referenceRange", header: "Reference range", render: (r) => r.referenceRange ?? "—" },
    { key: "status", header: "Status", sortable: true, render: (r) => <StatusBadge value={r.status} /> },
  ];

  const fields: FieldDef[] = [
    { name: "patientId", label: "Patient", type: "select", required: true, optionsEndpoint: "/patient/patients" },
    { name: "testName", label: "Test name", type: "text", required: true },
    { name: "testDate", label: "Test date", type: "date", required: true },
    { name: "resultValue", label: "Result value", type: "text" },
    { name: "referenceRange", label: "Reference range", type: "text" },
    { name: "unit", label: "Unit", type: "text" },
    { name: "status", label: "Status", type: "select", options: LAB_STATUS_OPTIONS, hint: "Defaults to Normal if left unset" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <EntityCrudPage<LabResultRow>
      title="Lab Results"
      description="Lab test results — the dashboard flags abnormal/critical results from the last 7 days"
      resource="/patient/lab-results"
      searchPlaceholder="Search lab results by test name or patient..."
      columns={columns}
      fields={fields}
    />
  );
}

// ============================================================
// Insurance tab
// ============================================================

interface InsuranceRow extends Record<string, unknown> {
  id: string;
  providerName: string | null;
  policyNumber: string | null;
  groupNumber: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  patient: { firstName: string; lastName: string } | null;
}

function InsuranceTab() {
  const columns: Column<InsuranceRow>[] = [
    { key: "patient", header: "Patient", render: (r) => personName(r.patient) },
    { key: "providerName", header: "Provider", render: (r) => r.providerName ?? "—" },
    { key: "policyNumber", header: "Policy #", render: (r) => r.policyNumber ?? "—" },
    { key: "groupNumber", header: "Group #", render: (r) => r.groupNumber ?? "—" },
    { key: "effectiveDate", header: "Effective", sortable: true, render: (r) => formatDate(r.effectiveDate) },
    { key: "expirationDate", header: "Expires", render: (r) => formatDate(r.expirationDate) },
  ];

  const fields: FieldDef[] = [
    { name: "patientId", label: "Patient", type: "select", required: true, optionsEndpoint: "/patient/patients" },
    { name: "providerName", label: "Insurance provider", type: "text" },
    { name: "policyNumber", label: "Policy number", type: "text" },
    { name: "groupNumber", label: "Group number", type: "text" },
    { name: "effectiveDate", label: "Effective date", type: "date" },
    { name: "expirationDate", label: "Expiration date", type: "date" },
  ];

  return (
    <EntityCrudPage<InsuranceRow>
      title="Insurance"
      description="Coverage on file for each patient"
      resource="/patient/insurance"
      searchPlaceholder="Search insurance by provider, policy #, or patient..."
      columns={columns}
      fields={fields}
    />
  );
}

// ============================================================
// Billing tab
// ============================================================

interface BillingRow extends Record<string, unknown> {
  id: string;
  amountCharged: string | number;
  insuranceClaimStatus: string;
  patientResponsibility: string | number | null;
  paidDate: string | null;
  paymentMethod: string | null;
  patient: { firstName: string; lastName: string } | null;
}

const CLAIM_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
];

function BillingTab() {
  const columns: Column<BillingRow>[] = [
    { key: "patient", header: "Patient", render: (r) => personName(r.patient) },
    { key: "amountCharged", header: "Amount", sortable: true, render: (r) => formatCurrency(r.amountCharged) },
    { key: "insuranceClaimStatus", header: "Claim status", sortable: true, render: (r) => <StatusBadge value={r.insuranceClaimStatus} /> },
    { key: "patientResponsibility", header: "Patient resp.", render: (r) => (r.patientResponsibility != null ? formatCurrency(r.patientResponsibility) : "—") },
    { key: "paidDate", header: "Paid date", render: (r) => formatDate(r.paidDate) },
    { key: "paymentMethod", header: "Method", render: (r) => r.paymentMethod ?? "—" },
  ];

  const fields: FieldDef[] = [
    { name: "patientId", label: "Patient", type: "select", required: true, optionsEndpoint: "/patient/patients" },
    { name: "appointmentId", label: "Related appointment", type: "select", optionsEndpoint: "/patient/appointments", mapOption: appointmentOptionMapper },
    { name: "amountCharged", label: "Amount charged", type: "number", step: "0.01", required: true },
    { name: "insuranceClaimStatus", label: "Insurance claim status", type: "select", options: CLAIM_STATUS_OPTIONS },
    { name: "patientResponsibility", label: "Patient responsibility", type: "number", step: "0.01" },
    { name: "paidDate", label: "Paid date", type: "date" },
    { name: "paymentMethod", label: "Payment method", type: "text" },
  ];

  return (
    <EntityCrudPage<BillingRow>
      title="Billing"
      description="Charges, insurance claim status, and patient responsibility"
      resource="/patient/billing"
      searchPlaceholder="Search billing by patient or payment method..."
      columns={columns}
      fields={fields}
    />
  );
}

// ============================================================
// Hospital staff tab
// ============================================================

interface StaffRow extends Record<string, unknown> {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
}

function StaffTab() {
  const { show } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const columns: Column<StaffRow>[] = [
    { key: "firstName", header: "Name", sortable: true, render: (r) => `${r.firstName} ${r.lastName}` },
    { key: "role", header: "Role", sortable: true },
    { key: "department", header: "Department", render: (r) => r.department ?? "—" },
    { key: "email", header: "Email", render: (r) => r.email ?? "—" },
    { key: "phone", header: "Phone", render: (r) => r.phone ?? "—" },
    {
      key: "active",
      header: "Status",
      render: (r) => (
        <span className={cn("aurora-badge", r.active ? "border-aurora-success/40 text-aurora-success" : "border-black/20 text-aurora-text/50")}>
          {r.active ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  const fields: FieldDef[] = [
    { name: "firstName", label: "First name", type: "text", required: true },
    { name: "lastName", label: "Last name", type: "text", required: true },
    { name: "role", label: "Role", type: "text", required: true, placeholder: "Nurse, Surgeon, Technician..." },
    { name: "department", label: "Department", type: "text" },
    { name: "email", label: "Email", type: "email" },
    { name: "phone", label: "Phone", type: "text" },
    { name: "active", label: "Active", type: "checkbox" },
  ];

  const handleToggleCheckIn = async (row: StaffRow) => {
    setBusyId(row.id);
    try {
      await api.post(`/patient/staff/${row.id}/check-in`);
      show(`${row.firstName} checked in`, "success");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        try {
          await api.post(`/patient/staff/${row.id}/check-out`);
          show(`${row.firstName} checked out`, "success");
        } catch (err2) {
          show(getApiErrorMessage(err2, "Failed to check out"), "error");
        }
      } else {
        show(getApiErrorMessage(err, "Failed to check in"), "error");
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <EntityCrudPage<StaffRow>
      title="Hospital Staff"
      description="Nurses, surgeons, and technicians — click check-in to clock a shift, click again to clock out"
      resource="/patient/staff"
      searchPlaceholder="Search staff by name, role, or department..."
      columns={columns}
      fields={fields}
      rowActions={(row) => (
        <button
          onClick={() => handleToggleCheckIn(row)}
          disabled={busyId === row.id}
          className="rounded-lg p-1.5 text-aurora-text/60 transition hover:bg-black/10 hover:text-aurora-accent disabled:opacity-40"
          aria-label="Toggle check-in"
          title="Check in / check out"
        >
          <Clock size={16} />
        </button>
      )}
    />
  );
}

// ============================================================
// Shifts tab
// ============================================================

interface ShiftRow extends Record<string, unknown> {
  id: string;
  startTime: string;
  endTime: string;
  department: string | null;
  status: string;
  staff: { firstName: string; lastName: string } | null;
}

const SHIFT_STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "missed", label: "Missed" },
];

function ShiftsTab() {
  const columns: Column<ShiftRow>[] = [
    { key: "staff", header: "Staff", render: (r) => personName(r.staff) },
    { key: "startTime", header: "Start", sortable: true, render: (r) => formatDateTime(r.startTime) },
    { key: "endTime", header: "End", render: (r) => formatDateTime(r.endTime) },
    { key: "department", header: "Department", render: (r) => r.department ?? "—" },
    { key: "status", header: "Status", sortable: true, render: (r) => <StatusBadge value={r.status} /> },
  ];

  const fields: FieldDef[] = [
    { name: "staffId", label: "Staff member", type: "select", required: true, optionsEndpoint: "/patient/staff" },
    { name: "startTime", label: "Start", type: "datetime-local", required: true },
    { name: "endTime", label: "End", type: "datetime-local", required: true },
    { name: "department", label: "Department", type: "text" },
    { name: "status", label: "Status", type: "select", options: SHIFT_STATUS_OPTIONS },
  ];

  return (
    <EntityCrudPage<ShiftRow>
      title="Shift Scheduling"
      description="Who's working when"
      resource="/patient/shifts"
      searchPlaceholder="Search shifts by staff or department..."
      columns={columns}
      fields={fields}
    />
  );
}

// ============================================================
// Surgery tab
// ============================================================

interface SurgeryRow extends Record<string, unknown> {
  id: string;
  procedure: string;
  operatingRoom: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  patient: { firstName: string; lastName: string } | null;
  surgeon: { firstName: string; lastName: string } | null;
}

const SURGERY_STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function SurgeryTab() {
  const columns: Column<SurgeryRow>[] = [
    { key: "patient", header: "Patient", render: (r) => personName(r.patient) },
    { key: "procedure", header: "Procedure", sortable: true },
    { key: "surgeon", header: "Surgeon", render: (r) => (r.surgeon ? `Dr. ${r.surgeon.lastName}` : "—") },
    { key: "operatingRoom", header: "OR", render: (r) => r.operatingRoom ?? "—" },
    { key: "scheduledStart", header: "Scheduled", sortable: true, render: (r) => formatDateTime(r.scheduledStart) },
    { key: "status", header: "Status", sortable: true, render: (r) => <StatusBadge value={r.status} /> },
  ];

  const fields: FieldDef[] = [
    { name: "patientId", label: "Patient", type: "select", required: true, optionsEndpoint: "/patient/patients" },
    { name: "surgeonId", label: "Surgeon", type: "select", required: true, optionsEndpoint: "/patient/staff" },
    { name: "procedure", label: "Procedure", type: "text", required: true },
    { name: "operatingRoom", label: "Operating room", type: "text" },
    { name: "scheduledStart", label: "Scheduled start", type: "datetime-local", required: true },
    { name: "scheduledEnd", label: "Scheduled end", type: "datetime-local", required: true },
    { name: "status", label: "Status", type: "select", options: SURGERY_STATUS_OPTIONS },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <EntityCrudPage<SurgeryRow>
      title="Surgery"
      description="Scheduled and in-progress procedures"
      resource="/patient/surgery"
      searchPlaceholder="Search surgery by procedure, OR, or patient..."
      columns={columns}
      fields={fields}
    />
  );
}

// ============================================================
// Root: tab bar + routes
// ============================================================

export default function PatientCRM() {
  return (
    <div className="animate-fade-in flex flex-col gap-5">
      <div>
        <h2>Patient CRM</h2>
        <p className="mt-1 text-sm text-aurora-text/60">Appointments, records, prescriptions, and billing</p>
      </div>

      <Routes>
        <Route index element={<DashboardTab />} />
        <Route path="patients" element={<PatientsTab />} />
        <Route path="patients/chart/:id" element={<PatientChart />} />
        <Route path="providers" element={<ProvidersTab />} />
        <Route path="appointments" element={<AppointmentsTab />} />
        <Route path="medical-records" element={<MedicalRecordsTab />} />
        <Route path="prescriptions" element={<PrescriptionsTab />} />
        <Route path="vitals" element={<VitalsTab />} />
        <Route path="lab-results" element={<LabResultsTab />} />
        <Route path="insurance" element={<InsuranceTab />} />
        <Route path="billing" element={<BillingTab />} />
        <Route path="staff" element={<StaffTab />} />
        <Route path="shifts" element={<ShiftsTab />} />
        <Route path="surgery" element={<SurgeryTab />} />
        <Route path="calendar" element={<PatientCalendar />} />
        <Route path="pipeline" element={<LeadsBoard module="patient" label="Patient" />} />
        <Route path="*" element={<Navigate to="." replace />} />
      </Routes>
    </div>
  );
}
