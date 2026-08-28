import { describe, expect, it } from "vitest";
import { Prisma, type HotelGuest, type HotelRoom } from "@prisma/client";
import { prismaMock } from "@/test/prismaMock";
import * as hotelService from "@/services/hotel.service";

const TENANT_ID = "tenant-1";

function makeGuest(overrides: Partial<HotelGuest> = {}): HotelGuest {
  return {
    id: "guest-1",
    tenantId: TENANT_ID,
    firstName: "Alice",
    lastName: "Nguyen",
    email: null,
    phone: null,
    address: null,
    city: null,
    country: null,
    checkInDate: null,
    checkOutDate: null,
    notes: null,
    vip: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRoom(overrides: Partial<HotelRoom> = {}): HotelRoom {
  return {
    id: "room-1",
    tenantId: TENANT_ID,
    roomNumber: "101",
    roomType: "double",
    capacity: 2,
    pricePerNight: new Prisma.Decimal(120),
    status: "vacant",
    occupiedByGuestId: null,
    floorNumber: 1,
    amenities: [],
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("hotel.service — createReservation pricing", () => {
  function setup() {
    prismaMock.hotelGuest.findFirst.mockResolvedValue(makeGuest());
    prismaMock.hotelRoom.findFirst.mockResolvedValue(makeRoom());
    prismaMock.$transaction.mockImplementation((cb: unknown) =>
      (cb as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock),
    );
    prismaMock.hotelReservation.create.mockImplementation(({ data }) => Promise.resolve(data) as never);
    prismaMock.hotelRoom.update.mockResolvedValue(makeRoom());
  }

  it("auto-calculates numberOfNights and totalPrice from room.pricePerNight when not provided", async () => {
    setup();
    const checkIn = new Date("2026-03-01T00:00:00Z");
    const checkOut = new Date("2026-03-04T00:00:00Z"); // 3 nights

    const created = await hotelService.createReservation(TENANT_ID, {
      guestId: "guest-1",
      roomId: "room-1",
      checkIn,
      checkOut,
    });

    expect(created.numberOfNights).toBe(3);
    expect(created.totalPrice).toBe(360); // 3 nights * $120
  });

  it("respects an explicit totalPrice override instead of recomputing it", async () => {
    setup();
    const created = await hotelService.createReservation(TENANT_ID, {
      guestId: "guest-1",
      roomId: "room-1",
      checkIn: new Date("2026-03-01T00:00:00Z"),
      checkOut: new Date("2026-03-04T00:00:00Z"),
      totalPrice: 999, // discounted rate, shouldn't be overwritten
    });

    expect(created.totalPrice).toBe(999);
  });

  it("rejects a checkout date on or before check-in", async () => {
    setup();
    await expect(
      hotelService.createReservation(TENANT_ID, {
        guestId: "guest-1",
        roomId: "room-1",
        checkIn: new Date("2026-03-04T00:00:00Z"),
        checkOut: new Date("2026-03-01T00:00:00Z"),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(prismaMock.hotelReservation.create).not.toHaveBeenCalled();
  });

  it("rejects a room that doesn't belong to this tenant (cross-tenant guard)", async () => {
    prismaMock.hotelGuest.findFirst.mockResolvedValue(makeGuest());
    prismaMock.hotelRoom.findFirst.mockResolvedValue(null); // scoped-by-tenant lookup found nothing

    await expect(
      hotelService.createReservation(TENANT_ID, {
        guestId: "guest-1",
        roomId: "someone-elses-room",
        checkIn: new Date("2026-03-01T00:00:00Z"),
        checkOut: new Date("2026-03-04T00:00:00Z"),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("occupies the room for the booked guest on create", async () => {
    setup();
    await hotelService.createReservation(TENANT_ID, {
      guestId: "guest-1",
      roomId: "room-1",
      checkIn: new Date("2026-03-01T00:00:00Z"),
      checkOut: new Date("2026-03-04T00:00:00Z"),
    });

    expect(prismaMock.hotelRoom.update).toHaveBeenCalledWith({
      where: { id: "room-1" },
      data: { occupiedByGuestId: "guest-1", status: "occupied" },
    });
  });
});
