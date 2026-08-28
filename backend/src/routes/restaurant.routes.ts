import { Router } from "express";
import { z } from "zod";
import * as restaurantService from "@/services/restaurant.service";
import { authenticate } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenantIsolation";
import { requireModule } from "@/middleware/moduleGuard";
import { paginationSchema } from "@/utils/validators";
import { sendCsv } from "@/utils/csv";
import { recordAudit } from "@/utils/audit";
import { AppError } from "@/utils/errors";

const router = Router();
router.use(authenticate, resolveTenant, requireModule("restaurant"));

function toCsvRows(rows: unknown[]): Record<string, unknown>[] {
  return JSON.parse(JSON.stringify(rows)) as Record<string, unknown>[];
}

/**
 * A @db.Time form field round-trips through the client as either a fresh
 * "HH:MM" string (typed into an <input type="time">) or the full ISO
 * datetime string the API previously returned for that field (when an edit
 * form re-submits a value the user never touched). Accept both and coerce
 * to a Date carrying just the time-of-day, anchored to the Unix epoch date
 * the way Prisma expects for @db.Time columns.
 */
const timeField = z.string().transform((value, ctx) => {
  const hhmm = /^(\d{2}):(\d{2})$/.exec(value);
  if (hhmm) {
    return new Date(Date.UTC(1970, 0, 1, Number(hhmm[1]), Number(hhmm[2]), 0));
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expected HH:MM" });
    return z.NEVER;
  }
  return new Date(Date.UTC(1970, 0, 1, parsed.getUTCHours(), parsed.getUTCMinutes(), 0));
});

// ============================================================
// MENU ITEMS
// ============================================================

const menuCategoryEnum = z.enum(["appetizers", "mains", "desserts", "drinks", "specials"]);

const menuItemQuerySchema = paginationSchema.extend({
  category: menuCategoryEnum.optional(),
  available: z.coerce.boolean().optional(),
});

const createMenuItemSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  price: z.coerce.number().nonnegative(),
  category: menuCategoryEnum,
  imageUrl: z.string().optional(),
  available: z.boolean().default(true),
  prepTimeMinutes: z.coerce.number().int().nonnegative().optional(),
  calories: z.coerce.number().int().nonnegative().optional(),
  dietaryTags: z.array(z.string()).default([]),
});

const updateMenuItemSchema = createMenuItemSchema.partial();

router.get("/menu-items", async (req, res, next) => {
  try {
    const query = menuItemQuerySchema.parse(req.query);
    res.json(await restaurantService.listMenuItems(req.tenantId!, query));
  } catch (err) {
    next(err);
  }
});

router.get("/menu-items/export", async (req, res, next) => {
  try {
    const query = menuItemQuerySchema.parse(req.query);
    const rows = await restaurantService.listMenuItemsForExport(req.tenantId!, query.search, query.category, query.available);
    sendCsv(res, "menu-items.csv", toCsvRows(rows));
  } catch (err) {
    next(err);
  }
});

