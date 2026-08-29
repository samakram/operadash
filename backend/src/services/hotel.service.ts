import type {
  InvoiceStatus,
  MaintenancePriority,
  MaintenanceStatus,
  PaymentStatus,
  Prisma,
  RoomStatus,
  RoomType,
  TaskStatus,
  TaskType,
} from "@prisma/client";
import { prisma } from "@/database/db";
import { AppError } from "@/utils/errors";
import { emitToTenant } from "@/socket";
import { buildPaginatedResult, paginationToPrisma, type PaginationQuery } from "@/utils/validators";

// ============================================================
// Shared helpers
// ============================================================

/** Midnight UTC for "today" — matches how Prisma round-trips @db.Date columns. */
function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function diffDays(checkIn: Date, checkOut: Date): number {
  const ms = checkOut.getTime() - checkIn.getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function resolveSort<T extends string>(sortBy: string | undefined, allowed: readonly T[], fallback: T): T {
  return sortBy && (allowed as readonly string[]).includes(sortBy) ? (sortBy as T) : fallback;
}

/**
 * Clears occupancy on rooms whose latest reservation has already checked out.
 * Called lazily at the top of read paths that surface room/occupancy state,
 * since this module has no background scheduler.
 */
async function releaseExpiredOccupancy(tenantId: string): Promise<void> {
  const today = todayDateOnly();
  const occupiedRooms = await prisma.hotelRoom.findMany({
    where: { tenantId, status: "occupied", occupiedByGuestId: { not: null } },
    select: { id: true },
  });
  if (occupiedRooms.length === 0) return;

  const roomIds = occupiedRooms.map((r) => r.id);
  const stillActive = await prisma.hotelReservation.findMany({
    where: { tenantId, roomId: { in: roomIds }, checkOut: { gte: today } },
    select: { roomId: true },
  });
  const activeRoomIds = new Set(stillActive.map((r) => r.roomId));
  const toRelease = roomIds.filter((id) => !activeRoomIds.has(id));
  if (toRelease.length === 0) return;

  await prisma.hotelRoom.updateMany({
    where: { id: { in: toRelease } },
    data: { occupiedByGuestId: null, status: "vacant" },
  });
}

async function assertRoomInTenant(tenantId: string, roomId: string): Promise<void> {
  const room = await prisma.hotelRoom.findFirst({ where: { id: roomId, tenantId }, select: { id: true } });
  if (!room) throw AppError.badRequest("Room not found for this tenant");
}

async function assertGuestInTenant(tenantId: string, guestId: string): Promise<void> {
  const guest = await prisma.hotelGuest.findFirst({ where: { id: guestId, tenantId }, select: { id: true } });
  if (!guest) throw AppError.badRequest("Guest not found for this tenant");
}

// ============================================================
// Guests
// ============================================================

export interface GuestInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  checkInDate?: Date;
  checkOutDate?: Date;
  notes?: string;
  vip?: boolean;
}

const GUEST_SORT_FIELDS = ["firstName", "lastName", "email", "createdAt", "checkInDate", "checkOutDate"] as const;

function guestWhere(tenantId: string, search?: string): Prisma.HotelGuestWhereInput {
  if (!search) return { tenantId };
  return {
    tenantId,
    OR: [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { rooms: { some: { roomNumber: { contains: search, mode: "insensitive" } } } },
    ],
  };
}

export async function listGuests(tenantId: string, query: PaginationQuery) {
  const where = guestWhere(tenantId, query.search);
  const [data, total] = await Promise.all([
    prisma.hotelGuest.findMany({
      where,
      ...paginationToPrisma(query),
      orderBy: { [resolveSort(query.sortBy, GUEST_SORT_FIELDS, "createdAt")]: query.sortDir } as Prisma.HotelGuestOrderByWithRelationInput,
    }),
    prisma.hotelGuest.count({ where }),
  ]);
  return buildPaginatedResult(data, total, query);
}

