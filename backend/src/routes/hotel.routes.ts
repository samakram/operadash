import { Router } from "express";
import { z } from "zod";
import * as hotelService from "@/services/hotel.service";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenantIsolation";
import { requireModule } from "@/middleware/moduleGuard";
import { requireFeature } from "@/middleware/featureGuard";
import { paginationSchema } from "@/utils/validators";
import { sendCsv } from "@/utils/csv";
import { recordAudit } from "@/utils/audit";
import { AppError } from "@/utils/errors";

const router = Router();
router.use(authenticate, resolveTenant, requireModule("hotel"));
// Staff can read/create/update within the module; deleting is admin-only.
router.delete("*", requireRole("tenant_admin", "super_admin"));
// Optional sub-features a tenant admin can turn off — see utils/featureCatalog.ts.
router.use("/tasks", requireFeature("hotel", "tasks"));
router.use("/maintenance", requireFeature("hotel", "maintenance"));
router.use("/invoices", requireFeature("hotel", "invoices"));

// ============================================================
// Shared zod helpers
// ============================================================

const emptyToUndefined = (val: unknown): unknown => (val === "" ? undefined : val);
const optionalString = (max?: number) => z.preprocess(emptyToUndefined, max ? z.string().max(max).optional() : z.string().optional());
const optionalEmail = () => z.preprocess(emptyToUndefined, z.string().email().optional());
const optionalDate = () => z.preprocess(emptyToUndefined, z.coerce.date().optional());
const optionalUuid = () => z.preprocess(emptyToUndefined, z.string().uuid().optional());

const roomTypeEnum = z.enum(["single", "double", "suite", "deluxe"]);
const roomStatusEnum = z.enum(["vacant", "occupied", "cleaning", "maintenance"]);
const paymentStatusEnum = z.enum(["pending", "paid", "partial", "refunded"]);
const taskTypeEnum = z.enum(["cleaning", "maintenance", "check_in", "check_out"]);
const taskStatusEnum = z.enum(["pending", "in_progress", "completed"]);
const maintenancePriorityEnum = z.enum(["low", "medium", "high", "urgent"]);
const maintenanceStatusEnum = z.enum(["open", "in_progress", "completed", "closed"]);
const invoiceStatusEnum = z.enum(["unpaid", "paid", "partial"]);

function tenantId(req: import("express").Request): string {
  if (!req.tenantId) throw AppError.forbidden("No tenant resolved for this request");
  return req.tenantId;
}

// ============================================================
// Guests
// ============================================================

const guestBaseSchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  email: optionalEmail(),
  phone: optionalString(20),
  address: optionalString(),
  city: optionalString(255),
  country: optionalString(255),
  checkInDate: optionalDate(),
  checkOutDate: optionalDate(),
  notes: optionalString(),
  vip: z.boolean().optional(),
});
const createGuestSchema = guestBaseSchema;
const updateGuestSchema = guestBaseSchema.partial();

router.get("/guests", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await hotelService.listGuests(tenantId(req), query));
  } catch (err) {
    next(err);
  }
});

router.get("/guests/export", async (req, res, next) => {
  try {
    const rows = await hotelService.exportGuests(tenantId(req), req.query.search as string | undefined);
    sendCsv(res, "hotel-guests.csv", JSON.parse(JSON.stringify(rows)));
  } catch (err) {
    next(err);
  }
});

router.post("/guests", async (req, res, next) => {
  try {
    const input = createGuestSchema.parse(req.body);
    const guest = await hotelService.createGuest(tenantId(req), input);
    await recordAudit(req, "create", "HotelGuest", guest.id, input);
    res.status(201).json(guest);
  } catch (err) {
    next(err);
  }
});

router.patch("/guests/:id", async (req, res, next) => {
  try {
    const input = updateGuestSchema.parse(req.body);
    const guest = await hotelService.updateGuest(tenantId(req), req.params.id, input);
    await recordAudit(req, "update", "HotelGuest", guest.id, input);
    res.json(guest);
  } catch (err) {
    next(err);
  }
});

