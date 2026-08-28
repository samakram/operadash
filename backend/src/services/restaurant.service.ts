import type {
  InventoryReason,
  InventoryUnit,
  MenuCategory,
  OrderItemStatus,
  OrderStatus,
  Prisma,
  ReservationStatus,
  ShiftRole,
  ShiftStatus,
  TableStatus,
} from "@prisma/client";
import { prisma } from "@/database/db";
import { AppError } from "@/utils/errors";
import { emitToTenant } from "@/socket";
import { buildPaginatedResult, type PaginationQuery } from "@/utils/validators";

const TAX_RATE = 0.08;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfTomorrowUTC(): Date {
  const start = startOfTodayUTC();
  start.setUTCDate(start.getUTCDate() + 1);
  return start;
}

function generateOrderNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${stamp}${suffix}`;
}

// ============================================================
// MENU ITEMS
// ============================================================

export interface MenuItemListQuery extends PaginationQuery {
  category?: MenuCategory;
  available?: boolean;
}

export interface MenuItemInput {
  name: string;
  description?: string;
  price: number;
  category: MenuCategory;
  imageUrl?: string;
  available?: boolean;
  prepTimeMinutes?: number;
  calories?: number;
  dietaryTags?: string[];
}

function menuItemWhere(tenantId: string, query: { search?: string; category?: MenuCategory; available?: boolean }): Prisma.RestaurantMenuItemWhereInput {
  return {
    tenantId,
    ...(query.category ? { category: query.category } : {}),
    ...(query.available !== undefined ? { available: query.available } : {}),
    ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
  };
}

export async function listMenuItems(tenantId: string, query: MenuItemListQuery) {
  const where = menuItemWhere(tenantId, query);
  const [data, total] = await Promise.all([
    prisma.restaurantMenuItem.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.restaurantMenuItem.count({ where }),
  ]);
  return buildPaginatedResult(data, total, query);
}

export async function listMenuItemsForExport(tenantId: string, search?: string, category?: MenuCategory, available?: boolean) {
  return prisma.restaurantMenuItem.findMany({ where: menuItemWhere(tenantId, { search, category, available }), orderBy: { createdAt: "desc" } });
}

async function getMenuItemOrThrow(tenantId: string, id: string) {
  const item = await prisma.restaurantMenuItem.findFirst({ where: { id, tenantId } });
  if (!item) throw AppError.notFound("Menu item not found");
  return item;
}

export async function createMenuItem(tenantId: string, input: MenuItemInput) {
  return prisma.restaurantMenuItem.create({
    data: {
      tenantId,
      name: input.name,
      description: input.description,
      price: input.price,
      category: input.category,
      imageUrl: input.imageUrl,
      available: input.available ?? true,
      prepTimeMinutes: input.prepTimeMinutes,
      calories: input.calories,
      dietaryTags: input.dietaryTags ?? [],
    },
  });
}

export async function updateMenuItem(tenantId: string, id: string, input: Partial<MenuItemInput>) {
  await getMenuItemOrThrow(tenantId, id);
  return prisma.restaurantMenuItem.update({ where: { id }, data: input });
}

export async function deleteMenuItem(tenantId: string, id: string): Promise<void> {
  await getMenuItemOrThrow(tenantId, id);
  await prisma.restaurantMenuItem.delete({ where: { id } });
}

// ============================================================
// ORDERS + ORDER ITEMS
// ============================================================

const orderInclude = {
  items: { include: { menuItem: true } },
  table: true,
  customer: true,
} satisfies Prisma.RestaurantOrderInclude;

export interface OrderListQuery extends PaginationQuery {
  status?: OrderStatus;
}

export interface OrderItemInput {
  menuItemId: string;
  quantity: number;
  specialRequests?: string;
}

export interface CreateOrderInput {
  tableId?: string;
  customerId?: string;
  items: OrderItemInput[];
  notes?: string;
}

export interface UpdateOrderInput {
  status?: OrderStatus;
  notes?: string;
  paymentMethod?: string;
  tableId?: string | null;
}

function orderWhere(tenantId: string, query: { search?: string; status?: OrderStatus }): Prisma.RestaurantOrderWhereInput {
  return {
    tenantId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.search ? { orderNumber: { contains: query.search, mode: "insensitive" } } : {}),
  };
}

export async function listOrders(tenantId: string, query: OrderListQuery) {
  const where = orderWhere(tenantId, query);
  const [data, total] = await Promise.all([
    prisma.restaurantOrder.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: { orderTime: "desc" },
      include: orderInclude,
    }),
    prisma.restaurantOrder.count({ where }),
  ]);
  return buildPaginatedResult(data, total, query);
}

export async function listOrdersForExport(tenantId: string, search?: string, status?: OrderStatus) {
  return prisma.restaurantOrder.findMany({
    where: orderWhere(tenantId, { search, status }),
    orderBy: { orderTime: "desc" },
    include: orderInclude,
  });
}

export async function createOrder(tenantId: string, input: CreateOrderInput) {
  if (input.items.length === 0) {
    throw AppError.badRequest("An order must contain at least one item");
  }

  if (input.tableId) {
    const table = await prisma.restaurantTable.findFirst({ where: { id: input.tableId, tenantId } });
    if (!table) throw AppError.badRequest("Table not found");
  }
  if (input.customerId) {
    const customer = await prisma.restaurantCustomer.findFirst({ where: { id: input.customerId, tenantId } });
    if (!customer) throw AppError.badRequest("Customer not found");
  }

  const menuItemIds = [...new Set(input.items.map((item) => item.menuItemId))];
  const menuItems = await prisma.restaurantMenuItem.findMany({ where: { id: { in: menuItemIds }, tenantId } });
  const menuItemMap = new Map(menuItems.map((item) => [item.id, item]));
  for (const item of input.items) {
    if (!menuItemMap.has(item.menuItemId)) {
      throw AppError.badRequest(`Menu item ${item.menuItemId} was not found`);
    }
  }

  let subtotal = 0;
  let itemsCount = 0;
  for (const item of input.items) {
    const menuItem = menuItemMap.get(item.menuItemId)!;
    subtotal += Number(menuItem.price) * item.quantity;
    itemsCount += item.quantity;
  }
  const tax = round2(subtotal * TAX_RATE);
  const totalAmount = round2(subtotal + tax);
  subtotal = round2(subtotal);

  const order = await prisma.$transaction(async (tx) => {
    let orderNumber = generateOrderNumber();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const clash = await tx.restaurantOrder.findUnique({ where: { orderNumber } });
      if (!clash) break;
      orderNumber = generateOrderNumber();
    }

    const created = await tx.restaurantOrder.create({
      data: {
        tenantId,
        orderNumber,
        tableId: input.tableId,
        customerId: input.customerId,
        status: "pending",
        itemsCount,
        subtotal,
        tax,
        totalAmount,
        notes: input.notes,
        items: {
          create: input.items.map((item) => ({
            tenantId,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            specialRequests: item.specialRequests,
          })),
        },
      },
      include: orderInclude,
    });

    if (input.tableId) {
      await tx.restaurantTable.update({
        where: { id: input.tableId },
        data: { status: "occupied", currentOrderId: created.id },
      });
    }

    return created;
  });

  emitToTenant(tenantId, "restaurant:order-updated", order);
  return order;
}

export async function updateOrder(tenantId: string, id: string, input: UpdateOrderInput) {
  const existing = await prisma.restaurantOrder.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Order not found");

  if (input.tableId) {
    const table = await prisma.restaurantTable.findFirst({ where: { id: input.tableId, tenantId } });
    if (!table) throw AppError.badRequest("Table not found");
  }

  const becomingServed = input.status === "served" && existing.status !== "served";
  const becomingCompleted = input.status === "completed" && existing.status !== "completed";

  const data: Prisma.RestaurantOrderUpdateInput = {};
  if (input.status !== undefined) data.status = input.status;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.paymentMethod !== undefined) data.paymentMethod = input.paymentMethod;
  if (input.tableId !== undefined) {
    data.table = input.tableId ? { connect: { id: input.tableId } } : { disconnect: true };
  }
  if (becomingServed) data.servedTime = new Date();
  if (becomingCompleted) data.completedTime = new Date();

  const order = await prisma.$transaction(async (tx) => {
    const updated = await tx.restaurantOrder.update({ where: { id }, data, include: orderInclude });

    const oldTableId = existing.tableId;
    const newTableId = input.tableId !== undefined ? input.tableId : oldTableId;

    if (input.tableId !== undefined && input.tableId !== oldTableId) {
      if (oldTableId) {
        const oldTable = await tx.restaurantTable.findUnique({ where: { id: oldTableId } });
        if (oldTable && oldTable.currentOrderId === id) {
          await tx.restaurantTable.update({ where: { id: oldTableId }, data: { status: "vacant", currentOrderId: null } });
        }
      }
      if (newTableId) {
        await tx.restaurantTable.update({ where: { id: newTableId }, data: { status: "occupied", currentOrderId: id } });
      }
    }

    if (becomingCompleted) {
      if (newTableId) {
        await tx.restaurantTable.update({ where: { id: newTableId }, data: { status: "vacant", currentOrderId: null } });
      }
      if (existing.customerId) {
        await tx.restaurantCustomer.update({
          where: { id: existing.customerId },
          data: {
            totalSpent: { increment: updated.totalAmount ?? 0 },
            visitCount: { increment: 1 },
            lastVisit: new Date(),
          },
        });
      }
    }

    return updated;
  });

  emitToTenant(tenantId, "restaurant:order-updated", order);
  return order;
}

export async function deleteOrder(tenantId: string, id: string): Promise<void> {
  const existing = await prisma.restaurantOrder.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Order not found");

  await prisma.$transaction(async (tx) => {
    await tx.restaurantOrder.delete({ where: { id } });
    if (existing.tableId) {
      const table = await tx.restaurantTable.findUnique({ where: { id: existing.tableId } });
      if (table && table.currentOrderId === id) {
        await tx.restaurantTable.update({ where: { id: existing.tableId }, data: { status: "vacant", currentOrderId: null } });
      }
    }
  });
}

export async function updateOrderItem(tenantId: string, id: string, status: OrderItemStatus) {
  const existing = await prisma.restaurantOrderItem.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Order item not found");

  await prisma.restaurantOrderItem.update({ where: { id }, data: { status } });

  const order = await prisma.restaurantOrder.findUnique({ where: { id: existing.orderId }, include: orderInclude });
  if (order) {
    emitToTenant(tenantId, "restaurant:order-updated", order);
  }
  return order;
}

// ============================================================
// CUSTOMERS
// ============================================================

export interface CustomerInput {
  name: string;
  phone?: string;
  email?: string;
  preferences?: string;
  loyaltyPoints?: number;
}

function customerWhere(tenantId: string, search?: string): Prisma.RestaurantCustomerWhereInput {
  return {
    tenantId,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function listCustomers(tenantId: string, query: PaginationQuery) {
  const where = customerWhere(tenantId, query.search);
  const [data, total] = await Promise.all([
    prisma.restaurantCustomer.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.restaurantCustomer.count({ where }),
  ]);
  return buildPaginatedResult(data, total, query);
}

export async function listCustomersForExport(tenantId: string, search?: string) {
  return prisma.restaurantCustomer.findMany({ where: customerWhere(tenantId, search), orderBy: { createdAt: "desc" } });
}

async function getCustomerOrThrow(tenantId: string, id: string) {
  const customer = await prisma.restaurantCustomer.findFirst({ where: { id, tenantId } });
  if (!customer) throw AppError.notFound("Customer not found");
  return customer;
}

export async function createCustomer(tenantId: string, input: CustomerInput) {
  return prisma.restaurantCustomer.create({
    data: {
      tenantId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      preferences: input.preferences,
      loyaltyPoints: input.loyaltyPoints ?? 0,
    },
  });
}

export async function updateCustomer(tenantId: string, id: string, input: Partial<CustomerInput>) {
  await getCustomerOrThrow(tenantId, id);
  return prisma.restaurantCustomer.update({ where: { id }, data: input });
}

export async function deleteCustomer(tenantId: string, id: string): Promise<void> {
  await getCustomerOrThrow(tenantId, id);
  await prisma.restaurantCustomer.delete({ where: { id } });
}

// ============================================================
// STAFF SHIFTS
// ============================================================

export interface ShiftInput {
  staffUserId: string;
  shiftDate: Date;
  startTime: Date;
  endTime: Date;
  role: ShiftRole;
  status?: ShiftStatus;
}

export interface UpdateShiftInput {
  shiftDate?: Date;
  startTime?: Date;
  endTime?: Date;
  role?: ShiftRole;
  status?: ShiftStatus;
}

export async function listShifts(tenantId: string, query: PaginationQuery) {
  const where: Prisma.RestaurantStaffShiftWhereInput = { tenantId };
  const [data, total] = await Promise.all([
    prisma.restaurantStaffShift.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: { shiftDate: "desc" },
    }),
    prisma.restaurantStaffShift.count({ where }),
  ]);
  return buildPaginatedResult(data, total, query);
}

export async function listShiftsForExport(tenantId: string) {
  return prisma.restaurantStaffShift.findMany({ where: { tenantId }, orderBy: { shiftDate: "desc" } });
}

async function getShiftOrThrow(tenantId: string, id: string) {
  const shift = await prisma.restaurantStaffShift.findFirst({ where: { id, tenantId } });
  if (!shift) throw AppError.notFound("Shift not found");
  return shift;
}

export async function createShift(tenantId: string, input: ShiftInput) {
  return prisma.restaurantStaffShift.create({
    data: {
      tenantId,
      staffUserId: input.staffUserId,
      shiftDate: input.shiftDate,
      startTime: input.startTime,
      endTime: input.endTime,
      role: input.role,
      status: input.status ?? "scheduled",
    },
  });
}

export async function updateShift(tenantId: string, id: string, input: UpdateShiftInput) {
  const existing = await getShiftOrThrow(tenantId, id);

  const data: Prisma.RestaurantStaffShiftUpdateInput = { ...input };
  if (input.status === "checked_in" && existing.status !== "checked_in") {
    data.checkedInAt = new Date();
  }
  if (input.status === "completed" && existing.status !== "completed") {
    data.checkedOutAt = new Date();
  }

  return prisma.restaurantStaffShift.update({ where: { id }, data });
}

export async function deleteShift(tenantId: string, id: string): Promise<void> {
  await getShiftOrThrow(tenantId, id);
  await prisma.restaurantStaffShift.delete({ where: { id } });
}

// ============================================================
// INVENTORY + INVENTORY LOGS
// ============================================================

export interface InventoryInput {
  name: string;
  quantity: number;
  unit: InventoryUnit;
  reorderLevel?: number;
  costPerUnit?: number;
  supplierId?: string;
}

interface InventoryRow {
  quantity: Prisma.Decimal;
  reorderLevel: Prisma.Decimal | null;
  [key: string]: unknown;
}

function withLowStock<T extends InventoryRow>(item: T): T & { lowStock: boolean } {
  const reorderLevel = item.reorderLevel === null ? null : Number(item.reorderLevel);
  const lowStock = reorderLevel !== null && Number(item.quantity) <= reorderLevel;
  return { ...item, lowStock };
}

function inventoryWhere(tenantId: string, search?: string): Prisma.RestaurantInventoryWhereInput {
  return { tenantId, ...(search ? { name: { contains: search, mode: "insensitive" } } : {}) };
}

export async function listInventory(tenantId: string, query: PaginationQuery) {
  const where = inventoryWhere(tenantId, query.search);
  const [data, total] = await Promise.all([
    prisma.restaurantInventory.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: { name: "asc" },
    }),
    prisma.restaurantInventory.count({ where }),
  ]);
  return buildPaginatedResult(data.map(withLowStock), total, query);
}

export async function listInventoryForExport(tenantId: string, search?: string) {
  const data = await prisma.restaurantInventory.findMany({ where: inventoryWhere(tenantId, search), orderBy: { name: "asc" } });
  return data.map(withLowStock);
}

async function getInventoryOrThrow(tenantId: string, id: string) {
  const item = await prisma.restaurantInventory.findFirst({ where: { id, tenantId } });
  if (!item) throw AppError.notFound("Inventory item not found");
  return item;
}

export async function createInventoryItem(tenantId: string, input: InventoryInput) {
  return prisma.restaurantInventory.create({
    data: {
      tenantId,
      name: input.name,
      quantity: input.quantity,
      unit: input.unit,
      reorderLevel: input.reorderLevel,
      costPerUnit: input.costPerUnit,
      supplierId: input.supplierId,
    },
  });
}

export async function updateInventoryItem(tenantId: string, id: string, input: Partial<InventoryInput>) {
  await getInventoryOrThrow(tenantId, id);
  return prisma.restaurantInventory.update({ where: { id }, data: input });
}

export async function deleteInventoryItem(tenantId: string, id: string): Promise<void> {
  await getInventoryOrThrow(tenantId, id);
  await prisma.restaurantInventory.delete({ where: { id } });
}

export async function adjustInventory(
  tenantId: string,
  userId: string,
  id: string,
  changeQuantity: number,
  reason: InventoryReason,
) {
  const item = await getInventoryOrThrow(tenantId, id);
  const newQuantity = Number(item.quantity) + changeQuantity;
  if (newQuantity < 0) {
    throw AppError.badRequest("Resulting quantity cannot be negative");
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.restaurantInventoryLog.create({
      data: { tenantId, itemId: id, changeQuantity, reason, changedBy: userId },
    });
    return tx.restaurantInventory.update({
      where: { id },
      data: {
        quantity: newQuantity,
        ...(reason === "purchase" ? { lastRestocked: new Date() } : {}),
      },
    });
  });

  return withLowStock(updated);
}

export async function listInventoryLogs(tenantId: string, itemId: string) {
  await getInventoryOrThrow(tenantId, itemId);
  return prisma.restaurantInventoryLog.findMany({ where: { tenantId, itemId }, orderBy: { changedAt: "desc" } });
}

// ============================================================
// TABLES
// ============================================================

export interface TableInput {
  tableNumber: string;
  capacity: number;
  status?: TableStatus;
}

function tableWhere(tenantId: string, search?: string): Prisma.RestaurantTableWhereInput {
  return { tenantId, ...(search ? { tableNumber: { contains: search, mode: "insensitive" } } : {}) };
}

export async function listTables(tenantId: string, query: PaginationQuery) {
  const where = tableWhere(tenantId, query.search);
  const [data, total] = await Promise.all([
    prisma.restaurantTable.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: { tableNumber: "asc" },
    }),
    prisma.restaurantTable.count({ where }),
  ]);
  return buildPaginatedResult(data, total, query);
}

export async function listTablesForExport(tenantId: string, search?: string) {
  return prisma.restaurantTable.findMany({ where: tableWhere(tenantId, search), orderBy: { tableNumber: "asc" } });
}

async function getTableOrThrow(tenantId: string, id: string) {
  const table = await prisma.restaurantTable.findFirst({ where: { id, tenantId } });
  if (!table) throw AppError.notFound("Table not found");
  return table;
}

export async function createTable(tenantId: string, input: TableInput) {
  return prisma.restaurantTable.create({
    data: { tenantId, tableNumber: input.tableNumber, capacity: input.capacity, status: input.status ?? "vacant" },
  });
}

export async function updateTable(tenantId: string, id: string, input: Partial<TableInput>) {
  await getTableOrThrow(tenantId, id);
  return prisma.restaurantTable.update({ where: { id }, data: input });
}

export async function deleteTable(tenantId: string, id: string): Promise<void> {
  await getTableOrThrow(tenantId, id);
  await prisma.restaurantTable.delete({ where: { id } });
}

// ============================================================
// RESERVATIONS
// ============================================================

export interface ReservationInput {
  customerId: string;
  reservationDate: Date;
  reservationTime: Date;
  partySize: number;
  tableId?: string;
  status?: ReservationStatus;
  notes?: string;
}

export async function listReservations(tenantId: string, query: PaginationQuery) {
  const where: Prisma.RestaurantReservationWhereInput = {
    tenantId,
    ...(query.search ? { customer: { name: { contains: query.search, mode: "insensitive" } } } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.restaurantReservation.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: { reservationDate: "desc" },
    }),
    prisma.restaurantReservation.count({ where }),
  ]);
  return buildPaginatedResult(data, total, query);
}

export async function listReservationsForExport(tenantId: string, search?: string) {
  return prisma.restaurantReservation.findMany({
    where: { tenantId, ...(search ? { customer: { name: { contains: search, mode: "insensitive" } } } : {}) },
    orderBy: { reservationDate: "desc" },
  });
}

async function getReservationOrThrow(tenantId: string, id: string) {
  const reservation = await prisma.restaurantReservation.findFirst({ where: { id, tenantId } });
  if (!reservation) throw AppError.notFound("Reservation not found");
  return reservation;
}

export async function createReservation(tenantId: string, input: ReservationInput) {
  const customer = await prisma.restaurantCustomer.findFirst({ where: { id: input.customerId, tenantId } });
  if (!customer) throw AppError.badRequest("Customer not found");
  if (input.tableId) {
    const table = await prisma.restaurantTable.findFirst({ where: { id: input.tableId, tenantId } });
    if (!table) throw AppError.badRequest("Table not found");
  }

  return prisma.restaurantReservation.create({
    data: {
      tenantId,
      customerId: input.customerId,
      reservationDate: input.reservationDate,
      reservationTime: input.reservationTime,
      partySize: input.partySize,
      tableId: input.tableId,
      status: input.status ?? "confirmed",
      notes: input.notes,
    },
  });
}

export async function updateReservation(tenantId: string, id: string, input: Partial<ReservationInput>) {
  await getReservationOrThrow(tenantId, id);
  if (input.customerId) {
    const customer = await prisma.restaurantCustomer.findFirst({ where: { id: input.customerId, tenantId } });
    if (!customer) throw AppError.badRequest("Customer not found");
  }
  if (input.tableId) {
    const table = await prisma.restaurantTable.findFirst({ where: { id: input.tableId, tenantId } });
    if (!table) throw AppError.badRequest("Table not found");
  }
  return prisma.restaurantReservation.update({ where: { id }, data: input });
}

export async function deleteReservation(tenantId: string, id: string): Promise<void> {
  await getReservationOrThrow(tenantId, id);
  await prisma.restaurantReservation.delete({ where: { id } });
}

// ============================================================
// DASHBOARD
// ============================================================

export interface PopularItem {
  menuItemId: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface RestaurantDashboard {
  ordersToday: number;
  revenueToday: number;
  avgOrderValueToday: number;
  staffOnDutyToday: number;
  popularItemsToday: PopularItem[];
  tablesStatusSummary: Record<TableStatus, number>;
}

export async function getDashboard(tenantId: string): Promise<RestaurantDashboard> {
  const startOfToday = startOfTodayUTC();
  const startOfTomorrow = startOfTomorrowUTC();

  const [ordersToday, revenueAgg, staffOnDutyToday, popularGroups, tableGroups] = await Promise.all([
    prisma.restaurantOrder.count({
      where: { tenantId, orderTime: { gte: startOfToday, lt: startOfTomorrow } },
    }),
    prisma.restaurantOrder.aggregate({
      where: { tenantId, orderTime: { gte: startOfToday, lt: startOfTomorrow }, status: { not: "cancelled" } },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.restaurantStaffShift.count({
      where: { tenantId, shiftDate: startOfToday, status: { in: ["checked_in", "active"] } },
    }),
    prisma.restaurantOrderItem.groupBy({
      by: ["menuItemId"],
      where: { tenantId, createdAt: { gte: startOfToday, lt: startOfTomorrow } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    prisma.restaurantTable.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: { _all: true },
    }),
  ]);

  const revenueToday = round2(Number(revenueAgg._sum.totalAmount ?? 0));
  const nonCancelledOrdersToday = revenueAgg._count._all;
  const avgOrderValueToday = nonCancelledOrdersToday > 0 ? round2(revenueToday / nonCancelledOrdersToday) : 0;

  const menuItemIds = popularGroups.map((group) => group.menuItemId);
  const menuItems = menuItemIds.length
    ? await prisma.restaurantMenuItem.findMany({ where: { id: { in: menuItemIds }, tenantId } })
    : [];
  const menuItemMap = new Map(menuItems.map((item) => [item.id, item]));

  const popularItemsToday: PopularItem[] = popularGroups.map((group) => {
    const menuItem = menuItemMap.get(group.menuItemId);
    const quantity = group._sum.quantity ?? 0;
    return {
      menuItemId: group.menuItemId,
      name: menuItem?.name ?? "Unknown item",
      quantity,
      revenue: menuItem ? round2(Number(menuItem.price) * quantity) : 0,
    };
  });

  const tablesStatusSummary: Record<TableStatus, number> = { vacant: 0, occupied: 0, reserved: 0, cleaning: 0 };
  for (const group of tableGroups) {
    tablesStatusSummary[group.status] = group._count._all;
  }

  return {
    ordersToday,
    revenueToday,
    avgOrderValueToday,
    staffOnDutyToday,
    popularItemsToday,
    tablesStatusSummary,
  };
}