export async function exportGuests(tenantId: string, search?: string) {
  return prisma.hotelGuest.findMany({ where: guestWhere(tenantId, search), orderBy: { createdAt: "desc" }, take: 10000 });
}

export async function createGuest(tenantId: string, input: GuestInput) {
  return prisma.hotelGuest.create({ data: { tenantId, ...input } });
}

export async function updateGuest(tenantId: string, id: string, input: Partial<GuestInput>) {
  const existing = await prisma.hotelGuest.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Guest not found");
  return prisma.hotelGuest.update({ where: { id }, data: input });
}

export async function deleteGuest(tenantId: string, id: string): Promise<void> {
  const existing = await prisma.hotelGuest.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Guest not found");
  await prisma.$transaction([
    prisma.hotelRoom.updateMany({ where: { tenantId, occupiedByGuestId: id }, data: { occupiedByGuestId: null, status: "vacant" } }),
    prisma.hotelGuest.delete({ where: { id } }),
  ]);
}

// ============================================================
// Rooms
// ============================================================

export interface RoomInput {
  roomNumber: string;
  roomType: RoomType;
  capacity: number;
  pricePerNight: number;
  status?: RoomStatus;
  floorNumber?: number;
  amenities?: string[];
  notes?: string;
}

const ROOM_SORT_FIELDS = ["roomNumber", "roomType", "capacity", "pricePerNight", "status", "createdAt"] as const;

function roomWhere(tenantId: string, search?: string): Prisma.HotelRoomWhereInput {
  if (!search) return { tenantId };
  return {
    tenantId,
    OR: [
      { roomNumber: { contains: search, mode: "insensitive" } },
      { notes: { contains: search, mode: "insensitive" } },
    ],
  };
}

export async function listRooms(tenantId: string, query: PaginationQuery) {
  await releaseExpiredOccupancy(tenantId);
  const where = roomWhere(tenantId, query.search);
  const [data, total] = await Promise.all([
    prisma.hotelRoom.findMany({
      where,
      ...paginationToPrisma(query),
      orderBy: { [resolveSort(query.sortBy, ROOM_SORT_FIELDS, "roomNumber")]: query.sortDir } as Prisma.HotelRoomOrderByWithRelationInput,
      include: { occupiedByGuest: true },
    }),
    prisma.hotelRoom.count({ where }),
  ]);
  return buildPaginatedResult(data, total, query);
}

export async function exportRooms(tenantId: string, search?: string) {
  await releaseExpiredOccupancy(tenantId);
  return prisma.hotelRoom.findMany({ where: roomWhere(tenantId, search), orderBy: { roomNumber: "asc" }, take: 10000 });
}

export async function createRoom(tenantId: string, input: RoomInput) {
  const dup = await prisma.hotelRoom.findFirst({ where: { tenantId, roomNumber: input.roomNumber } });
  if (dup) throw AppError.conflict("A room with this number already exists");
  return prisma.hotelRoom.create({ data: { tenantId, ...input, amenities: input.amenities ?? [] } });
}

export async function updateRoom(tenantId: string, id: string, input: Partial<RoomInput>) {
  const existing = await prisma.hotelRoom.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Room not found");
  if (input.roomNumber && input.roomNumber !== existing.roomNumber) {
    const dup = await prisma.hotelRoom.findFirst({ where: { tenantId, roomNumber: input.roomNumber, NOT: { id } } });
    if (dup) throw AppError.conflict("A room with this number already exists");
  }
  return prisma.hotelRoom.update({ where: { id }, data: input });
}

export async function deleteRoom(tenantId: string, id: string): Promise<void> {
  const existing = await prisma.hotelRoom.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Room not found");
  await prisma.hotelRoom.delete({ where: { id } });
}

// ============================================================
// Reservations
// ============================================================

export interface ReservationInput {
  guestId: string;
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  numberOfNights?: number;
  totalPrice?: number;
  paymentStatus?: PaymentStatus;
  paymentMethod?: string;
  notes?: string;
}

