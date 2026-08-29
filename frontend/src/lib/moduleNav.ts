import {
  Hotel,
  GraduationCap,
  Stethoscope,
  UtensilsCrossed,
  Users,
  BedDouble,
  CalendarCheck,
  ClipboardList,
  Wrench,
  Receipt,
  Kanban,
  BookOpen,
  Megaphone,
  CalendarClock,
  Pill,
  Activity,
  FlaskConical,
  ShieldCheck,
  UserCheck,
  Archive,
  Table2,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import type { ModuleName } from "@/hooks/useTenant";

export interface ModuleFeature {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const MODULE_META: Record<ModuleName, { label: string; icon: LucideIcon; to: string; description: string }> = {
  hotel: { label: "Hotel", icon: Hotel, to: "/app/hotel", description: "Guests, rooms, reservations, and housekeeping" },
  student: { label: "Student", icon: GraduationCap, to: "/app/student", description: "Classes, attendance, grades, and tuition" },
  patient: { label: "Patient", icon: Stethoscope, to: "/app/patient", description: "Appointments, records, prescriptions, and billing" },
  restaurant: { label: "Restaurant", icon: UtensilsCrossed, to: "/app/restaurant", description: "Orders, menu, staff, and inventory" },
};

// Mirrors each CRM's own routes (see the <Routes> block in HotelCRM.tsx etc.) — the
// single source of truth for both the sidebar's nested nav and the dashboard's
// feature grid, so the two never drift apart.
export const MODULE_FEATURES: Record<ModuleName, ModuleFeature[]> = {
  hotel: [
    { to: "pipeline", label: "Pipeline", icon: Kanban },
    { to: "guests", label: "Guests", icon: Users },
    { to: "rooms", label: "Rooms", icon: BedDouble },
    { to: "reservations", label: "Reservations", icon: CalendarCheck },
    { to: "tasks", label: "Staff Tasks", icon: ClipboardList },
    { to: "maintenance", label: "Maintenance", icon: Wrench },
    { to: "invoices", label: "Invoices", icon: Receipt },
  ],
  student: [
    { to: "pipeline", label: "Pipeline", icon: Kanban },
    { to: "students", label: "Students", icon: Users },
    { to: "classes", label: "Classes", icon: BookOpen },
    { to: "attendance", label: "Attendance", icon: ClipboardCheck },
    { to: "grades", label: "Grades", icon: GraduationCap },
    { to: "tuition", label: "Tuition", icon: Receipt },
    { to: "announcements", label: "Announcements", icon: Megaphone },
  ],
  patient: [
    { to: "pipeline", label: "Pipeline", icon: Kanban },
    { to: "patients", label: "Patients", icon: Users },
    { to: "providers", label: "Providers", icon: Stethoscope },
    { to: "appointments", label: "Appointments", icon: CalendarClock },
    { to: "medical-records", label: "Medical Records", icon: ClipboardList },
    { to: "prescriptions", label: "Prescriptions", icon: Pill },
    { to: "vitals", label: "Vitals", icon: Activity },
    { to: "lab-results", label: "Lab Results", icon: FlaskConical },
    { to: "insurance", label: "Insurance", icon: ShieldCheck },
    { to: "billing", label: "Billing", icon: Receipt },
  ],
  restaurant: [
    { to: "pipeline", label: "Pipeline", icon: Kanban },
    { to: "orders", label: "Orders", icon: ClipboardList },
    { to: "menu", label: "Menu", icon: UtensilsCrossed },
    { to: "customers", label: "Customers", icon: Users },
    { to: "staff", label: "Staff", icon: UserCheck },
    { to: "inventory", label: "Inventory", icon: Archive },
    { to: "tables", label: "Tables", icon: Table2 },
    { to: "reservations", label: "Reservations", icon: CalendarCheck },
  ],
};
