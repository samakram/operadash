import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function hash(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function main(): Promise<void> {
  console.log("Seeding OperaDash...");

  // --- Module registry -----------------------------------------------
  await prisma.module.upsert({
    where: { name: "hotel" },
    update: {},
    create: { name: "hotel", version: "1.0.0", description: "Hotel operations: guests, rooms, reservations, housekeeping." },
  });
  await prisma.module.upsert({
    where: { name: "student" },
    update: {},
    create: { name: "student", version: "1.0.0", description: "Student/school management: classes, attendance, grades, tuition." },
  });
  await prisma.module.upsert({
    where: { name: "patient" },
    update: {},
    create: { name: "patient", version: "1.0.0", description: "Clinic/patient management: appointments, records, prescriptions, billing." },
  });
  await prisma.module.upsert({
    where: { name: "restaurant" },
    update: {},
    create: { name: "restaurant", version: "1.0.0", description: "Restaurant operations: orders, menu, staff, inventory, reservations." },
  });

  // --- Super admin ------------------------------------------------------
  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL ?? "admin@operadash.com").toLowerCase();
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD ?? "SuperAdmin123!";
  await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: {
      email: superAdminEmail,
      password: await hash(superAdminPassword),
      role: "super_admin",
      firstName: "Super",
      lastName: "Admin",
    },
  });
  console.log(`Super admin ready: ${superAdminEmail} / ${superAdminPassword}`);

  // --- Demo tenant: Hotel Test ------------------------------------------
  const hotelTenant = await prisma.tenant.upsert({
    where: { subdomain: "hotel-test" },
    update: {},
    create: {
      name: "Hotel Test",
      subdomain: "hotel-test",
      plan: "pro",
      enabledModules: ["hotel"],
      monthlyRevenue: 99,
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@hoteltest.com" },
    update: {},
    create: {
      email: "admin@hoteltest.com",
      password: await hash("HotelAdmin123!"),
      role: "tenant_admin",
      tenantId: hotelTenant.id,
      firstName: "Harper",
      lastName: "Hendricks",
    },
  });

  const existingRooms = await prisma.hotelRoom.count({ where: { tenantId: hotelTenant.id } });
  if (existingRooms === 0) {
    const rooms = await Promise.all(
      [
        { roomNumber: "101", roomType: "single" as const, capacity: 1, pricePerNight: 89, floorNumber: 1, status: "vacant" as const },
        { roomNumber: "102", roomType: "double" as const, capacity: 2, pricePerNight: 129, floorNumber: 1, status: "occupied" as const },
        { roomNumber: "201", roomType: "suite" as const, capacity: 4, pricePerNight: 249, floorNumber: 2, status: "cleaning" as const },
        { roomNumber: "202", roomType: "deluxe" as const, capacity: 3, pricePerNight: 189, floorNumber: 2, status: "maintenance" as const },
      ].map((room) => prisma.hotelRoom.create({ data: { ...room, tenantId: hotelTenant.id, amenities: ["wifi", "tv"] } })),
    );

    const guest = await prisma.hotelGuest.create({
      data: {
        tenantId: hotelTenant.id,
        firstName: "Alice",
        lastName: "Nguyen",
        email: "alice@example.com",
        phone: "555-0101",
        city: "Austin",
        country: "USA",
        vip: true,
      },
    });

    const occupiedRoom = rooms[1];
    await prisma.hotelRoom.update({ where: { id: occupiedRoom.id }, data: { occupiedByGuestId: guest.id } });

    const checkIn = new Date();
    const checkOut = new Date();
    checkOut.setDate(checkOut.getDate() + 3);

    const reservation = await prisma.hotelReservation.create({
      data: {
        tenantId: hotelTenant.id,
        guestId: guest.id,
        roomId: occupiedRoom.id,
        checkIn,
        checkOut,
        numberOfNights: 3,
        totalPrice: 387,
        paymentStatus: "paid",
      },
    });

    await prisma.hotelInvoice.create({
      data: {
        tenantId: hotelTenant.id,
        guestId: guest.id,
        reservationId: reservation.id,
        amount: 387,
        tax: 31,
        totalAmount: 418,
        status: "paid",
        paidAt: new Date(),
      },
    });
  }

  // --- Demo tenant: Student Test -----------------------------------------
  const studentTenant = await prisma.tenant.upsert({
    where: { subdomain: "student-test" },
    update: {},
    create: {
      name: "Student Test Academy",
      subdomain: "student-test",
      plan: "starter",
      enabledModules: ["student"],
      monthlyRevenue: 29,
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@studenttest.com" },
    update: {},
    create: {
      email: "admin@studenttest.com",
      password: await hash("StudentAdmin123!"),
      role: "tenant_admin",
      tenantId: studentTenant.id,
      firstName: "Priya",
      lastName: "Shah",
    },
  });

  const existingInstructors = await prisma.studentInstructor.count({ where: { tenantId: studentTenant.id } });
  if (existingInstructors === 0) {
    const instructor = await prisma.studentInstructor.create({
      data: {
        tenantId: studentTenant.id,
        firstName: "Daniel",
        lastName: "Kim",
        email: "daniel.kim@studenttest.com",
        specialization: "Mathematics",
        hireDate: new Date("2022-01-10"),
      },
    });

    const studentClass = await prisma.studentClass.create({
      data: {
        tenantId: studentTenant.id,
        courseName: "Algebra II",
        courseCode: "MATH-201",
        instructorId: instructor.id,
        capacity: 25,
        enrolledCount: 1,
        pricePerCourse: 450,
        startDate: new Date(),
        schedule: { dayOfWeek: "Monday", startTime: "09:00", endTime: "10:30", room: "B12" },
      },
    });

    const student = await prisma.studentStudent.create({
      data: {
        tenantId: studentTenant.id,
        firstName: "Maya",
        lastName: "Torres",
        email: "maya.torres@example.com",
        enrollmentDate: new Date(),
        parentName: "Carlos Torres",
        parentEmail: "carlos.torres@example.com",
      },
    });

    await prisma.studentEnrollment.create({
      data: {
        tenantId: studentTenant.id,
        studentId: student.id,
        classId: studentClass.id,
        enrollmentDate: new Date(),
        progressPercentage: 40,
      },
    });

    await prisma.studentTuitionRecord.create({
      data: {
        tenantId: studentTenant.id,
        studentId: student.id,
        classId: studentClass.id,
        amountDue: 450,
        amountPaid: 200,
        dueDate: new Date(new Date().setDate(new Date().getDate() + 14)),
        status: "partial",
      },
    });
  }

  console.log("Seed complete.");
  console.log("Hotel Test admin: admin@hoteltest.com / HotelAdmin123!");
  console.log("Student Test admin: admin@studenttest.com / StudentAdmin123!");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