const RESERVATION_SORT_FIELDS = ["checkIn", "checkOut", "totalPrice", "paymentStatus", "createdAt"] as const;

function reservationWhere(tenantId: string, search?: string): Prisma.HotelReservationWhereInput {
  if (!search) return { tenantId };
  return {
    tenantId,
    OR: [
      { guest: { firstName: { contains: search, mode: "insensitive" } } },
      { guest: { lastName: { contains: search, mode: "insensitive" } } },
      { room: { roomNumber: { contains: search, mode: "insensitive" } } },
      { notes: { contains: search, mode: "insensitive" } },
    ],
  };
}

const reservationInclude = { guest: true, room: true } satisfies Prisma.HotelReservationInclude;

export async function listReservations(tenantId: string, query: PaginationQuery) {
  await releaseExpiredOccupancy(tenantId);
  const where = reservationWhere(tenantId, query.search);
  const [data, total] = await Promise.all([
    prisma.hotelReservation.findMany({
      where,
      ...paginationToPrisma(query),
      orderBy: { [resolveSort(query.sortBy, RESERVATION_SORT_FIELDS, "createdAt")]: query.sortDir } as Prisma.HotelReservationOrderByWithRelationInput,
      include: reservationInclude,
    }),
    prisma.hotelReservation.count({ where }),
  ]);
  return buildPaginatedResult(data, total, query);
}

export async function exportReservations(tenantId: string, search?: string) {
  return prisma.hotelReservation.findMany({
    where: reservationWhere(tenantId, search),
    orderBy: { createdAt: "desc" },
    include: reservationInclude,
    take: 10000,
  });
}

export async function createReservation(tenantId: string, input: ReservationInput) {
  if (input.checkOut <= input.checkIn) throw AppError.badRequest("checkOut must be after checkIn");

  const [, room] = await Promise.all([assertGuestInTenant(tenantId, input.guestId), prisma.hotelRoom.findFirst({ where: { id: input.roomId, tenantId } })]);
  if (!room) throw AppError.badRequest("Room not found for this tenant");

  const numberOfNights = input.numberOfNights ?? diffDays(input.checkIn, input.checkOut);
  const totalPrice = input.totalPrice ?? numberOfNights * room.pricePerNight.toNumber();

  return prisma.$transaction(async (tx) => {
    const created = await tx.hotelReservation.create({
      data: {
        tenantId,
        guestId: input.guestId,
        roomId: input.roomId,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        numberOfNights,
        totalPrice,
        paymentStatus: input.paymentStatus ?? "pending",
        paymentMethod: input.paymentMethod,
        notes: input.notes,
      },
      include: reservationInclude,
    });
    await tx.hotelRoom.update({ where: { id: input.roomId }, data: { occupiedByGuestId: input.guestId, status: "occupied" } });
    return created;
  });
}

