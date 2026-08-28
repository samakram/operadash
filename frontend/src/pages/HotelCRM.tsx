import { useEffect, useRef, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import {
  LayoutGrid,
  Users,
  BedDouble,
  CalendarCheck,
  ClipboardList,
  Wrench,
  Receipt,
  Percent,
  DollarSign,
  UserCheck,
  AlertTriangle,
} from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { GlassCard } from "@/components/Common/GlassCard";
import { LoadingSpinner } from "@/components/Common/LoadingSpinner";
import { useToast } from "@/components/Common/Toast";
import { EntityCrudPage, type FieldDef } from "@/components/Common/EntityCrudPage";
import type { Column } from "@/components/Common/Table";
import { cn, formatCurrency, formatDate, titleCase } from "@/lib/utils";

// ============================================================
// Shared display helpers
// ============================================================

const STATUS_BADGE_STYLES: Record<string, string> = {
  vacant: "border-aurora-success/40 text-aurora-success",
  occupied: "border-aurora-cyan/40 text-aurora-cyan",
  cleaning: "border-aurora-warning/40 text-aurora-warning",
  maintenance: "border-aurora-error/40 text-aurora-error",
  pending: "border-aurora-warning/40 text-aurora-warning",
  in_progress: "border-aurora-cyan/40 text-aurora-cyan",
  completed: "border-aurora-success/40 text-aurora-success",
  open: "border-aurora-error/40 text-aurora-error",
  closed: "border-aurora-success/40 text-aurora-success",
  low: "border-black/20 text-aurora-text/70",
  medium: "border-aurora-cyan/40 text-aurora-cyan",
  high: "border-aurora-warning/40 text-aurora-warning",
  urgent: "border-aurora-error/40 text-aurora-error",
  unpaid: "border-aurora-error/40 text-aurora-error",
  paid: "border-aurora-success/40 text-aurora-success",
  partial: "border-aurora-warning/40 text-aurora-warning",
  refunded: "border-black/20 text-aurora-text/70",
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

function roomLabel(row: unknown): string {
  const r = row as { roomNumber?: string; roomType?: string } | null | undefined;
  if (!r) return "—";
  return r.roomType ? `${r.roomNumber} (${titleCase(r.roomType)})` : (r.roomNumber ?? "—");
}

function roomOptionMapper(row: Record<string, unknown>): { value: string; label: string } {
  return { value: String(row.id), label: `Room ${String(row.roomNumber)} — ${titleCase(String(row.roomType ?? ""))}` };
}

function reservationOptionMapper(row: Record<string, unknown>): { value: string; label: string } {
  const guest = row.guest as { firstName?: string; lastName?: string } | undefined;
  const room = row.room as { roomNumber?: string } | undefined;
  const checkIn = row.checkIn ? formatDate(row.checkIn as string) : "";
  return { value: String(row.id), label: `${personName(guest)} — Room ${room?.roomNumber ?? "?"} (${checkIn})` };
}

// ============================================================
// Dashboard tab
// ============================================================

interface DashboardReservation {
  id: string;
  checkIn: string;
  checkOut: string;
  totalPrice: number | string;
  paymentStatus: string;
  guest: { firstName: string; lastName: string } | null;
  room: { roomNumber: string; roomType: string } | null;
}

interface StaffOnDuty {
  staffUserId: string;
  staffName: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
}

interface DashboardData {
  occupancyRate: number;
  occupiedRooms: number;
  totalRooms: number;
  revenueToday: number;
  guestsArrivingToday: number;
  maintenanceAlerts: number;
  recentActivity: DashboardReservation[];
  staffOnDuty: StaffOnDuty[];
}

function KpiCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <GlassCard className="flex items-center gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-aurora-gradient">{icon}</div>
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
        const { data: res } = await api.get<DashboardData>("/hotel/dashboard");
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
        <KpiCard icon={<Percent size={20} />} label="Occupancy rate" value={`${data.occupancyRate}%`} hint={`${data.occupiedRooms} of ${data.totalRooms} rooms`} />
        <KpiCard icon={<DollarSign size={20} />} label="Revenue today" value={formatCurrency(data.revenueToday)} />
        <KpiCard icon={<UserCheck size={20} />} label="Guests arriving today" value={String(data.guestsArrivingToday)} />
        <KpiCard icon={<AlertTriangle size={20} />} label="Maintenance alerts" value={String(data.maintenanceAlerts)} hint="Open or in progress" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <GlassCard padding="none">
          <div className="border-b border-black/10 px-6 py-4">
            <h3>Recent activity</h3>
          </div>
          <div className="divide-y divide-black/5">
            {data.recentActivity.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-aurora-text/50">No reservations yet.</p>
            ) : (
              data.recentActivity.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium">{personName(r.guest)}</p>
                    <p className="text-xs text-aurora-text/50">
                      {roomLabel(r.room)} &middot; {formatDate(r.checkIn)} – {formatDate(r.checkOut)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{formatCurrency(r.totalPrice)}</span>
                    <StatusBadge value={r.paymentStatus} />
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>

        <GlassCard padding="none">
          <div className="border-b border-black/10 px-6 py-4">
            <h3>Staff on duty today</h3>
          </div>
          <div className="divide-y divide-black/5">
            {data.staffOnDuty.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-aurora-text/50">No staff assignments scheduled for today.</p>
            ) : (
              data.staffOnDuty.map((s) => (
                <div key={s.staffUserId} className="flex items-center justify-between px-6 py-3">
                  <p className="text-sm font-medium">{s.staffName}</p>
                  <div className="flex items-center gap-2 text-xs text-aurora-text/60">
                    <span className="aurora-badge border-aurora-success/40 text-aurora-success">{s.completedTasks} done</span>
                    <span className="aurora-badge border-aurora-cyan/40 text-aurora-cyan">{s.inProgressTasks} active</span>
                    <span className="aurora-badge border-aurora-warning/40 text-aurora-warning">{s.pendingTasks} pending</span>
                  </div>
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
// Guests tab
// ============================================================

interface GuestRow extends Record<string, unknown> {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  vip: boolean;
}

function GuestsTab() {
  const columns: Column<GuestRow>[] = [
    { key: "firstName", header: "Name", sortable: true, render: (r) => `${r.firstName} ${r.lastName}` },
    { key: "email", header: "Email" },
    { key: "phone", header: "Phone" },
    { key: "checkInDate", header: "Check-in", render: (r) => formatDate(r.checkInDate) },
    { key: "checkOutDate", header: "Check-out", render: (r) => formatDate(r.checkOutDate) },
    {
      key: "vip",
      header: "VIP",
      render: (r) => (r.vip ? <span className="aurora-badge border-aurora-warning/40 text-aurora-warning">VIP</span> : <span className="text-aurora-text/40">—</span>),
    },
  ];

  const fields: FieldDef[] = [
    { name: "firstName", label: "First name", type: "text", required: true },
    { name: "lastName", label: "Last name", type: "text", required: true },
    { name: "email", label: "Email", type: "email" },
    { name: "phone", label: "Phone", type: "text" },
    { name: "address", label: "Address", type: "text" },
    { name: "city", label: "City", type: "text" },
    { name: "country", label: "Country", type: "text" },
    { name: "checkInDate", label: "Check-in date", type: "date" },
    { name: "checkOutDate", label: "Check-out date", type: "date" },
    { name: "vip", label: "VIP guest", type: "checkbox" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <EntityCrudPage<GuestRow>
      title="Guests"
      description="Guest directory for the property"
      resource="/hotel/guests"
      searchPlaceholder="Search guests by name, email, phone, or room..."
      columns={columns}
      fields={fields}
    />
  );
}

// ============================================================
// Rooms tab
// ============================================================

interface RoomRow extends Record<string, unknown> {
  id: string;
  roomNumber: string;
  roomType: string;
  capacity: number;
  pricePerNight: string | number;
  status: string;
  floorNumber: number | null;
  amenities: string[];
  occupiedByGuest: { firstName: string; lastName: string } | null;
}

const ROOM_TYPE_OPTIONS = [
  { value: "single", label: "Single" },
  { value: "double", label: "Double" },
  { value: "suite", label: "Suite" },
  { value: "deluxe", label: "Deluxe" },
];

const ROOM_STATUS_OPTIONS = [
  { value: "vacant", label: "Vacant" },
  { value: "occupied", label: "Occupied" },
  { value: "cleaning", label: "Cleaning" },
  { value: "maintenance", label: "Maintenance" },
];

function RoomsTab() {
  const columns: Column<RoomRow>[] = [
    { key: "roomNumber", header: "Room #", sortable: true },
    { key: "roomType", header: "Type", sortable: true, render: (r) => titleCase(r.roomType) },
    { key: "capacity", header: "Capacity", sortable: true },
    { key: "pricePerNight", header: "Price/night", sortable: true, render: (r) => formatCurrency(r.pricePerNight) },
    { key: "status", header: "Status", sortable: true, render: (r) => <StatusBadge value={r.status} /> },
    { key: "occupiedByGuest", header: "Occupied by", render: (r) => personName(r.occupiedByGuest) },
  ];

  const fields: FieldDef[] = [
    { name: "roomNumber", label: "Room number", type: "text", required: true },
    { name: "roomType", label: "Room type", type: "select", required: true, options: ROOM_TYPE_OPTIONS },
    { name: "capacity", label: "Capacity", type: "number", required: true },
    { name: "pricePerNight", label: "Price per night", type: "number", step: "0.01", required: true },
    { name: "status", label: "Status", type: "select", options: ROOM_STATUS_OPTIONS },
    { name: "floorNumber", label: "Floor number", type: "number" },
    { name: "amenities", label: "Amenities", type: "tags" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <EntityCrudPage<RoomRow>
      title="Rooms"
      description="Room inventory and status"
      resource="/hotel/rooms"
      searchPlaceholder="Search rooms by number or notes..."
      columns={columns}
      fields={fields}
    />
  );
}

// ============================================================
// Reservations tab
// ============================================================

interface ReservationRow extends Record<string, unknown> {
  id: string;
  checkIn: string;
  checkOut: string;
  numberOfNights: number | null;
  totalPrice: string | number;
  paymentStatus: string;
  guest: { firstName: string; lastName: string } | null;
  room: { roomNumber: string; roomType: string } | null;
}

const PAYMENT_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partial" },
  { value: "refunded", label: "Refunded" },
];

function ReservationsTab() {
  const columns: Column<ReservationRow>[] = [
    { key: "guest", header: "Guest", render: (r) => personName(r.guest) },
    { key: "room", header: "Room", render: (r) => roomLabel(r.room) },
    { key: "checkIn", header: "Check-in", sortable: true, render: (r) => formatDate(r.checkIn) },
    { key: "checkOut", header: "Check-out", sortable: true, render: (r) => formatDate(r.checkOut) },
    { key: "numberOfNights", header: "Nights", render: (r) => r.numberOfNights ?? "—" },
    { key: "totalPrice", header: "Total", sortable: true, render: (r) => formatCurrency(r.totalPrice) },
    { key: "paymentStatus", header: "Payment", sortable: true, render: (r) => <StatusBadge value={r.paymentStatus} /> },
  ];

  const fields: FieldDef[] = [
    { name: "guestId", label: "Guest", type: "select", required: true, optionsEndpoint: "/hotel/guests" },
    { name: "roomId", label: "Room", type: "select", required: true, optionsEndpoint: "/hotel/rooms", mapOption: roomOptionMapper },
    { name: "checkIn", label: "Check-in", type: "date", required: true },
    { name: "checkOut", label: "Check-out", type: "date", required: true },
    { name: "paymentStatus", label: "Payment status", type: "select", options: PAYMENT_STATUS_OPTIONS },
    { name: "paymentMethod", label: "Payment method", type: "text" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <EntityCrudPage<ReservationRow>
      title="Reservations"
      description="Bookings across all rooms — nights and total price are calculated automatically"
      resource="/hotel/reservations"
      searchPlaceholder="Search reservations by guest or room..."
      columns={columns}
      fields={fields}
    />
  );
}

// ============================================================
// Staff Tasks tab
// ============================================================

interface TaskRow extends Record<string, unknown> {
  id: string;
  staffUserId: string;
  taskType: string;
  status: string;
  assignedDate: string;
  completedDate: string | null;
  room: { roomNumber: string; roomType: string } | null;
}

const TASK_TYPE_OPTIONS = [
  { value: "cleaning", label: "Cleaning" },
  { value: "maintenance", label: "Maintenance" },
  { value: "check_in", label: "Check-in" },
  { value: "check_out", label: "Check-out" },
];

const TASK_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

function StaffTasksTab() {
  const { show } = useToast();
  const [refreshKey, setRefreshKey] = useState(0);
  const connectedHereRef = useRef(false);

  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
      connectedHereRef.current = true;
    }

    const onTaskUpdated = () => {
      show("A staff task was just updated", "info");
      setRefreshKey((k) => k + 1);
    };
    socket.on("hotel:task-updated", onTaskUpdated);

    return () => {
      socket.off("hotel:task-updated", onTaskUpdated);
      if (connectedHereRef.current) {
        socket.disconnect();
        connectedHereRef.current = false;
      }
    };
  }, [show]);

  const columns: Column<TaskRow>[] = [
    { key: "taskType", header: "Task", sortable: true, render: (r) => titleCase(r.taskType) },
    { key: "room", header: "Room", render: (r) => roomLabel(r.room) },
    { key: "staffUserId", header: "Staff user", render: (r) => r.staffUserId.slice(0, 8) },
    { key: "assignedDate", header: "Assigned", sortable: true, render: (r) => formatDate(r.assignedDate) },
    { key: "status", header: "Status", sortable: true, render: (r) => <StatusBadge value={r.status} /> },
    { key: "completedDate", header: "Completed", render: (r) => formatDate(r.completedDate) },
  ];

  const fields: FieldDef[] = [
    { name: "staffUserId", label: "Staff user ID", type: "text", required: true, hint: "UUID of the assigned staff account" },
    { name: "roomId", label: "Room", type: "select", required: true, optionsEndpoint: "/hotel/rooms", mapOption: roomOptionMapper },
    { name: "taskType", label: "Task type", type: "select", required: true, options: TASK_TYPE_OPTIONS },
    { name: "status", label: "Status", type: "select", options: TASK_STATUS_OPTIONS },
    { name: "assignedDate", label: "Assigned date", type: "date", required: true },
    { name: "completedDate", label: "Completed date", type: "date" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <EntityCrudPage<TaskRow>
      key={refreshKey}
      title="Staff Tasks"
      description="Housekeeping and check-in/out assignments — live-updates when teammates make changes"
      resource="/hotel/tasks"
      searchPlaceholder="Search tasks by room or notes..."
      columns={columns}
      fields={fields}
    />
  );
}

// ============================================================
// Maintenance tab
// ============================================================

interface MaintenanceRow extends Record<string, unknown> {
  id: string;
  issueDescription: string;
  priority: string;
  status: string;
  assignedTo: string | null;
  completedAt: string | null;
  room: { roomNumber: string; roomType: string } | null;
}

const MAINTENANCE_PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const MAINTENANCE_STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "closed", label: "Closed" },
];

function MaintenanceTab() {
  const columns: Column<MaintenanceRow>[] = [
    { key: "room", header: "Room", render: (r) => roomLabel(r.room) },
    { key: "issueDescription", header: "Issue" },
    { key: "priority", header: "Priority", sortable: true, render: (r) => <StatusBadge value={r.priority} /> },
    { key: "status", header: "Status", sortable: true, render: (r) => <StatusBadge value={r.status} /> },
    { key: "completedAt", header: "Completed", render: (r) => formatDate(r.completedAt) },
  ];

  const fields: FieldDef[] = [
    { name: "roomId", label: "Room", type: "select", required: true, optionsEndpoint: "/hotel/rooms", mapOption: roomOptionMapper },
    { name: "issueDescription", label: "Issue description", type: "textarea", required: true },
    { name: "priority", label: "Priority", type: "select", options: MAINTENANCE_PRIORITY_OPTIONS },
    { name: "status", label: "Status", type: "select", options: MAINTENANCE_STATUS_OPTIONS },
    { name: "assignedTo", label: "Assigned to (user ID)", type: "text" },
  ];

  return (
    <EntityCrudPage<MaintenanceRow>
      title="Maintenance"
      description="Maintenance requests across the property"
      resource="/hotel/maintenance"
      searchPlaceholder="Search maintenance requests by room or issue..."
      columns={columns}
      fields={fields}
    />
  );
}

// ============================================================
// Invoices tab
// ============================================================

interface InvoiceRow extends Record<string, unknown> {
  id: string;
  amount: string | number;
  tax: string | number;
  totalAmount: string | number;
  paidAt: string | null;
  status: string;
  guest: { firstName: string; lastName: string } | null;
}

const INVOICE_STATUS_OPTIONS = [
  { value: "unpaid", label: "Unpaid" },
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partial" },
];

function InvoicesTab() {
  const columns: Column<InvoiceRow>[] = [
    { key: "guest", header: "Guest", render: (r) => personName(r.guest) },
    { key: "amount", header: "Amount", render: (r) => formatCurrency(r.amount) },
    { key: "tax", header: "Tax", render: (r) => formatCurrency(r.tax) },
    { key: "totalAmount", header: "Total", sortable: true, render: (r) => formatCurrency(r.totalAmount) },
    { key: "status", header: "Status", sortable: true, render: (r) => <StatusBadge value={r.status} /> },
    { key: "paidAt", header: "Paid at", render: (r) => formatDate(r.paidAt) },
  ];

  const fields: FieldDef[] = [
    { name: "guestId", label: "Guest", type: "select", required: true, optionsEndpoint: "/hotel/guests" },
    { name: "reservationId", label: "Reservation", type: "select", required: true, optionsEndpoint: "/hotel/reservations", mapOption: reservationOptionMapper },
    { name: "amount", label: "Amount", type: "number", step: "0.01", required: true },
    { name: "tax", label: "Tax", type: "number", step: "0.01" },
    { name: "totalAmount", label: "Total amount (optional override)", type: "number", step: "0.01" },
    { name: "paidAt", label: "Paid at", type: "date" },
    { name: "paymentMethod", label: "Payment method", type: "text" },
    { name: "status", label: "Status", type: "select", options: INVOICE_STATUS_OPTIONS },
  ];

  return (
    <EntityCrudPage<InvoiceRow>
      title="Invoices"
      description="Guest billing — total is auto-calculated from amount + tax unless overridden"
      resource="/hotel/invoices"
      searchPlaceholder="Search invoices by guest or payment method..."
      columns={columns}
      fields={fields}
    />
  );
}

// ============================================================
// Root: tab bar + routes
// ============================================================

const TABS = [
  { to: "", label: "Dashboard", icon: LayoutGrid, end: true },
  { to: "guests", label: "Guests", icon: Users },
  { to: "rooms", label: "Rooms", icon: BedDouble },
  { to: "reservations", label: "Reservations", icon: CalendarCheck },
  { to: "tasks", label: "Staff Tasks", icon: ClipboardList },
  { to: "maintenance", label: "Maintenance", icon: Wrench },
  { to: "invoices", label: "Invoices", icon: Receipt },
];

export default function HotelCRM() {
  return (
    <div className="animate-fade-in flex flex-col gap-5">
      <div>
        <h2>Hotel CRM</h2>
        <p className="mt-1 text-sm text-aurora-text/60">Guests, rooms, reservations, and housekeeping</p>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-black/10 pb-2">
        {TABS.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-aurora-text/60 transition duration-300",
                "hover:bg-black/10 hover:text-aurora-text",
                isActive && "bg-black/10 text-aurora-text shadow-glass",
              )
            }
          >
            <tab.icon size={15} />
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Routes>
        <Route index element={<DashboardTab />} />
        <Route path="guests" element={<GuestsTab />} />
        <Route path="rooms" element={<RoomsTab />} />
        <Route path="reservations" element={<ReservationsTab />} />
        <Route path="tasks" element={<StaffTasksTab />} />
        <Route path="maintenance" element={<MaintenanceTab />} />
        <Route path="invoices" element={<InvoicesTab />} />
        <Route path="*" element={<Navigate to="." replace />} />
      </Routes>
    </div>
  );
}
