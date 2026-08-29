import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { CalendarCheck, GraduationCap, Users, Wallet } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { cn, formatCurrency, formatDate, titleCase } from "@/lib/utils";
import { EntityCrudPage, type FieldDef } from "@/components/Common/EntityCrudPage";
import { LeadsBoard } from "@/components/Common/LeadsBoard";
import { GlassCard } from "@/components/Common/GlassCard";
import { AuroraButton } from "@/components/Common/AuroraButton";
import { GlassSelect, GlassInput } from "@/components/Common/GlassInput";
import { LoadingSpinner } from "@/components/Common/LoadingSpinner";
import { useToast } from "@/components/Common/Toast";
import type { Column } from "@/components/Common/Table";

// ============================================================
// Shared types
// ============================================================

interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface StudentRow extends Record<string, unknown> {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  enrollmentDate: string;
  status: string;
}

interface InstructorRow extends Record<string, unknown> {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  specialization: string | null;
  hireDate: string | null;
}

interface ClassRow extends Record<string, unknown> {
  id: string;
  courseName: string;
  courseCode: string | null;
  instructorId: string;
  instructor: { firstName: string; lastName: string };
  capacity: number;
  enrolledCount: number;
  pricePerCourse: string | number | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
}

interface EnrollmentRow extends Record<string, unknown> {
  id: string;
  studentId: string;
  classId: string;
  student: { firstName: string; lastName: string };
  class: { courseName: string };
  enrollmentDate: string;
  status: string;
  progressPercentage: number;
}

interface AttendanceRow extends Record<string, unknown> {
  id: string;
  studentId: string;
  classId: string;
  student: { firstName: string; lastName: string };
  class: { courseName: string };
  attendanceDate: string;
  present: boolean;
  notes: string | null;
}

interface GradeRow extends Record<string, unknown> {
  id: string;
  studentId: string;
  classId: string;
  student: { firstName: string; lastName: string };
  class: { courseName: string };
  assignmentName: string | null;
  score: string | number;
  maxScore: string | number;
  weight: number;
  submittedDate: string | null;
}

interface TuitionRow extends Record<string, unknown> {
  id: string;
  studentId: string;
  classId: string;
  student: { firstName: string; lastName: string };
  class: { courseName: string };
  amountDue: string | number;
  amountPaid: string | number;
  dueDate: string;
  paidDate: string | null;
  status: string;
}

interface AnnouncementRow extends Record<string, unknown> {
  id: string;
  title: string;
  content: string;
  audienceType: string;
  targetClassId: string | null;
  targetClass: { courseName: string } | null;
  createdAt: string;
}

interface DashboardData {
  totalActiveStudents: number;
  classesRunning: number;
  attendanceRatePercentage: number;
  pendingTuitionAmount: number;
  upcomingClasses: ClassRow[];
  recentEnrollments: EnrollmentRow[];
  lowAttendanceStudents: { studentId: string; firstName: string; lastName: string; attendanceRatePercentage: number }[];
}

function classOption(row: Record<string, unknown>): { value: string; label: string } {
  return { value: String(row.id), label: String(row.courseName ?? row.id) };
}

const statusBadgeClass: Record<string, string> = {
  active: "border-aurora-success/40 text-aurora-success",
  paid: "border-aurora-success/40 text-aurora-success",
  completed: "border-aurora-cyan/40 text-aurora-cyan",
  graduated: "border-aurora-cyan/40 text-aurora-cyan",
  inactive: "border-black/20 text-aurora-text/60",
  dropped: "border-black/20 text-aurora-text/60",
  cancelled: "border-black/20 text-aurora-text/60",
  pending: "border-aurora-cyan/40 text-aurora-cyan",
  partial: "border-yellow-400/40 text-yellow-300",
  suspended: "border-aurora-error/40 text-aurora-error",
  overdue: "border-aurora-error/40 text-aurora-error",
};

function StatusBadge({ value }: { value: string }) {
  return <span className={cn("aurora-badge", statusBadgeClass[value] ?? "border-black/20 text-aurora-text/60")}>{titleCase(value)}</span>;
}

// ============================================================
// Tab bar
// ============================================================

const TABS = [
  { to: "", label: "Dashboard", end: true },
  { to: "students", label: "Students" },
  { to: "classes", label: "Classes" },
  { to: "attendance", label: "Attendance" },
  { to: "grades", label: "Grades" },
  { to: "tuition", label: "Tuition" },
  { to: "announcements", label: "Announcements" },
  { to: "pipeline", label: "Pipeline" },
];