export async function updateReservation(tenantId: string, id: string, input: Partial<ReservationInput>) {
  const existing = await prisma.hotelReservation.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Reservation not found");

  if (input.guestId) await assertGuestInTenant(tenantId, input.guestId);

  const nextRoomId = input.roomId ?? existing.roomId;
  const nextGuestId = input.guestId ?? existing.guestId;
  const nextCheckIn = input.checkIn ?? existing.checkIn;
  const nextCheckOut = input.checkOut ?? existing.checkOut;
  if (nextCheckOut <= nextCheckIn) throw AppError.badRequest("checkOut must be after checkIn");

  const targetRoom = await prisma.hotelRoom.findFirst({ where: { id: nextRoomId, tenantId } });
  if (!targetRoom) throw AppError.badRequest("Room not found for this tenant");

  const datesOrRoomChanged = Boolean(input.checkIn || input.checkOut || input.roomId);
  const numberOfNights = input.numberOfNights ?? (datesOrRoomChanged ? diffDays(nextCheckIn, nextCheckOut) : existing.numberOfNights ?? diffDays(nextCheckIn, nextCheckOut));
  const totalPrice = input.totalPrice ?? (datesOrRoomChanged ? numberOfNights * targetRoom.pricePerNight.toNumber() : existing.totalPrice.toNumber());

  return prisma.$transaction(async (tx) => {
    const updated = await tx.hotelReservation.update({
      where: { id },
      data: {
        guestId: input.guestId,
        roomId: input.roomId,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        numberOfNights,
        totalPrice,
        paymentStatus: input.paymentStatus,
        paymentMethod: input.paymentMethod,
        notes: input.notes,
      },
      include: reservationInclude,
    });

    if (input.roomId && input.roomId !== existing.roomId) {
      const oldRoom = await tx.hotelRoom.findUnique({ where: { id: existing.roomId } });
      if (oldRoom && oldRoom.occupiedByGuestId === existing.guestId) {
        await tx.hotelRoom.update({ where: { id: existing.roomId }, data: { occupiedByGuestId: null, status: "vacant" } });
      }
      await tx.hotelRoom.update({ where: { id: input.roomId }, data: { occupiedByGuestId: nextGuestId, status: "occupied" } });
    } else if (input.guestId && input.guestId !== existing.guestId) {
      await tx.hotelRoom.update({ where: { id: nextRoomId }, data: { occupiedByGuestId: nextGuestId, status: "occupied" } });
    }

    return updated;
  });
}

export async function deleteReservation(tenantId: string, id: string): Promise<void> {
  const existing = await prisma.hotelReservation.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Reservation not found");

  await prisma.$transaction(async (tx) => {
    await tx.hotelReservation.delete({ where: { id } });
    const room = await tx.hotelRoom.findUnique({ where: { id: existing.roomId } });
    if (room && room.occupiedByGuestId === existing.guestId) {
      await tx.hotelRoom.update({ where: { id: existing.roomId }, data: { occupiedByGuestId: null, status: "vacant" } });
    }
  });
}

// ============================================================
// Staff assignments (tasks)
// ============================================================

export interface TaskInput {
  staffUserId: string;
  roomId: string;
  taskType: TaskType;
  status?: TaskStatus;
  assignedDate: Date;
  completedDate?: Date;
  notes?: string;
}

const TASK_SORT_FIELDS = ["assignedDate", "taskType", "status", "createdAt"] as const;

function taskWhere(tenantId: string, search?: string): Prisma.HotelStaffAssignmentWhereInput {
  if (!search) return { tenantId };
  return {
    tenantId,
    OR: [
      { notes: { contains: search, mode: "insensitive" } },
      { room: { roomNumber: { contains: search, mode: "insensitive" } } },
    ],
  };
}

const taskInclude = { room: true } satisfies Prisma.HotelStaffAssignmentInclude;

export async function listTasks(tenantId: string, query: PaginationQuery) {
  const where = taskWhere(tenantId, query.search);
  const [data, total] = await Promise.all([
    prisma.hotelStaffAssignment.findMany({
      where,
      ...paginationToPrisma(query),
      orderBy: { [resolveSort(query.sortBy, TASK_SORT_FIELDS, "assignedDate")]: query.sortDir } as Prisma.HotelStaffAssignmentOrderByWithRelationInput,
      include: taskInclude,
    }),
    prisma.hotelStaffAssignment.count({ where }),
  ]);
  return buildPaginatedResult(data, total, query);
}

export async function exportTasks(tenantId: string, search?: string) {
  return prisma.hotelStaffAssignment.findMany({ where: taskWhere(tenantId, search), orderBy: { assignedDate: "desc" }, include: taskInclude, take: 10000 });
}

export async function createTask(tenantId: string, input: TaskInput) {
  await assertRoomInTenant(tenantId, input.roomId);

  const status = input.status ?? "pending";
  const completedDate = status === "completed" ? (input.completedDate ?? todayDateOnly()) : input.completedDate;

  const task = await prisma.hotelStaffAssignment.create({
    data: {
      tenantId,
      staffUserId: input.staffUserId,
      roomId: input.roomId,
      taskType: input.taskType,
      status,
      assignedDate: input.assignedDate,
      completedDate,
      notes: input.notes,
    },
    include: taskInclude,
  });

  emitToTenant(tenantId, "hotel:task-updated", task);
  return task;
}

