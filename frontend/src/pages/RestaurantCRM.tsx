import { useCallback, useEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { DollarSign, PackagePlus, Plus, ShoppingBag, Trash2, TrendingUp, Users } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { cn, formatCurrency, formatDate, formatDateTime, titleCase } from "@/lib/utils";
import { GlassCard } from "@/components/Common/GlassCard";
import { AuroraButton } from "@/components/Common/AuroraButton";
import { GlassInput, GlassSelect, GlassTextarea } from "@/components/Common/GlassInput";
import { Modal } from "@/components/Common/Modal";
import { LoadingSpinner } from "@/components/Common/LoadingSpinner";
import { useToast } from "@/components/Common/Toast";
import { EntityCrudPage } from "@/components/Common/EntityCrudPage";

// ============================================================
// Shared types / constants
// ============================================================

interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface MenuItemRow extends Record<string, unknown> {
  id: string;
  name: string;
  description: string | null;
  price: string;
  category: string;
  imageUrl: string | null;
  available: boolean;
  prepTimeMinutes: number | null;
  calories: number | null;
  dietaryTags: string[];
}

interface TableRow extends Record<string, unknown> {
  id: string;
  tableNumber: string;
  capacity: number;
  status: string;
  currentOrderId: string | null;
}

interface CustomerRow extends Record<string, unknown> {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  totalSpent: string;
  visitCount: number;
  lastVisit: string | null;
  preferences: string | null;
  loyaltyPoints: number;
}

interface ShiftRow extends Record<string, unknown> {
  id: string;
  staffUserId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  role: string;
  status: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
}

interface InventoryRow extends Record<string, unknown> {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  reorderLevel: string | null;
  costPerUnit: string | null;
  supplierId: string | null;
  lastRestocked: string | null;
  lowStock: boolean;
}

interface ReservationRow extends Record<string, unknown> {
  id: string;
  customerId: string;
  reservationDate: string;
  reservationTime: string;
  partySize: number;
  tableId: string | null;
  status: string;
  notes: string | null;
}

interface OrderItemRow {
  id: string;
  quantity: number;
  specialRequests: string | null;
  status: string;
  menuItem: { id: string; name: string; price: string };
}

interface OrderRow extends Record<string, unknown> {
  id: string;
  orderNumber: string;
  tableId: string | null;
  customerId: string | null;
  status: string;
  itemsCount: number | null;
  subtotal: string | null;
  tax: string | null;
  totalAmount: string | null;
  orderTime: string;
  servedTime: string | null;
  completedTime: string | null;
  paymentMethod: string | null;
  notes: string | null;
  table: { id: string; tableNumber: string } | null;
  customer: { id: string; name: string } | null;
  items: OrderItemRow[];
}

const MENU_CATEGORY_OPTIONS = [
  { value: "appetizers", label: "Appetizers" },
  { value: "mains", label: "Mains" },
  { value: "desserts", label: "Desserts" },
  { value: "drinks", label: "Drinks" },
  { value: "specials", label: "Specials" },
];

const ORDER_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "cooking", label: "Cooking" },
  { value: "ready", label: "Ready" },
  { value: "served", label: "Served" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const SHIFT_ROLE_OPTIONS = [
  { value: "waiter", label: "Waiter" },
  { value: "chef", label: "Chef" },
  { value: "cashier", label: "Cashier" },
  { value: "manager", label: "Manager" },
];

const SHIFT_STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "checked_in", label: "Checked In" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

const INVENTORY_UNIT_OPTIONS = [
  { value: "kg", label: "Kilograms" },
  { value: "liters", label: "Liters" },
  { value: "pieces", label: "Pieces" },
  { value: "units", label: "Units" },
];

const INVENTORY_REASON_OPTIONS = [
  { value: "purchase", label: "Purchase" },
  { value: "usage", label: "Usage" },
  { value: "waste", label: "Waste" },
  { value: "adjustment", label: "Adjustment" },
];

const TABLE_STATUS_OPTIONS = [
  { value: "vacant", label: "Vacant" },
  { value: "occupied", label: "Occupied" },
  { value: "reserved", label: "Reserved" },
  { value: "cleaning", label: "Cleaning" },
];

const RESERVATION_STATUS_OPTIONS = [
  { value: "confirmed", label: "Confirmed" },
  { value: "seated", label: "Seated" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No Show" },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "border-aurora-warning/40 text-aurora-warning",
  cooking: "border-aurora-warning/40 text-aurora-warning",
  ready: "border-aurora-blue/40 text-aurora-blue",
  served: "border-aurora-cyan/40 text-aurora-cyan",
  completed: "border-aurora-success/40 text-aurora-success",
  cancelled: "border-aurora-error/40 text-aurora-error",
  vacant: "border-aurora-success/40 text-aurora-success",
  occupied: "border-aurora-warning/40 text-aurora-warning",
  reserved: "border-aurora-blue/40 text-aurora-blue",
  cleaning: "border-aurora-purple/40 text-aurora-purple",
  scheduled: "border-aurora-blue/40 text-aurora-blue",
  checked_in: "border-aurora-cyan/40 text-aurora-cyan",
  active: "border-aurora-success/40 text-aurora-success",
  confirmed: "border-aurora-blue/40 text-aurora-blue",
  seated: "border-aurora-cyan/40 text-aurora-cyan",
  no_show: "border-aurora-error/40 text-aurora-error",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("aurora-badge", STATUS_COLORS[status] ?? "border-black/20 text-aurora-text/70")}>{titleCase(status)}</span>
  );
}