router.post("/menu-items", async (req, res, next) => {
  try {
    const input = createMenuItemSchema.parse(req.body);
    const item = await restaurantService.createMenuItem(req.tenantId!, input);
    await recordAudit(req, "create", "restaurant_menu_item", item.id, input);
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

router.patch("/menu-items/:id", async (req, res, next) => {
  try {
    const input = updateMenuItemSchema.parse(req.body);
    const item = await restaurantService.updateMenuItem(req.tenantId!, req.params.id, input);
    await recordAudit(req, "update", "restaurant_menu_item", req.params.id, input);
    res.json(item);
  } catch (err) {
    next(err);
  }
});

router.delete("/menu-items/:id", async (req, res, next) => {
  try {
    await restaurantService.deleteMenuItem(req.tenantId!, req.params.id);
    await recordAudit(req, "delete", "restaurant_menu_item", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// ORDERS + ORDER ITEMS
// ============================================================

const orderStatusEnum = z.enum(["pending", "cooking", "ready", "served", "completed", "cancelled"]);
const orderItemStatusEnum = z.enum(["pending", "cooking", "ready", "served"]);

const orderQuerySchema = paginationSchema.extend({
  status: orderStatusEnum.optional(),
});

const orderItemInputSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  specialRequests: z.string().optional(),
});

const createOrderSchema = z.object({
  tableId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  items: z.array(orderItemInputSchema).min(1),
  notes: z.string().optional(),
});

const updateOrderSchema = z.object({
  status: orderStatusEnum.optional(),
  notes: z.string().optional(),
  paymentMethod: z.string().optional(),
  tableId: z.string().uuid().nullable().optional(),
});

const updateOrderItemSchema = z.object({
  status: orderItemStatusEnum,
});

router.get("/orders", async (req, res, next) => {
  try {
    const query = orderQuerySchema.parse(req.query);
    res.json(await restaurantService.listOrders(req.tenantId!, query));
  } catch (err) {
    next(err);
  }
});

router.get("/orders/export", async (req, res, next) => {
  try {
    const query = orderQuerySchema.parse(req.query);
    const orders = await restaurantService.listOrdersForExport(req.tenantId!, query.search, query.status);
    const rows = orders.map((order) => ({
      orderNumber: order.orderNumber,
      status: order.status,
      table: order.table?.tableNumber ?? "",
      customer: order.customer?.name ?? "",
      itemsCount: order.itemsCount,
      subtotal: order.subtotal,
      tax: order.tax,
      totalAmount: order.totalAmount,
      orderTime: order.orderTime,
      servedTime: order.servedTime,
      completedTime: order.completedTime,
      paymentMethod: order.paymentMethod ?? "",
      notes: order.notes ?? "",
    }));
    sendCsv(res, "orders.csv", toCsvRows(rows));
  } catch (err) {
    next(err);
  }
});

router.post("/orders", async (req, res, next) => {
  try {
    const input = createOrderSchema.parse(req.body);
    const order = await restaurantService.createOrder(req.tenantId!, input);
    await recordAudit(req, "create", "restaurant_order", order.id, input);
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

router.patch("/orders/:id", async (req, res, next) => {
  try {
    const input = updateOrderSchema.parse(req.body);
    const order = await restaurantService.updateOrder(req.tenantId!, req.params.id, input);
    await recordAudit(req, "update", "restaurant_order", req.params.id, input);
    res.json(order);
  } catch (err) {
    next(err);
  }
});

router.delete("/orders/:id", async (req, res, next) => {
  try {
    await restaurantService.deleteOrder(req.tenantId!, req.params.id);
    await recordAudit(req, "delete", "restaurant_order", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.patch("/order-items/:id", async (req, res, next) => {
  try {
    const input = updateOrderItemSchema.parse(req.body);
    const order = await restaurantService.updateOrderItem(req.tenantId!, req.params.id, input.status);
    await recordAudit(req, "update", "restaurant_order_item", req.params.id, input);
    res.json(order);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// CUSTOMERS
// ============================================================

const createCustomerSchema = z.object({
  name: z.string().min(1).max(255),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  preferences: z.string().optional(),
  loyaltyPoints: z.coerce.number().int().nonnegative().optional(),
});

const updateCustomerSchema = createCustomerSchema.partial();

router.get("/customers", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await restaurantService.listCustomers(req.tenantId!, query));
  } catch (err) {
    next(err);
  }
});

router.get("/customers/export", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    const rows = await restaurantService.listCustomersForExport(req.tenantId!, query.search);
    sendCsv(res, "customers.csv", toCsvRows(rows));
  } catch (err) {
    next(err);
  }
});

router.post("/customers", async (req, res, next) => {
  try {
    const input = createCustomerSchema.parse(req.body);
    const customer = await restaurantService.createCustomer(req.tenantId!, input);
    await recordAudit(req, "create", "restaurant_customer", customer.id, input);
    res.status(201).json(customer);
  } catch (err) {
    next(err);
  }
});

router.patch("/customers/:id", async (req, res, next) => {
  try {
    const input = updateCustomerSchema.parse(req.body);
    const customer = await restaurantService.updateCustomer(req.tenantId!, req.params.id, input);
    await recordAudit(req, "update", "restaurant_customer", req.params.id, input);
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

router.delete("/customers/:id", async (req, res, next) => {
  try {
    await restaurantService.deleteCustomer(req.tenantId!, req.params.id);
    await recordAudit(req, "delete", "restaurant_customer", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// STAFF SHIFTS
// ============================================================

const shiftRoleEnum = z.enum(["waiter", "chef", "cashier", "manager"]);
const shiftStatusEnum = z.enum(["scheduled", "checked_in", "active", "completed"]);

const createShiftSchema = z.object({
  staffUserId: z.string().uuid(),
  shiftDate: z.coerce.date(),
  startTime: timeField,
  endTime: timeField,
  role: shiftRoleEnum,
  status: shiftStatusEnum.default("scheduled"),
});

const updateShiftSchema = z.object({
  shiftDate: z.coerce.date().optional(),
  startTime: timeField.optional(),
  endTime: timeField.optional(),
  role: shiftRoleEnum.optional(),
  status: shiftStatusEnum.optional(),
});

router.get("/shifts", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await restaurantService.listShifts(req.tenantId!, query));
  } catch (err) {
    next(err);
  }
});

router.get("/shifts/export", async (req, res, next) => {
  try {
    const rows = await restaurantService.listShiftsForExport(req.tenantId!);
    sendCsv(res, "shifts.csv", toCsvRows(rows));
  } catch (err) {
    next(err);
  }
});

router.post("/shifts", async (req, res, next) => {
  try {
    const input = createShiftSchema.parse(req.body);
    const shift = await restaurantService.createShift(req.tenantId!, input);
    await recordAudit(req, "create", "restaurant_staff_shift", shift.id, input);
    res.status(201).json(shift);
  } catch (err) {
    next(err);
  }
});

router.patch("/shifts/:id", async (req, res, next) => {
  try {
    const input = updateShiftSchema.parse(req.body);
    const shift = await restaurantService.updateShift(req.tenantId!, req.params.id, input);
    await recordAudit(req, "update", "restaurant_staff_shift", req.params.id, input);
    res.json(shift);
  } catch (err) {
    next(err);
  }
});

router.delete("/shifts/:id", async (req, res, next) => {
  try {
    await restaurantService.deleteShift(req.tenantId!, req.params.id);
    await recordAudit(req, "delete", "restaurant_staff_shift", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// INVENTORY + INVENTORY LOGS
// ============================================================

const inventoryUnitEnum = z.enum(["kg", "liters", "pieces", "units"]);
const inventoryReasonEnum = z.enum(["purchase", "usage", "waste", "adjustment"]);

const createInventorySchema = z.object({
  name: z.string().min(1).max(255),
  quantity: z.coerce.number().nonnegative(),
  unit: inventoryUnitEnum,
  reorderLevel: z.coerce.number().nonnegative().optional(),
  costPerUnit: z.coerce.number().nonnegative().optional(),
  supplierId: z.string().uuid().optional(),
});

const updateInventorySchema = createInventorySchema.partial();

const adjustInventorySchema = z.object({
  changeQuantity: z.coerce.number(),
  reason: inventoryReasonEnum,
});

router.get("/inventory", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await restaurantService.listInventory(req.tenantId!, query));
  } catch (err) {
    next(err);
  }
});

router.get("/inventory/export", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    const rows = await restaurantService.listInventoryForExport(req.tenantId!, query.search);
    sendCsv(res, "inventory.csv", toCsvRows(rows));
  } catch (err) {
    next(err);
  }
});

router.post("/inventory", async (req, res, next) => {
  try {
    const input = createInventorySchema.parse(req.body);
    const item = await restaurantService.createInventoryItem(req.tenantId!, input);
    await recordAudit(req, "create", "restaurant_inventory", item.id, input);
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

router.patch("/inventory/:id", async (req, res, next) => {
  try {
    const input = updateInventorySchema.parse(req.body);
    const item = await restaurantService.updateInventoryItem(req.tenantId!, req.params.id, input);
    await recordAudit(req, "update", "restaurant_inventory", req.params.id, input);
    res.json(item);
  } catch (err) {
    next(err);
  }
});

router.delete("/inventory/:id", async (req, res, next) => {
  try {
    await restaurantService.deleteInventoryItem(req.tenantId!, req.params.id);
    await recordAudit(req, "delete", "restaurant_inventory", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post("/inventory/:id/adjust", async (req, res, next) => {
  try {
    const input = adjustInventorySchema.parse(req.body);
    if (!req.auth) throw AppError.unauthorized();
    const item = await restaurantService.adjustInventory(req.tenantId!, req.auth.userId, req.params.id, input.changeQuantity, input.reason);
    await recordAudit(req, "adjust", "restaurant_inventory", req.params.id, input);
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// TABLES
// ============================================================

const tableStatusEnum = z.enum(["vacant", "occupied", "reserved", "cleaning"]);

const createTableSchema = z.object({
  tableNumber: z.string().min(1).max(50),
  capacity: z.coerce.number().int().positive(),
  status: tableStatusEnum.default("vacant"),
});

const updateTableSchema = createTableSchema.partial();

router.get("/tables", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await restaurantService.listTables(req.tenantId!, query));
  } catch (err) {
    next(err);
  }
});

router.get("/tables/export", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    const rows = await restaurantService.listTablesForExport(req.tenantId!, query.search);
    sendCsv(res, "tables.csv", toCsvRows(rows));
  } catch (err) {
    next(err);
  }
});

router.post("/tables", async (req, res, next) => {
  try {
    const input = createTableSchema.parse(req.body);
    const table = await restaurantService.createTable(req.tenantId!, input);
    await recordAudit(req, "create", "restaurant_table", table.id, input);
    res.status(201).json(table);
  } catch (err) {
    next(err);
  }
});

router.patch("/tables/:id", async (req, res, next) => {
  try {
    const input = updateTableSchema.parse(req.body);
    const table = await restaurantService.updateTable(req.tenantId!, req.params.id, input);
    await recordAudit(req, "update", "restaurant_table", req.params.id, input);
    res.json(table);
  } catch (err) {
    next(err);
  }
});

router.delete("/tables/:id", async (req, res, next) => {
  try {
    await restaurantService.deleteTable(req.tenantId!, req.params.id);
    await recordAudit(req, "delete", "restaurant_table", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// RESERVATIONS
// ============================================================

const reservationStatusEnum = z.enum(["confirmed", "seated", "completed", "cancelled", "no_show"]);

const createReservationSchema = z.object({
  customerId: z.string().uuid(),
  reservationDate: z.coerce.date(),
  reservationTime: timeField,
  partySize: z.coerce.number().int().positive(),
  tableId: z.string().uuid().optional(),
  status: reservationStatusEnum.default("confirmed"),
  notes: z.string().optional(),
});

const updateReservationSchema = z.object({
  customerId: z.string().uuid().optional(),
  reservationDate: z.coerce.date().optional(),
  reservationTime: timeField.optional(),
  partySize: z.coerce.number().int().positive().optional(),
  tableId: z.string().uuid().optional(),
  status: reservationStatusEnum.optional(),
  notes: z.string().optional(),
});

router.get("/reservations", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await restaurantService.listReservations(req.tenantId!, query));
  } catch (err) {
    next(err);
  }
});

router.get("/reservations/export", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    const rows = await restaurantService.listReservationsForExport(req.tenantId!, query.search);
    sendCsv(res, "reservations.csv", toCsvRows(rows));
  } catch (err) {
    next(err);
  }
});

router.post("/reservations", async (req, res, next) => {
  try {
    const input = createReservationSchema.parse(req.body);
    const reservation = await restaurantService.createReservation(req.tenantId!, input);
    await recordAudit(req, "create", "restaurant_reservation", reservation.id, input);
    res.status(201).json(reservation);
  } catch (err) {
    next(err);
  }
});

router.patch("/reservations/:id", async (req, res, next) => {
  try {
    const input = updateReservationSchema.parse(req.body);
    const reservation = await restaurantService.updateReservation(req.tenantId!, req.params.id, input);
    await recordAudit(req, "update", "restaurant_reservation", req.params.id, input);
    res.json(reservation);
  } catch (err) {
    next(err);
  }
});

router.delete("/reservations/:id", async (req, res, next) => {
  try {
    await restaurantService.deleteReservation(req.tenantId!, req.params.id);
    await recordAudit(req, "delete", "restaurant_reservation", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// DASHBOARD
// ============================================================

router.get("/dashboard", async (req, res, next) => {
  try {
    res.json(await restaurantService.getDashboard(req.tenantId!));
  } catch (err) {
    next(err);
  }
});

export default router;