export async function updateTask(tenantId: string, id: string, input: Partial<TaskInput>) {
  const existing = await prisma.hotelStaffAssignment.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Task not found");
  if (input.roomId) await assertRoomInTenant(tenantId, input.roomId);

  const nextStatus = input.status ?? existing.status;
  let completedDate = input.completedDate !== undefined ? input.completedDate : existing.completedDate;
  if (nextStatus === "completed" && !completedDate) {
    completedDate = todayDateOnly();
  }

  const task = await prisma.hotelStaffAssignment.update({
    where: { id },
    data: {
      staffUserId: input.staffUserId,
      roomId: input.roomId,
      taskType: input.taskType,
      status: input.status,
      assignedDate: input.assignedDate,
      completedDate,
      notes: input.notes,
    },
    include: taskInclude,
  });

  emitToTenant(tenantId, "hotel:task-updated", task);
  return task;
}

export async function deleteTask(tenantId: string, id: string): Promise<void> {
  const existing = await prisma.hotelStaffAssignment.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Task not found");
  await prisma.hotelStaffAssignment.delete({ where: { id } });
}

// ============================================================
// Maintenance requests
// ============================================================

export interface MaintenanceInput {
  roomId: string;
  issueDescription: string;
  priority?: MaintenancePriority;
  status?: MaintenanceStatus;
  assignedTo?: string;
}

const MAINTENANCE_SORT_FIELDS = ["priority", "status", "createdAt", "completedAt"] as const;

function maintenanceWhere(tenantId: string, search?: string): Prisma.HotelMaintenanceRequestWhereInput {
  if (!search) return { tenantId };
  return {
    tenantId,
    OR: [
      { issueDescription: { contains: search, mode: "insensitive" } },
      { room: { roomNumber: { contains: search, mode: "insensitive" } } },
    ],
  };
}

const maintenanceInclude = { room: true } satisfies Prisma.HotelMaintenanceRequestInclude;

function isDoneStatus(status: MaintenanceStatus): boolean {
  return status === "completed" || status === "closed";
}

export async function listMaintenanceRequests(tenantId: string, query: PaginationQuery) {
  const where = maintenanceWhere(tenantId, query.search);
  const [data, total] = await Promise.all([
    prisma.hotelMaintenanceRequest.findMany({
      where,
      ...paginationToPrisma(query),
      orderBy: { [resolveSort(query.sortBy, MAINTENANCE_SORT_FIELDS, "createdAt")]: query.sortDir } as Prisma.HotelMaintenanceRequestOrderByWithRelationInput,
      include: maintenanceInclude,
    }),
    prisma.hotelMaintenanceRequest.count({ where }),
  ]);
  return buildPaginatedResult(data, total, query);
}

export async function exportMaintenanceRequests(tenantId: string, search?: string) {
  return prisma.hotelMaintenanceRequest.findMany({
    where: maintenanceWhere(tenantId, search),
    orderBy: { createdAt: "desc" },
    include: maintenanceInclude,
    take: 10000,
  });
}

export async function createMaintenanceRequest(tenantId: string, input: MaintenanceInput) {
  await assertRoomInTenant(tenantId, input.roomId);
  const status = input.status ?? "open";
  const completedAt = isDoneStatus(status) ? new Date() : undefined;

  return prisma.hotelMaintenanceRequest.create({
    data: {
      tenantId,
      roomId: input.roomId,
      issueDescription: input.issueDescription,
      priority: input.priority ?? "medium",
      status,
      assignedTo: input.assignedTo,
      completedAt,
    },
    include: maintenanceInclude,
  });
}