function formatTimeOfDay(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(date);
}

// ============================================================
// Dashboard tab
// ============================================================

interface PopularItem {
  menuItemId: string;
  name: string;
  quantity: number;
  revenue: number;
}

interface DashboardData {
  ordersToday: number;
  revenueToday: number;
  avgOrderValueToday: number;
  staffOnDutyToday: number;
  popularItemsToday: PopularItem[];
  tablesStatusSummary: Record<string, number>;
}

function DashboardTab({ refreshSignal }: { refreshSignal: number }) {
  const { show } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<DashboardData>("/restaurant/dashboard");
      setData(data);
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to load dashboard"), "error");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshSignal]);

  if (isLoading || !data) return <LoadingSpinner fullscreen />;

  const kpis: { label: string; value: string; icon: typeof ShoppingBag }[] = [
    { label: "Orders Today", value: String(data.ordersToday), icon: ShoppingBag },
    { label: "Revenue Today", value: formatCurrency(data.revenueToday), icon: DollarSign },
    { label: "Avg Order Value", value: formatCurrency(data.avgOrderValueToday), icon: TrendingUp },
    { label: "Staff On Duty", value: String(data.staffOnDutyToday), icon: Users },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <GlassCard key={kpi.label} className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-aurora-gradient">
              <kpi.icon size={20} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-aurora-text/50">{kpi.label}</p>
              <p className="text-xl font-bold">{kpi.value}</p>
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GlassCard>
          <h3 className="mb-3">Popular Items Today</h3>
          {data.popularItemsToday.length === 0 ? (
            <p className="text-sm text-aurora-text/50">No orders yet today.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.popularItemsToday.map((item, idx) => (
                <li key={item.menuItemId} className="flex items-center justify-between border-b border-black/5 pb-2 text-sm last:border-0 last:pb-0">
                  <span className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/10 text-xs">{idx + 1}</span>
                    {item.name}
                  </span>
                  <span className="text-aurora-text/60">
                    {item.quantity} sold &middot; {formatCurrency(item.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard>
          <h3 className="mb-3">Tables Status</h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(data.tablesStatusSummary).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between rounded-xl border border-black/10 px-3 py-2">
                <StatusBadge status={status} />
                <span className="font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

// ============================================================
// Orders tab (list + bespoke "New Order" cart modal)
// ============================================================

interface CartLine {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

function NewOrderModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { show } = useToast();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([]);
  const [tableId, setTableId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const [tablesRes, customersRes, menuRes] = await Promise.all([
          api.get<PaginatedResponse<TableRow>>("/restaurant/tables", { params: { pageSize: 200 } }),
          api.get<PaginatedResponse<CustomerRow>>("/restaurant/customers", { params: { pageSize: 200 } }),
          api.get<PaginatedResponse<MenuItemRow>>("/restaurant/menu-items", { params: { pageSize: 200, available: true } }),
        ]);
        setTables(tablesRes.data.data);
        setCustomers(customersRes.data.data);
        setMenuItems(menuRes.data.data);
      } catch (err) {
        show(getApiErrorMessage(err, "Failed to load order form data"), "error");
      }
    })();
  }, [open, show]);

  const resetForm = () => {
    setTableId("");
    setCustomerId("");
    setNotes("");
    setCart([]);
    setSelectedMenuItemId("");
    setSelectedQuantity(1);
  };

  const addToCart = () => {
    if (!selectedMenuItemId || selectedQuantity < 1) return;
    const menuItem = menuItems.find((m) => m.id === selectedMenuItemId);
    if (!menuItem) return;
    setCart((prev) => {
      const existing = prev.find((line) => line.menuItemId === selectedMenuItemId);
      if (existing) {
        return prev.map((line) =>
          line.menuItemId === selectedMenuItemId ? { ...line, quantity: line.quantity + selectedQuantity } : line,
        );
      }
      return [...prev, { menuItemId: menuItem.id, name: menuItem.name, price: Number(menuItem.price), quantity: selectedQuantity }];
    });
    setSelectedMenuItemId("");
    setSelectedQuantity(1);
  };

  const removeFromCart = (menuItemId: string) => setCart((prev) => prev.filter((line) => line.menuItemId !== menuItemId));

  const subtotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (cart.length === 0) {
      show("Add at least one item to the order", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post("/restaurant/orders", {
        tableId: tableId || undefined,
        customerId: customerId || undefined,
        items: cart.map((line) => ({ menuItemId: line.menuItemId, quantity: line.quantity })),
        notes: notes || undefined,
      });
      show("Order created", "success");
      resetForm();
      onClose();
      onCreated();
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to create order"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="New Order"
      size="lg"
      footer={
        <>
          <AuroraButton variant="ghost" onClick={handleClose}>
            Cancel
          </AuroraButton>
          <AuroraButton isLoading={isSubmitting} onClick={handleSubmit}>
            Create Order
          </AuroraButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <GlassSelect
            label="Table (optional)"
            options={tables.map((t) => ({ value: t.id, label: `Table ${t.tableNumber} (seats ${t.capacity})` }))}
            placeholder="No table"
            value={tableId}
            onChange={(e) => setTableId(e.target.value)}
          />
          <GlassSelect
            label="Customer (optional)"
            options={customers.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Walk-in"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          />
        </div>

        <GlassCard padding="sm" className="flex flex-col gap-3">
          <p className="text-sm font-medium text-aurora-text/90">Add items</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <GlassSelect
                label="Menu item"
                options={menuItems.map((m) => ({ value: m.id, label: `${m.name} — ${formatCurrency(m.price)}` }))}
                placeholder="Select an item"
                value={selectedMenuItemId}
                onChange={(e) => setSelectedMenuItemId(e.target.value)}
              />
            </div>
            <div className="w-24">
              <GlassInput
                label="Qty"
                type="number"
                min={1}
                value={selectedQuantity}
                onChange={(e) => setSelectedQuantity(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <AuroraButton type="button" variant="ghost" icon={<Plus size={16} />} onClick={addToCart}>
              Add
            </AuroraButton>
          </div>

          {cart.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-black/10 pt-3">
              {cart.map((line) => (
                <div key={line.menuItemId} className="flex items-center justify-between text-sm">
                  <span>
                    {line.quantity} &times; {line.name}
                  </span>
                  <span className="flex items-center gap-3">
                    {formatCurrency(line.price * line.quantity)}
                    <button
                      type="button"
                      onClick={() => removeFromCart(line.menuItemId)}
                      className="text-aurora-text/50 hover:text-aurora-error"
                      aria-label={`Remove ${line.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-black/10 pt-2 text-sm font-semibold">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
            </div>
          )}
        </GlassCard>

        <GlassTextarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Modal>
  );
}

function OrdersTab({ refreshSignal }: { refreshSignal: number }) {
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [localTick, setLocalTick] = useState(0);

  return (
    <>
      <EntityCrudPage<OrderRow>
        key={`${refreshSignal}-${localTick}`}
        title="Orders"
        description="Live order activity across the floor and kitchen"
        resource="/restaurant/orders"
        canCreate={false}
        toolbarExtra={
          <AuroraButton size="sm" icon={<Plus size={16} />} onClick={() => setNewOrderOpen(true)}>
            New Order
          </AuroraButton>
        }
        columns={[
          { key: "orderNumber", header: "Order #" },
          { key: "table", header: "Table", render: (row) => (row.table ? `Table ${row.table.tableNumber}` : "—") },
          { key: "customer", header: "Customer", render: (row) => row.customer?.name ?? "Walk-in" },
          { key: "itemsCount", header: "Items", render: (row) => String(row.itemsCount ?? row.items.length) },
          { key: "totalAmount", header: "Total", render: (row) => (row.totalAmount ? formatCurrency(row.totalAmount) : "—") },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
          { key: "orderTime", header: "Order Time", render: (row) => formatDateTime(row.orderTime) },
        ]}
        fields={[
          { name: "status", label: "Status", type: "select", options: ORDER_STATUS_OPTIONS, required: true },
          {
            name: "tableId",
            label: "Table",
            type: "select",
            optionsEndpoint: "/restaurant/tables",
            mapOption: (row) => ({ value: String(row.id), label: `Table ${String(row.tableNumber ?? "")}` }),
          },
          { name: "paymentMethod", label: "Payment method", type: "text" },
          { name: "notes", label: "Notes", type: "textarea" },
        ]}
      />
      <NewOrderModal open={newOrderOpen} onClose={() => setNewOrderOpen(false)} onCreated={() => setLocalTick((t) => t + 1)} />
    </>
  );
}

// ============================================================
// Menu tab
// ============================================================

function MenuTab() {
  return (
    <EntityCrudPage<MenuItemRow>
      title="Menu Items"
      description="Manage what's available to order"
      resource="/restaurant/menu-items"
      columns={[
        { key: "name", header: "Name" },
        { key: "category", header: "Category", render: (row) => titleCase(row.category) },
        { key: "price", header: "Price", render: (row) => formatCurrency(row.price) },
        {
          key: "available",
          header: "Available",
          render: (row) => (
            <span className={cn("aurora-badge", row.available ? "border-aurora-success/40 text-aurora-success" : "border-aurora-error/40 text-aurora-error")}>
              {row.available ? "Available" : "Unavailable"}
            </span>
          ),
        },
        { key: "dietaryTags", header: "Dietary Tags", render: (row) => (row.dietaryTags.length ? row.dietaryTags.join(", ") : "—") },
      ]}
      fields={[
        { name: "name", label: "Name", type: "text", required: true },
        { name: "description", label: "Description", type: "textarea" },
        { name: "price", label: "Price", type: "number", step: "0.01", required: true },
        { name: "category", label: "Category", type: "select", options: MENU_CATEGORY_OPTIONS, required: true },
        { name: "imageUrl", label: "Image URL", type: "text" },
        { name: "available", label: "Available", type: "checkbox" },
        { name: "prepTimeMinutes", label: "Prep time (minutes)", type: "number" },
        { name: "calories", label: "Calories", type: "number" },
        { name: "dietaryTags", label: "Dietary tags", type: "tags" },
      ]}
    />
  );
}

// ============================================================
// Customers tab
// ============================================================

function CustomersTab() {
  return (
    <EntityCrudPage<CustomerRow>
      title="Customers"
      description="Track regulars, spend, and loyalty"
      resource="/restaurant/customers"
      columns={[
        { key: "name", header: "Name" },
        { key: "phone", header: "Phone", render: (row) => row.phone ?? "—" },
        { key: "email", header: "Email", render: (row) => row.email ?? "—" },
        { key: "totalSpent", header: "Total Spent", render: (row) => formatCurrency(row.totalSpent) },
        { key: "visitCount", header: "Visits" },
        { key: "loyaltyPoints", header: "Loyalty Pts" },
        { key: "lastVisit", header: "Last Visit", render: (row) => formatDate(row.lastVisit) },
      ]}
      fields={[
        { name: "name", label: "Name", type: "text", required: true },
        { name: "phone", label: "Phone", type: "text" },
        { name: "email", label: "Email", type: "email" },
        { name: "preferences", label: "Preferences", type: "textarea" },
        { name: "loyaltyPoints", label: "Loyalty points", type: "number" },
      ]}
    />
  );
}

// ============================================================
// Staff shifts tab
// ============================================================

function StaffShiftsTab() {
  return (
    <EntityCrudPage<ShiftRow>
      title="Staff Shifts"
      description="Schedule shifts and track check-in/out"
      resource="/restaurant/shifts"
      columns={[
        { key: "staffUserId", header: "Staff User" },
        { key: "role", header: "Role", render: (row) => titleCase(row.role) },
        { key: "shiftDate", header: "Date", render: (row) => formatDate(row.shiftDate) },
        { key: "startTime", header: "Start", render: (row) => formatTimeOfDay(row.startTime) },
        { key: "endTime", header: "End", render: (row) => formatTimeOfDay(row.endTime) },
        { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
      ]}
      fields={[
        { name: "staffUserId", label: "Staff user ID", type: "text", required: true, hint: "UUID of the staff account" },
        { name: "shiftDate", label: "Shift date", type: "date", required: true },
        { name: "startTime", label: "Start time", type: "time", required: true },
        { name: "endTime", label: "End time", type: "time", required: true },
        { name: "role", label: "Role", type: "select", options: SHIFT_ROLE_OPTIONS, required: true },
        { name: "status", label: "Status", type: "select", options: SHIFT_STATUS_OPTIONS },
      ]}
    />
  );
}

// ============================================================
// Inventory tab (with quick "adjust stock" row action)
// ============================================================

function InventoryTab() {
  const { show } = useToast();
  const [adjustItem, setAdjustItem] = useState<InventoryRow | null>(null);
  const [changeQuantity, setChangeQuantity] = useState("");
  const [reason, setReason] = useState("purchase");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tick, setTick] = useState(0);

  const closeAdjust = () => {
    setAdjustItem(null);
    setChangeQuantity("");
    setReason("purchase");
  };

  const submitAdjust = async () => {
    if (!adjustItem) return;
    const value = Number(changeQuantity);
    if (!Number.isFinite(value) || value === 0) {
      show("Enter a non-zero quantity change", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post(`/restaurant/inventory/${adjustItem.id}/adjust`, { changeQuantity: value, reason });
      show("Inventory adjusted", "success");
      closeAdjust();
      setTick((t) => t + 1);
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to adjust inventory"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <EntityCrudPage<InventoryRow>
        key={tick}
        title="Inventory"
        description="Stock levels and reorder tracking"
        resource="/restaurant/inventory"
        columns={[
          { key: "name", header: "Name" },
          { key: "quantity", header: "Quantity", render: (row) => `${row.quantity} ${row.unit}` },
          { key: "reorderLevel", header: "Reorder Level", render: (row) => row.reorderLevel ?? "—" },
          {
            key: "lowStock",
            header: "Status",
            render: (row) => (
              <span className={cn("aurora-badge", row.lowStock ? "border-aurora-warning/40 text-aurora-warning" : "border-aurora-success/40 text-aurora-success")}>
                {row.lowStock ? "Low stock" : "OK"}
              </span>
            ),
          },
          { key: "lastRestocked", header: "Last Restocked", render: (row) => formatDate(row.lastRestocked) },
        ]}
        fields={[
          { name: "name", label: "Name", type: "text", required: true },
          { name: "quantity", label: "Quantity", type: "number", step: "0.01", required: true },
          { name: "unit", label: "Unit", type: "select", options: INVENTORY_UNIT_OPTIONS, required: true },
          { name: "reorderLevel", label: "Reorder level", type: "number", step: "0.01" },
          { name: "costPerUnit", label: "Cost per unit", type: "number", step: "0.01" },
          { name: "supplierId", label: "Supplier ID", type: "text" },
        ]}
        rowActions={(row) => (
          <button
            onClick={() => setAdjustItem(row)}
            className="rounded-lg p-1.5 text-aurora-text/60 transition hover:bg-black/10 hover:text-aurora-cyan"
            aria-label="Adjust stock"
          >
            <PackagePlus size={16} />
          </button>
        )}
      />

      <Modal
        open={Boolean(adjustItem)}
        onClose={closeAdjust}
        title={adjustItem ? `Adjust "${adjustItem.name}"` : "Adjust stock"}
        size="sm"
        footer={
          <>
            <AuroraButton variant="ghost" onClick={closeAdjust}>
              Cancel
            </AuroraButton>
            <AuroraButton isLoading={isSubmitting} onClick={submitAdjust}>
              Apply
            </AuroraButton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <GlassInput
            label="Change quantity"
            type="number"
            step="0.01"
            hint="Positive to add stock, negative to remove"
            value={changeQuantity}
            onChange={(e) => setChangeQuantity(e.target.value)}
          />
          <GlassSelect label="Reason" options={INVENTORY_REASON_OPTIONS} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </Modal>
    </>
  );
}

// ============================================================
// Tables tab
// ============================================================

function TablesTab() {
  return (
    <EntityCrudPage<TableRow>
      title="Tables"
      description="Floor layout and seating status"
      resource="/restaurant/tables"
      columns={[
        { key: "tableNumber", header: "Table #" },
        { key: "capacity", header: "Capacity" },
        { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
      ]}
      fields={[
        { name: "tableNumber", label: "Table number", type: "text", required: true },
        { name: "capacity", label: "Capacity", type: "number", required: true },
        { name: "status", label: "Status", type: "select", options: TABLE_STATUS_OPTIONS },
      ]}
    />
  );
}

// ============================================================
// Reservations tab
// ============================================================

function ReservationsTab() {
  return (
    <EntityCrudPage<ReservationRow>
      title="Reservations"
      description="Upcoming bookings"
      resource="/restaurant/reservations"
      columns={[
        { key: "reservationDate", header: "Date", render: (row) => formatDate(row.reservationDate) },
        { key: "reservationTime", header: "Time", render: (row) => formatTimeOfDay(row.reservationTime) },
        { key: "partySize", header: "Party Size" },
        { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
      ]}
      fields={[
        { name: "customerId", label: "Customer", type: "select", required: true, optionsEndpoint: "/restaurant/customers" },
        { name: "reservationDate", label: "Date", type: "date", required: true },
        { name: "reservationTime", label: "Time", type: "time", required: true },
        { name: "partySize", label: "Party size", type: "number", required: true },
        {
          name: "tableId",
          label: "Table",
          type: "select",
          optionsEndpoint: "/restaurant/tables",
          mapOption: (row) => ({ value: String(row.id), label: `Table ${String(row.tableNumber ?? "")}` }),
        },
        { name: "status", label: "Status", type: "select", options: RESERVATION_STATUS_OPTIONS },
        { name: "notes", label: "Notes", type: "textarea" },
      ]}
    />
  );
}

// ============================================================
// Tab bar + page shell
// ============================================================

const TABS = [
  { to: "dashboard", label: "Dashboard" },
  { to: "orders", label: "Orders" },
  { to: "menu", label: "Menu" },
  { to: "customers", label: "Customers" },
  { to: "staff", label: "Staff" },
  { to: "inventory", label: "Inventory" },
  { to: "tables", label: "Tables" },
  { to: "reservations", label: "Reservations" },
];

function RestaurantTabBar() {
  return (
    <nav className="flex flex-wrap gap-1 border-b border-black/10 pb-1">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            cn(
              "rounded-t-lg px-4 py-2 text-sm font-medium text-aurora-text/60 transition",
              "hover:bg-black/5 hover:text-aurora-text",
              isActive && "bg-black/10 text-aurora-text shadow-glass",
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function RestaurantCRM() {
  const [orderUpdateTick, setOrderUpdateTick] = useState(0);

  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();
    const handleOrderUpdate = () => setOrderUpdateTick((tick) => tick + 1);
    socket.on("restaurant:order-updated", handleOrderUpdate);
    return () => {
      socket.off("restaurant:order-updated", handleOrderUpdate);
      socket.disconnect();
    };
  }, []);

  return (
    <div className="animate-fade-in flex flex-col gap-5">
      <div>
        <h2>Restaurant CRM</h2>
        <p className="mt-1 text-sm text-aurora-text/60">Orders, menu, staff, inventory, tables, and reservations</p>
      </div>

      <RestaurantTabBar />

      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardTab refreshSignal={orderUpdateTick} />} />
        <Route path="orders" element={<OrdersTab refreshSignal={orderUpdateTick} />} />
        <Route path="menu" element={<MenuTab />} />
        <Route path="customers" element={<CustomersTab />} />
        <Route path="staff" element={<StaffShiftsTab />} />
        <Route path="inventory" element={<InventoryTab />} />
        <Route path="tables" element={<TablesTab />} />
        <Route path="reservations" element={<ReservationsTab />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </div>
  );
}