router.delete("/guests/:id", async (req, res, next) => {
  try {
    await hotelService.deleteGuest(tenantId(req), req.params.id);
    await recordAudit(req, "delete", "HotelGuest", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Rooms
// ============================================================

const roomBaseSchema = z.object({
  roomNumber: z.string().min(1).max(50),
  roomType: roomTypeEnum,
  capacity: z.coerce.number().int().min(1),
  pricePerNight: z.coerce.number().nonnegative(),
  status: z.preprocess(emptyToUndefined, roomStatusEnum.optional()),
  floorNumber: z.coerce.number().int().optional(),
  amenities: z.array(z.string()).optional(),
  notes: optionalString(),
});
const createRoomSchema = roomBaseSchema;
const updateRoomSchema = roomBaseSchema.partial();

router.get("/rooms", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await hotelService.listRooms(tenantId(req), query));
  } catch (err) {
    next(err);
  }
});

router.get("/rooms/export", async (req, res, next) => {
  try {
    const rows = await hotelService.exportRooms(tenantId(req), req.query.search as string | undefined);
    sendCsv(res, "hotel-rooms.csv", JSON.parse(JSON.stringify(rows)));
  } catch (err) {
    next(err);
  }
});

router.post("/rooms", async (req, res, next) => {
  try {
    const input = createRoomSchema.parse(req.body);
    const room = await hotelService.createRoom(tenantId(req), input);
    await recordAudit(req, "create", "HotelRoom", room.id, input);
    res.status(201).json(room);
  } catch (err) {
    next(err);
  }
});

router.patch("/rooms/:id", async (req, res, next) => {
  try {
    const input = updateRoomSchema.parse(req.body);
    const room = await hotelService.updateRoom(tenantId(req), req.params.id, input);
    await recordAudit(req, "update", "HotelRoom", room.id, input);
    res.json(room);
  } catch (err) {
    next(err);
  }
});

router.delete("/rooms/:id", async (req, res, next) => {
  try {
    await hotelService.deleteRoom(tenantId(req), req.params.id);
    await recordAudit(req, "delete", "HotelRoom", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Reservations
// ============================================================

const reservationBaseSchema = z.object({
  guestId: z.string().uuid(),
  roomId: z.string().uuid(),
  checkIn: z.coerce.date(),
  checkOut: z.coerce.date(),
  numberOfNights: z.coerce.number().int().positive().optional(),
  totalPrice: z.coerce.number().nonnegative().optional(),
  paymentStatus: z.preprocess(emptyToUndefined, paymentStatusEnum.optional()),
  paymentMethod: optionalString(100),
  notes: optionalString(),
});
const createReservationSchema = reservationBaseSchema;
const updateReservationSchema = reservationBaseSchema.partial();

router.get("/reservations", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await hotelService.listReservations(tenantId(req), query));
  } catch (err) {
    next(err);
  }
});

router.get("/reservations/export", async (req, res, next) => {
  try {
    const rows = await hotelService.exportReservations(tenantId(req), req.query.search as string | undefined);
    sendCsv(res, "hotel-reservations.csv", JSON.parse(JSON.stringify(rows)));
  } catch (err) {
    next(err);
  }
});

router.post("/reservations", async (req, res, next) => {
  try {
    const input = createReservationSchema.parse(req.body);
    const reservation = await hotelService.createReservation(tenantId(req), input);
    await recordAudit(req, "create", "HotelReservation", reservation.id, input);
    res.status(201).json(reservation);
  } catch (err) {
    next(err);
  }
});

router.patch("/reservations/:id", async (req, res, next) => {
  try {
    const input = updateReservationSchema.parse(req.body);
    const reservation = await hotelService.updateReservation(tenantId(req), req.params.id, input);
    await recordAudit(req, "update", "HotelReservation", reservation.id, input);
    res.json(reservation);
  } catch (err) {
    next(err);
  }
});

router.delete("/reservations/:id", async (req, res, next) => {
  try {
    await hotelService.deleteReservation(tenantId(req), req.params.id);
    await recordAudit(req, "delete", "HotelReservation", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Staff assignments (tasks)
// ============================================================

const taskBaseSchema = z.object({
  staffUserId: z.string().uuid(),
  roomId: z.string().uuid(),
  taskType: taskTypeEnum,
  status: z.preprocess(emptyToUndefined, taskStatusEnum.optional()),
  assignedDate: z.coerce.date(),
  completedDate: optionalDate(),
  notes: optionalString(),
});
const createTaskSchema = taskBaseSchema;
const updateTaskSchema = taskBaseSchema.partial();

router.get("/tasks", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await hotelService.listTasks(tenantId(req), query));
  } catch (err) {
    next(err);
  }
});

router.get("/tasks/export", async (req, res, next) => {
  try {
    const rows = await hotelService.exportTasks(tenantId(req), req.query.search as string | undefined);
    sendCsv(res, "hotel-tasks.csv", JSON.parse(JSON.stringify(rows)));
  } catch (err) {
    next(err);
  }
});

router.post("/tasks", async (req, res, next) => {
  try {
    const input = createTaskSchema.parse(req.body);
    const task = await hotelService.createTask(tenantId(req), input);
    await recordAudit(req, "create", "HotelStaffAssignment", task.id, input);
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

router.patch("/tasks/:id", async (req, res, next) => {
  try {
    const input = updateTaskSchema.parse(req.body);
    const task = await hotelService.updateTask(tenantId(req), req.params.id, input);
    await recordAudit(req, "update", "HotelStaffAssignment", task.id, input);
    res.json(task);
  } catch (err) {
    next(err);
  }
});

router.delete("/tasks/:id", async (req, res, next) => {
  try {
    await hotelService.deleteTask(tenantId(req), req.params.id);
    await recordAudit(req, "delete", "HotelStaffAssignment", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Maintenance requests
// ============================================================

const maintenanceBaseSchema = z.object({
  roomId: z.string().uuid(),
  issueDescription: z.string().min(1),
  priority: z.preprocess(emptyToUndefined, maintenancePriorityEnum.optional()),
  status: z.preprocess(emptyToUndefined, maintenanceStatusEnum.optional()),
  assignedTo: optionalUuid(),
});
const createMaintenanceSchema = maintenanceBaseSchema;
const updateMaintenanceSchema = maintenanceBaseSchema.partial();

router.get("/maintenance", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await hotelService.listMaintenanceRequests(tenantId(req), query));
  } catch (err) {
    next(err);
  }
});

router.get("/maintenance/export", async (req, res, next) => {
  try {
    const rows = await hotelService.exportMaintenanceRequests(tenantId(req), req.query.search as string | undefined);
    sendCsv(res, "hotel-maintenance.csv", JSON.parse(JSON.stringify(rows)));
  } catch (err) {
    next(err);
  }
});

router.post("/maintenance", async (req, res, next) => {
  try {
    const input = createMaintenanceSchema.parse(req.body);
    const request = await hotelService.createMaintenanceRequest(tenantId(req), input);
    await recordAudit(req, "create", "HotelMaintenanceRequest", request.id, input);
    res.status(201).json(request);
  } catch (err) {
    next(err);
  }
});

router.patch("/maintenance/:id", async (req, res, next) => {
  try {
    const input = updateMaintenanceSchema.parse(req.body);
    const request = await hotelService.updateMaintenanceRequest(tenantId(req), req.params.id, input);
    await recordAudit(req, "update", "HotelMaintenanceRequest", request.id, input);
    res.json(request);
  } catch (err) {
    next(err);
  }
});

router.delete("/maintenance/:id", async (req, res, next) => {
  try {
    await hotelService.deleteMaintenanceRequest(tenantId(req), req.params.id);
    await recordAudit(req, "delete", "HotelMaintenanceRequest", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Invoices
// ============================================================

const invoiceBaseSchema = z.object({
  guestId: z.string().uuid(),
  reservationId: z.string().uuid(),
  amount: z.coerce.number().nonnegative(),
  tax: z.coerce.number().nonnegative().optional(),
  totalAmount: z.coerce.number().nonnegative().optional(),
  paidAt: optionalDate(),
  paymentMethod: optionalString(100),
  status: z.preprocess(emptyToUndefined, invoiceStatusEnum.optional()),
});
const createInvoiceSchema = invoiceBaseSchema;
const updateInvoiceSchema = invoiceBaseSchema.partial();

router.get("/invoices", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await hotelService.listInvoices(tenantId(req), query));
  } catch (err) {
    next(err);
  }
});

router.get("/invoices/export", async (req, res, next) => {
  try {
    const rows = await hotelService.exportInvoices(tenantId(req), req.query.search as string | undefined);
    sendCsv(res, "hotel-invoices.csv", JSON.parse(JSON.stringify(rows)));
  } catch (err) {
    next(err);
  }
});

router.post("/invoices", async (req, res, next) => {
  try {
    const input = createInvoiceSchema.parse(req.body);
    const invoice = await hotelService.createInvoice(tenantId(req), input);
    await recordAudit(req, "create", "HotelInvoice", invoice.id, input);
    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
});

router.patch("/invoices/:id", async (req, res, next) => {
  try {
    const input = updateInvoiceSchema.parse(req.body);
    const invoice = await hotelService.updateInvoice(tenantId(req), req.params.id, input);
    await recordAudit(req, "update", "HotelInvoice", invoice.id, input);
    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

router.delete("/invoices/:id", async (req, res, next) => {
  try {
    await hotelService.deleteInvoice(tenantId(req), req.params.id);
    await recordAudit(req, "delete", "HotelInvoice", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Dashboard
// ============================================================

router.get("/dashboard", async (req, res, next) => {
  try {
    res.json(await hotelService.getDashboard(tenantId(req)));
  } catch (err) {
    next(err);
  }
});

export default router;