export async function updateMaintenanceRequest(tenantId: string, id: string, input: Partial<MaintenanceInput>) {
  const existing = await prisma.hotelMaintenanceRequest.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Maintenance request not found");
  if (input.roomId) await assertRoomInTenant(tenantId, input.roomId);

  const nextStatus = input.status ?? existing.status;
  const becameDone = isDoneStatus(nextStatus);
  const wasDone = isDoneStatus(existing.status);
  const completedAt = becameDone ? (existing.completedAt ?? new Date()) : wasDone ? null : existing.completedAt;

  return prisma.hotelMaintenanceRequest.update({
    where: { id },
    data: {
      roomId: input.roomId,
      issueDescription: input.issueDescription,
      priority: input.priority,
      status: input.status,
      assignedTo: input.assignedTo,
      completedAt,
    },
    include: maintenanceInclude,
  });
}

export async function deleteMaintenanceRequest(tenantId: string, id: string): Promise<void> {
  const existing = await prisma.hotelMaintenanceRequest.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Maintenance request not found");
  await prisma.hotelMaintenanceRequest.delete({ where: { id } });
}

// ============================================================
// Invoices
// ============================================================

export interface InvoiceInput {
  guestId: string;
  reservationId: string;
  amount: number;
  tax?: number;
  totalAmount?: number;
  paidAt?: Date;
  paymentMethod?: string;
  status?: InvoiceStatus;
}

const INVOICE_SORT_FIELDS = ["amount", "totalAmount", "status", "paidAt", "createdAt"] as const;

function invoiceWhere(tenantId: string, search?: string): Prisma.HotelInvoiceWhereInput {
  if (!search) return { tenantId };
  return {
    tenantId,
    OR: [
      { guest: { firstName: { contains: search, mode: "insensitive" } } },
      { guest: { lastName: { contains: search, mode: "insensitive" } } },
      { paymentMethod: { contains: search, mode: "insensitive" } },
    ],
  };
}

const invoiceInclude = { guest: true, reservation: true } satisfies Prisma.HotelInvoiceInclude;

async function assertReservationInTenant(tenantId: string, reservationId: string): Promise<void> {
  const reservation = await prisma.hotelReservation.findFirst({ where: { id: reservationId, tenantId }, select: { id: true } });
  if (!reservation) throw AppError.badRequest("Reservation not found for this tenant");
}

export async function listInvoices(tenantId: string, query: PaginationQuery) {
  const where = invoiceWhere(tenantId, query.search);
  const [data, total] = await Promise.all([
    prisma.hotelInvoice.findMany({
      where,
      ...paginationToPrisma(query),
      orderBy: { [resolveSort(query.sortBy, INVOICE_SORT_FIELDS, "createdAt")]: query.sortDir } as Prisma.HotelInvoiceOrderByWithRelationInput,
      include: invoiceInclude,
    }),
    prisma.hotelInvoice.count({ where }),
  ]);
  return buildPaginatedResult(data, total, query);
}

export async function exportInvoices(tenantId: string, search?: string) {
  return prisma.hotelInvoice.findMany({ where: invoiceWhere(tenantId, search), orderBy: { createdAt: "desc" }, include: invoiceInclude, take: 10000 });
}

export async function createInvoice(tenantId: string, input: InvoiceInput) {
  await Promise.all([assertGuestInTenant(tenantId, input.guestId), assertReservationInTenant(tenantId, input.reservationId)]);

  const tax = input.tax ?? 0;
  const totalAmount = input.totalAmount ?? input.amount + tax;

  return prisma.hotelInvoice.create({
    data: {
      tenantId,
      guestId: input.guestId,
      reservationId: input.reservationId,
      amount: input.amount,
      tax: input.tax,
      totalAmount,
      paidAt: input.paidAt,
      paymentMethod: input.paymentMethod,
      status: input.status ?? "unpaid",
    },
    include: invoiceInclude,
  });
}

