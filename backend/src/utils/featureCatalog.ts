import type { ModuleName } from "@prisma/client";

/**
 * The toggleable sub-features per module — deliberately just the optional,
 * non-core add-ons (not things like "guests" or "patients" a module is
 * pointless without). Each key is both the FeatureFlag.featureName and the
 * route path segment it gates (see requireFeature() call sites in the
 * module route files).
 */
export const FEATURE_CATALOG: Record<ModuleName, { key: string; label: string }[]> = {
  hotel: [
    { key: "tasks", label: "Staff Tasks" },
    { key: "maintenance", label: "Maintenance" },
    { key: "invoices", label: "Invoices" },
  ],
  student: [
    { key: "attendance", label: "Attendance" },
    { key: "grades", label: "Grades" },
    { key: "tuition", label: "Tuition" },
    { key: "announcements", label: "Announcements" },
  ],
  patient: [
    { key: "vitals", label: "Vitals" },
    { key: "lab-results", label: "Lab Results" },
    { key: "insurance", label: "Insurance" },
    { key: "billing", label: "Billing" },
    { key: "staff", label: "Hospital Staff" },
    { key: "shifts", label: "Shift Scheduling" },
    { key: "surgery", label: "Surgery" },
  ],
  restaurant: [
    { key: "shifts", label: "Staff Shifts" },
    { key: "inventory", label: "Inventory" },
    { key: "reservations", label: "Reservations" },
  ],
};
