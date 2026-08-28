import { describe, expect, it } from "vitest";
import { Prisma, type RestaurantMenuItem, type RestaurantTable } from "@prisma/client";
import { prismaMock } from "@/test/prismaMock";
import * as restaurantService from "@/services/restaurant.service";

const TENANT_ID = "tenant-1";

function makeMenuItem(overrides: Partial<RestaurantMenuItem> = {}): RestaurantMenuItem {
  return {
    id: "item-1",
    tenantId: TENANT_ID,
    name: "Burger",
    description: null,
    price: new Prisma.Decimal(12.5),
    category: "mains",
    imageUrl: null,
    available: true,
    prepTimeMinutes: null,
    calories: null,
    dietaryTags: [],
    createdAt: new Date(),
    ...overrides,
  };
}

function makeTable(overrides: Partial<RestaurantTable> = {}): RestaurantTable {
  return {
    id: "table-1",
    tenantId: TENANT_ID,
    tableNumber: "5",
    capacity: 4,
    status: "vacant",
    currentOrderId: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("restaurant.service — createOrder totals", () => {
  function setupTransaction() {
    prismaMock.$transaction.mockImplementation((cb: unknown) =>
      (cb as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock),
    );
    prismaMock.restaurantOrder.findUnique.mockResolvedValue(null); // no order-number collision
    prismaMock.restaurantOrder.create.mockImplementation(({ data }) => Promise.resolve(data) as never);
    prismaMock.restaurantTable.update.mockResolvedValue(makeTable());
  }

  it("computes subtotal, 8% tax, and totalAmount server-side from menu item prices — never trusting client-supplied prices", async () => {
    setupTransaction();
    prismaMock.restaurantMenuItem.findMany.mockResolvedValue([
      makeMenuItem({ id: "burger", price: new Prisma.Decimal(12.5) }),
      makeMenuItem({ id: "fries", price: new Prisma.Decimal(4.25) }),
    ]);

    const order = await restaurantService.createOrder(TENANT_ID, {
      items: [
        { menuItemId: "burger", quantity: 2 }, // 25.00
        { menuItemId: "fries", quantity: 3 }, // 12.75
      ],
    });

    expect(order.subtotal).toBeCloseTo(37.75, 2);
    expect(order.tax).toBeCloseTo(3.02, 2); // 37.75 * 0.08
    expect(order.totalAmount).toBeCloseTo(40.77, 2);
    expect(order.itemsCount).toBe(5);
  });

  it("rejects an order with no items", async () => {
    setupTransaction();
    await expect(restaurantService.createOrder(TENANT_ID, { items: [] })).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.restaurantOrder.create).not.toHaveBeenCalled();
  });

  it("rejects a menu item that doesn't belong to this tenant", async () => {
    setupTransaction();
    prismaMock.restaurantMenuItem.findMany.mockResolvedValue([]); // tenant-scoped lookup found nothing

    await expect(
      restaurantService.createOrder(TENANT_ID, { items: [{ menuItemId: "not-mine", quantity: 1 }] }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("occupies the assigned table and links it to the new order", async () => {
    setupTransaction();
    prismaMock.restaurantMenuItem.findMany.mockResolvedValue([makeMenuItem()]);
    prismaMock.restaurantTable.findFirst.mockResolvedValue(makeTable());
    prismaMock.restaurantOrder.create.mockResolvedValue({ id: "order-1", tableId: "table-1" } as never);

    await restaurantService.createOrder(TENANT_ID, {
      tableId: "table-1",
      items: [{ menuItemId: "item-1", quantity: 1 }],
    });

    expect(prismaMock.restaurantTable.update).toHaveBeenCalledWith({
      where: { id: "table-1" },
      data: { status: "occupied", currentOrderId: "order-1" },
    });
  });
});