export async function updateInvoice(tenantId: string, id: string, input: Partial<InvoiceInput>) {
  const existing = await prisma.hotelInvoice.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Invoice not found");

  if (input.guestId) await assertGuestInTenant(tenantId, input.guestId);
  if (input.reservationId) await assertReservationInTenant(tenantId, input.reservationId);

  const nextAmount = input.amount ?? existing.amount.toNumber();
  const nextTax = input.tax ?? existing.tax.toNumber();
  const totalAmount = input.totalAmount ?? nextAmount + nextTax;

  return prisma.hotelInvoice.update({
    where: { id },
    data: {
      guestId: input.guestId,
      reservationId: input.reservationId,
      amount: input.amount,
      tax: input.tax,
      totalAmount,
      paidAt: input.paidAt,
      paymentMethod: input.paymentMethod,
      status: input.status,
    },
    include: invoiceInclude,
  });
}

export async function deleteInvoice(tenantId: string, id: string): Promise<void> {
  const existing = await prisma.hotelInvoice.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Invoice not found");
  await prisma.hotelInvoice.delete({ where: { id } });
}

export async function cloneInvoice(tenantId: string, id: string) {
  const existing = await prisma.hotelInvoice.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Invoice not found");

  return prisma.hotelInvoice.create({
    data: {
      tenantId,
      guestId: existing.guestId,
      reservationId: existing.reservationId,
      amount: existing.amount,
      tax: existing.tax,
      totalAmount: existing.totalAmount,
      paymentMethod: existing.paymentMethod,
      status: "unpaid",
    },
    include: invoiceInclude,
  });
}

// ============================================================
// Dashboard
// ============================================================

export interface StaffOnDutySummary {
  staffUserId: string;
  staffName: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
}

export async function getDashboard(tenantId: string) {
  await releaseExpiredOccupancy(tenantId);

  const today = todayDateOnly();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const [totalRooms, occupiedRooms, revenueAgg, guestsArrivingToday, maintenanceAlerts, recentActivity, staffAssignmentsToday] = await Promise.all([
    prisma.hotelRoom.count({ where: { tenantId } }),
    prisma.hotelRoom.count({ where: { tenantId, status: "occupied" } }),
    prisma.hotelInvoice.aggregate({ where: { tenantId, paidAt: { gte: today, lt: tomorrow } }, _sum: { totalAmount: true } }),
    prisma.hotelReservation.count({ where: { tenantId, checkIn: today } }),
    prisma.hotelMaintenanceRequest.count({ where: { tenantId, status: { in: ["open", "in_progress"] } } }),
    prisma.hotelReservation.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 5, include: reservationInclude }),
    prisma.hotelStaffAssignment.findMany({ where: { tenantId, assignedDate: today } }),
  ]);

  const occupancyRate = totalRooms === 0 ? 0 : Math.round((occupiedRooms / totalRooms) * 1000) / 10;

  const staffIds = [...new Set(staffAssignmentsToday.map((a) => a.staffUserId))];
  const staffUsers = staffIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: staffIds }, tenantId }, select: { id: true, firstName: true, lastName: true, email: true } })
    : [];
  const staffNameMap = new Map(staffUsers.map((u) => [u.id, `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email]));

  const staffOnDuty: StaffOnDutySummary[] = staffIds.map((staffUserId) => {
    const tasks = staffAssignmentsToday.filter((a) => a.staffUserId === staffUserId);
    return {
      staffUserId,
      staffName: staffNameMap.get(staffUserId) ?? "Unknown staff member",
      totalTasks: tasks.length,
      completedTasks: tasks.filter((t) => t.status === "completed").length,
      pendingTasks: tasks.filter((t) => t.status === "pending").length,
      inProgressTasks: tasks.filter((t) => t.status === "in_progress").length,
    };
  });

  return {
    occupancyRate,
    occupiedRooms,
    totalRooms,
    revenueToday: revenueAgg._sum.totalAmount?.toNumber() ?? 0,
    guestsArrivingToday,
    maintenanceAlerts,
    recentActivity,
    staffOnDuty,
  };
}