function TabBar() {
  return (
    <div className="flex flex-wrap gap-1 border-b border-black/10 pb-1">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            cn(
              "rounded-t-lg px-4 py-2 text-sm font-medium text-aurora-text/60 transition",
              "hover:bg-black/5 hover:text-aurora-text",
              isActive && "bg-white text-aurora-purple shadow-glass",
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}

// ============================================================
// Dashboard tab
// ============================================================

function KpiCard({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: string; hint?: string }) {
  return (
    <GlassCard className="flex items-center gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-aurora-gradient">
        <Icon size={22} />
      </div>
      <div>
        <p className="text-sm text-aurora-text/60">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
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
    void (async () => {
      try {
        const { data: res } = await api.get<DashboardData>("/student/dashboard");
        if (!cancelled) setData(res);
      } catch (err) {
        show(getApiErrorMessage(err, "Failed to load dashboard"), "error");
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
    <div className="animate-fade-in flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Users} label="Active Students" value={String(data.totalActiveStudents)} />
        <KpiCard icon={GraduationCap} label="Classes Running" value={String(data.classesRunning)} />
        <KpiCard icon={CalendarCheck} label="Attendance Rate" value={`${data.attendanceRatePercentage}%`} hint="Last 30 days" />
        <KpiCard icon={Wallet} label="Pending Tuition" value={formatCurrency(data.pendingTuitionAmount)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GlassCard>
          <h3 className="mb-3">Low Attendance Alert</h3>
          {data.lowAttendanceStudents.length === 0 ? (
            <p className="text-sm text-aurora-text/50">No students below 80% attendance in the last 30 days.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.lowAttendanceStudents.map((s) => (
                <li key={s.studentId} className="flex items-center justify-between rounded-lg bg-black/5 px-3 py-2 text-sm">
                  <span>
                    {s.firstName} {s.lastName}
                  </span>
                  <span className="font-semibold text-aurora-error">{s.attendanceRatePercentage}%</span>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard>
          <h3 className="mb-3">Recent Enrollments</h3>
          {data.recentEnrollments.length === 0 ? (
            <p className="text-sm text-aurora-text/50">No enrollments yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.recentEnrollments.map((e) => (
                <li key={e.id} className="flex items-center justify-between rounded-lg bg-black/5 px-3 py-2 text-sm">
                  <span>
                    {e.student.firstName} {e.student.lastName} <span className="text-aurora-text/50">→</span> {e.class.courseName}
                  </span>
                  <StatusBadge value={e.status} />
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>

      <GlassCard>
        <h3 className="mb-3">Upcoming Classes</h3>
        {data.upcomingClasses.length === 0 ? (
          <p className="text-sm text-aurora-text/50">No active classes.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.upcomingClasses.map((c) => (
              <li key={c.id} className="rounded-lg bg-black/5 px-3 py-2 text-sm">
                <p className="font-medium">{c.courseName}</p>
                <p className="text-xs text-aurora-text/50">
                  {c.instructor.firstName} {c.instructor.lastName} · {c.enrolledCount}/{c.capacity} enrolled
                </p>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}

// ============================================================
// Students tab
// ============================================================

const studentStatusOptions = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "graduated", label: "Graduated" },
  { value: "suspended", label: "Suspended" },
];

function StudentsTab() {
  const columns: Column<StudentRow>[] = [
    { key: "firstName", header: "Name", sortable: true, render: (r) => `${r.firstName} ${r.lastName}` },
    { key: "email", header: "Email", render: (r) => r.email ?? "—" },
    { key: "phone", header: "Phone", render: (r) => r.phone ?? "—" },
    { key: "enrollmentDate", header: "Enrolled", sortable: true, render: (r) => formatDate(r.enrollmentDate) },
    { key: "status", header: "Status", sortable: true, render: (r) => <StatusBadge value={r.status} /> },
  ];

  const fields: FieldDef[] = [
    { name: "firstName", label: "First name", type: "text", required: true },
    { name: "lastName", label: "Last name", type: "text", required: true },
    { name: "email", label: "Email", type: "email" },
    { name: "phone", label: "Phone", type: "text" },
    { name: "dateOfBirth", label: "Date of birth", type: "date" },
    { name: "gender", label: "Gender", type: "text" },
    { name: "enrollmentDate", label: "Enrollment date", type: "date", required: true },
    { name: "status", label: "Status", type: "select", options: studentStatusOptions },
    { name: "parentName", label: "Parent/guardian name", type: "text" },
    { name: "parentEmail", label: "Parent/guardian email", type: "email" },
    { name: "parentPhone", label: "Parent/guardian phone", type: "text" },
    { name: "address", label: "Address", type: "textarea" },
  ];

  return (
    <EntityCrudPage<StudentRow>
      title="Students"
      description="Manage enrolled students and their contact details"
      resource="/student/students"
      searchPlaceholder="Search by name, email, or enrollment date (YYYY-MM-DD)..."
      columns={columns}
      fields={fields}
    />
  );
}

// ============================================================
// Classes tab (Classes + Instructors + Enrollments)
// ============================================================

const classStatusOptions = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const enrollmentStatusOptions = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "dropped", label: "Dropped" },
  { value: "suspended", label: "Suspended" },
];

function ClassesSection() {
  const columns: Column<ClassRow>[] = [
    { key: "courseName", header: "Course", sortable: true },
    { key: "courseCode", header: "Code", render: (r) => r.courseCode ?? "—" },
    { key: "instructor", header: "Instructor", render: (r) => `${r.instructor.firstName} ${r.instructor.lastName}` },
    { key: "enrolledCount", header: "Enrolled", sortable: true, render: (r) => `${r.enrolledCount}/${r.capacity}` },
    { key: "pricePerCourse", header: "Price", render: (r) => (r.pricePerCourse === null ? "—" : formatCurrency(r.pricePerCourse)) },
    { key: "status", header: "Status", sortable: true, render: (r) => <StatusBadge value={r.status} /> },
  ];

  const fields: FieldDef[] = [
    { name: "courseName", label: "Course name", type: "text", required: true },
    { name: "courseCode", label: "Course code", type: "text" },
    { name: "instructorId", label: "Instructor", type: "select", required: true, optionsEndpoint: "/student/instructors" },
    { name: "capacity", label: "Capacity", type: "number", required: true },
    { name: "pricePerCourse", label: "Price per course", type: "number", step: "0.01" },
    { name: "startDate", label: "Start date", type: "date" },
    { name: "endDate", label: "End date", type: "date" },
    { name: "status", label: "Status", type: "select", options: classStatusOptions },
    { name: "description", label: "Description", type: "textarea" },
  ];

  return (
    <EntityCrudPage<ClassRow>
      title="Classes"
      description="Manage courses, capacity, and pricing"
      resource="/student/classes"
      searchPlaceholder="Search by course name or code..."
      columns={columns}
      fields={fields}
    />
  );
}

function InstructorsSection() {
  const columns: Column<InstructorRow>[] = [
    { key: "firstName", header: "Name", sortable: true, render: (r) => `${r.firstName} ${r.lastName}` },
    { key: "email", header: "Email", render: (r) => r.email ?? "—" },
    { key: "phone", header: "Phone", render: (r) => r.phone ?? "—" },
    { key: "specialization", header: "Specialization", render: (r) => r.specialization ?? "—" },
    { key: "hireDate", header: "Hired", render: (r) => formatDate(r.hireDate) },
  ];

  const fields: FieldDef[] = [
    { name: "firstName", label: "First name", type: "text", required: true },
    { name: "lastName", label: "Last name", type: "text", required: true },
    { name: "email", label: "Email", type: "email" },
    { name: "phone", label: "Phone", type: "text" },
    { name: "specialization", label: "Specialization", type: "text" },
    { name: "hireDate", label: "Hire date", type: "date" },
    { name: "bio", label: "Bio", type: "textarea" },
  ];

  return (
    <EntityCrudPage<InstructorRow>
      title="Instructors"
      description="Manage teaching staff"
      resource="/student/instructors"
      searchPlaceholder="Search by name, email, or specialization..."
      columns={columns}
      fields={fields}
    />
  );
}

function EnrollmentsSection() {
  const columns: Column<EnrollmentRow>[] = [
    { key: "student", header: "Student", render: (r) => `${r.student.firstName} ${r.student.lastName}` },
    { key: "class", header: "Class", render: (r) => r.class.courseName },
    { key: "enrollmentDate", header: "Enrolled", sortable: true, render: (r) => formatDate(r.enrollmentDate) },
    { key: "progressPercentage", header: "Progress", sortable: true, render: (r) => `${r.progressPercentage}%` },
    { key: "status", header: "Status", sortable: true, render: (r) => <StatusBadge value={r.status} /> },
  ];

  const fields: FieldDef[] = [
    { name: "studentId", label: "Student", type: "select", required: true, optionsEndpoint: "/student/students" },
    { name: "classId", label: "Class", type: "select", required: true, optionsEndpoint: "/student/classes", mapOption: classOption },
    { name: "enrollmentDate", label: "Enrollment date", type: "date", required: true },
    { name: "status", label: "Status", type: "select", options: enrollmentStatusOptions },
    { name: "progressPercentage", label: "Progress %", type: "number" },
  ];

  return (
    <EntityCrudPage<EnrollmentRow>
      title="Enrollments"
      description="Enroll students into classes (capacity enforced automatically)"
      resource="/student/enrollments"
      searchPlaceholder="Search by student or class name..."
      columns={columns}
      fields={fields}
    />
  );
}

function ClassesTab() {
  const [section, setSection] = useState<"classes" | "instructors" | "enrollments">("classes");

  return (
    <div className="animate-fade-in flex flex-col gap-5">
      <div className="flex gap-2">
        {(["classes", "instructors", "enrollments"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              section === s ? "bg-aurora-gradient text-white" : "bg-black/5 text-aurora-text/60 hover:bg-black/10",
            )}
          >
            {titleCase(s)}
          </button>
        ))}
      </div>
      {section === "classes" && <ClassesSection />}
      {section === "instructors" && <InstructorsSection />}
      {section === "enrollments" && <EnrollmentsSection />}
    </div>
  );
}

// ============================================================
// Attendance tab
// ============================================================

function AttendanceMarking() {
  const { show } = useToast();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [roster, setRoster] = useState<{ studentId: string; name: string; present: boolean }[]>([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await api.get<PaginatedResponse<ClassRow>>("/student/classes", { params: { pageSize: 200 } });
        setClasses(data.data);
      } catch (err) {
        show(getApiErrorMessage(err, "Failed to load classes"), "error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRoster = useCallback(async () => {
    if (!classId) {
      setRoster([]);
      return;
    }
    setIsLoadingRoster(true);
    try {
      const { data } = await api.get<PaginatedResponse<EnrollmentRow>>("/student/enrollments", { params: { pageSize: 200 } });
      const enrolled = data.data.filter((e) => e.classId === classId && e.status === "active");
      setRoster(enrolled.map((e) => ({ studentId: e.studentId, name: `${e.student.firstName} ${e.student.lastName}`, present: true })));
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to load class roster"), "error");
    } finally {
      setIsLoadingRoster(false);
    }
  }, [classId, show]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  const classOptions = useMemo(() => classes.map(classOption), [classes]);

  const togglePresent = (studentId: string) => {
    setRoster((prev) => prev.map((r) => (r.studentId === studentId ? { ...r, present: !r.present } : r)));
  };

  const handleSubmit = async () => {
    if (!classId || roster.length === 0) return;
    setIsSaving(true);
    try {
      await api.post("/student/attendance/bulk", {
        classId,
        date,
        records: roster.map((r) => ({ studentId: r.studentId, present: r.present })),
      });
      show("Attendance recorded", "success");
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to save attendance"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <GlassCard className="flex flex-col gap-4">
      <h3>Mark Attendance</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <GlassSelect label="Class" options={classOptions} placeholder="Select a class" value={classId} onChange={(e) => setClassId(e.target.value)} />
        <GlassInput label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {isLoadingRoster ? (
        <LoadingSpinner />
      ) : !classId ? (
        <p className="text-sm text-aurora-text/50">Select a class to load its enrolled students.</p>
      ) : roster.length === 0 ? (
        <p className="text-sm text-aurora-text/50">No actively enrolled students in this class.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {roster.map((r) => (
            <div key={r.studentId} className="flex items-center justify-between rounded-lg bg-black/5 px-3 py-2">
              <span className="text-sm">{r.name}</span>
              <button
                onClick={() => togglePresent(r.studentId)}
                className={cn(
                  "rounded-lg px-3 py-1 text-xs font-semibold transition",
                  r.present ? "bg-aurora-success/20 text-aurora-success" : "bg-aurora-error/20 text-aurora-error",
                )}
              >
                {r.present ? "Present" : "Absent"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <AuroraButton isLoading={isSaving} disabled={!classId || roster.length === 0} onClick={handleSubmit}>
          Save Attendance
        </AuroraButton>
      </div>
    </GlassCard>
  );
}

function AttendanceTab() {
  const columns: Column<AttendanceRow>[] = [
    { key: "student", header: "Student", render: (r) => `${r.student.firstName} ${r.student.lastName}` },
    { key: "class", header: "Class", render: (r) => r.class.courseName },
    { key: "attendanceDate", header: "Date", sortable: true, render: (r) => formatDate(r.attendanceDate) },
    {
      key: "present",
      header: "Present",
      sortable: true,
      render: (r) => (
        <span className={cn("aurora-badge", r.present ? "border-aurora-success/40 text-aurora-success" : "border-aurora-error/40 text-aurora-error")}>
          {r.present ? "Present" : "Absent"}
        </span>
      ),
    },
    { key: "notes", header: "Notes", render: (r) => r.notes ?? "—" },
  ];

  const fields: FieldDef[] = [
    { name: "studentId", label: "Student", type: "select", required: true, optionsEndpoint: "/student/students" },
    { name: "classId", label: "Class", type: "select", required: true, optionsEndpoint: "/student/classes", mapOption: classOption },
    { name: "attendanceDate", label: "Date", type: "date", required: true },
    { name: "present", label: "Present", type: "checkbox" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <AttendanceMarking />
      <EntityCrudPage<AttendanceRow>
        title="Attendance Records"
        description="Browse and edit individual attendance entries"
        resource="/student/attendance"
        searchPlaceholder="Search by student or class name..."
        columns={columns}
        fields={fields}
      />
    </div>
  );
}

// ============================================================
// Grades tab
// ============================================================

function GradesSummaryPanel() {
  const { show } = useToast();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentId, setStudentId] = useState("");
  const [summary, setSummary] = useState<{ averagePercentage: number; count: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await api.get<PaginatedResponse<StudentRow>>("/student/students", { params: { pageSize: 200 } });
        setStudents(data.data);
      } catch (err) {
        show(getApiErrorMessage(err, "Failed to load students"), "error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!studentId) {
      setSummary(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    void (async () => {
      try {
        const { data } = await api.get<{ averagePercentage: number; count: number }>("/student/grades/summary", { params: { studentId } });
        if (!cancelled) setSummary(data);
      } catch (err) {
        if (!cancelled) show(getApiErrorMessage(err, "Failed to load grade summary"), "error");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const studentOptions = useMemo(
    () => students.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` })),
    [students],
  );

  return (
    <GlassCard className="flex flex-col gap-4">
      <h3>Grade Summary</h3>
      <GlassSelect label="Student" options={studentOptions} placeholder="Select a student" value={studentId} onChange={(e) => setStudentId(e.target.value)} />
      {isLoading ? (
        <LoadingSpinner />
      ) : studentId && summary ? (
        <div className="flex gap-6">
          <div>
            <p className="text-sm text-aurora-text/60">Weighted Average</p>
            <p className="text-2xl font-bold">{summary.averagePercentage}%</p>
          </div>
          <div>
            <p className="text-sm text-aurora-text/60">Graded Assignments</p>
            <p className="text-2xl font-bold">{summary.count}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-aurora-text/50">Select a student to view their grade summary.</p>
      )}
    </GlassCard>
  );
}

function GradesTab() {
  const columns: Column<GradeRow>[] = [
    { key: "student", header: "Student", render: (r) => `${r.student.firstName} ${r.student.lastName}` },
    { key: "class", header: "Class", render: (r) => r.class.courseName },
    { key: "assignmentName", header: "Assignment", render: (r) => r.assignmentName ?? "—" },
    { key: "score", header: "Score", sortable: true, render: (r) => `${r.score}/${r.maxScore}` },
    { key: "weight", header: "Weight", render: (r) => String(r.weight) },
    { key: "submittedDate", header: "Submitted", render: (r) => formatDate(r.submittedDate) },
  ];

  const fields: FieldDef[] = [
    { name: "studentId", label: "Student", type: "select", required: true, optionsEndpoint: "/student/students" },
    { name: "classId", label: "Class", type: "select", required: true, optionsEndpoint: "/student/classes", mapOption: classOption },
    { name: "assignmentName", label: "Assignment name", type: "text" },
    { name: "score", label: "Score", type: "number", required: true, step: "0.01" },
    { name: "maxScore", label: "Max score", type: "number", required: true, step: "0.01" },
    { name: "weight", label: "Weight", type: "number" },
    { name: "submittedDate", label: "Submitted date", type: "date" },
    { name: "comments", label: "Comments", type: "textarea" },
  ];

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <GradesSummaryPanel />
      <EntityCrudPage<GradeRow>
        title="Grades"
        description="Record and review assignment scores"
        resource="/student/grades"
        searchPlaceholder="Search by student, class, or assignment..."
        columns={columns}
        fields={fields}
      />
    </div>
  );
}

// ============================================================
// Tuition tab
// ============================================================

function TuitionTab() {
  const columns: Column<TuitionRow>[] = [
    { key: "student", header: "Student", render: (r) => `${r.student.firstName} ${r.student.lastName}` },
    { key: "class", header: "Class", render: (r) => r.class.courseName },
    { key: "amountDue", header: "Amount Due", sortable: true, render: (r) => formatCurrency(r.amountDue) },
    { key: "amountPaid", header: "Amount Paid", render: (r) => formatCurrency(r.amountPaid) },
    { key: "dueDate", header: "Due Date", sortable: true, render: (r) => formatDate(r.dueDate) },
    { key: "status", header: "Status", sortable: true, render: (r) => <StatusBadge value={r.status} /> },
  ];

  const fields: FieldDef[] = [
    { name: "studentId", label: "Student", type: "select", required: true, optionsEndpoint: "/student/students" },
    { name: "classId", label: "Class", type: "select", required: true, optionsEndpoint: "/student/classes", mapOption: classOption },
    { name: "amountDue", label: "Amount due", type: "number", required: true, step: "0.01" },
    { name: "amountPaid", label: "Amount paid", type: "number", step: "0.01" },
    { name: "dueDate", label: "Due date", type: "date", required: true },
    { name: "paidDate", label: "Paid date", type: "date" },
    { name: "paymentMethod", label: "Payment method", type: "text" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <EntityCrudPage<TuitionRow>
      title="Tuition"
      description="Track tuition balances — status is computed automatically from amounts and due dates"
      resource="/student/tuition"
      searchPlaceholder="Search by student or class name..."
      columns={columns}
      fields={fields}
    />
  );
}

// ============================================================
// Announcements tab
// ============================================================

const audienceOptions = [
  { value: "all_students", label: "All Students" },
  { value: "class_specific", label: "Class Specific" },
  { value: "instructor_only", label: "Instructor Only" },
];

function AnnouncementsTab() {
  const columns: Column<AnnouncementRow>[] = [
    { key: "title", header: "Title", sortable: true },
    { key: "audienceType", header: "Audience", sortable: true, render: (r) => titleCase(r.audienceType) },
    { key: "targetClass", header: "Target Class", render: (r) => r.targetClass?.courseName ?? "—" },
    { key: "createdAt", header: "Posted", render: (r) => formatDate(r.createdAt) },
  ];

  const fields: FieldDef[] = [
    { name: "title", label: "Title", type: "text", required: true },
    { name: "audienceType", label: "Audience", type: "select", required: true, options: audienceOptions },
    { name: "targetClassId", label: "Target class", type: "select", optionsEndpoint: "/student/classes", mapOption: classOption, hint: "Required for class-specific announcements" },
    { name: "content", label: "Content", type: "textarea", required: true },
  ];

  return (
    <EntityCrudPage<AnnouncementRow>
      title="Announcements"
      description="Post updates to students, classes, or instructors"
      resource="/student/announcements"
      searchPlaceholder="Search by title or content..."
      columns={columns}
      fields={fields}
    />
  );
}

// ============================================================
// Root
// ============================================================

export default function StudentCRM() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2>Student CRM</h2>
        <p className="mt-1 text-sm text-aurora-text/60">Classes, attendance, grades, and tuition</p>
      </div>
      <TabBar />
      <Routes>
        <Route index element={<DashboardTab />} />
        <Route path="students" element={<StudentsTab />} />
        <Route path="classes" element={<ClassesTab />} />
        <Route path="attendance" element={<AttendanceTab />} />
        <Route path="grades" element={<GradesTab />} />
        <Route path="tuition" element={<TuitionTab />} />
        <Route path="announcements" element={<AnnouncementsTab />} />
        <Route path="pipeline" element={<LeadsBoard module="student" label="Student" />} />
      </Routes>
    </div>
  );
}
