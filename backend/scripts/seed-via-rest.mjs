// One-off/fallback seeder that talks to Supabase's PostgREST Data API
// instead of Prisma Client. Exists because this environment's outbound
// network can reach Supabase over HTTPS but not the raw Postgres port
// (see docs/DEPLOYMENT.md) — `npx prisma db seed` is the normal path
// once Prisma can actually reach the database (e.g. from Railway).
//
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-via-rest.mjs
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars first.");
  process.exit(1);
}

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const hash = (pw) => bcrypt.hash(pw, 12);

async function rest(method, table, body, { prefer = "return=representation" } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: prefer,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${table} -> ${res.status}: ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function main() {
  console.log("Seeding OperaDash via Supabase REST API...");

  // --- Module registry ----------------------------------------------
  const modules = [
    { name: "hotel", description: "Hotel operations: guests, rooms, reservations, housekeeping." },
    { name: "student", description: "Student/school management: classes, attendance, grades, tuition." },
    { name: "patient", description: "Clinic/patient management: appointments, records, prescriptions, billing." },
    { name: "restaurant", description: "Restaurant operations: orders, menu, staff, inventory, reservations." },
  ];
  for (const m of modules) {
    await rest("POST", "modules", { id: uuid(), name: m.name, version: "1.0.0", description: m.description, created_at: now() }, { prefer: "return=minimal,resolution=ignore-duplicates" });
  }
  console.log("  modules: done");

  // --- Super admin -----------------------------------------------------
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL ?? "admin@operadash.com";
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD ?? "SuperAdmin123!";
  await rest(
    "POST",
    "users",
    {
      id: uuid(),
      email: superAdminEmail,
      password: await hash(superAdminPassword),
      role: "super_admin",
      first_name: "Super",
      last_name: "Admin",
      created_at: now(),
      updated_at: now(),
    },
    { prefer: "return=minimal,resolution=ignore-duplicates" },
  );
  console.log(`  super admin: ${superAdminEmail} / ${superAdminPassword}`);

  // --- Hotel Test tenant -------------------------------------------------
  const [hotelTenant] = await rest("POST", "tenants", {
    id: uuid(),
    name: "Hotel Test",
    subdomain: "hotel-test",
    plan: "pro",
    enabled_modules: ["hotel"],
    monthly_revenue: 99,
    created_at: now(),
    updated_at: now(),
  });

  await rest("POST", "users", {
    id: uuid(),
    email: "admin@hoteltest.com",
    password: await hash("HotelAdmin123!"),
    role: "tenant_admin",
    tenant_id: hotelTenant.id,
    first_name: "Harper",
    last_name: "Hendricks",
    created_at: now(),
    updated_at: now(),
  });

  const roomRows = [
    { roomNumber: "101", roomType: "single", capacity: 1, price: 89, floor: 1, status: "vacant" },
    { roomNumber: "102", roomType: "double", capacity: 2, price: 129, floor: 1, status: "occupied" },
    { roomNumber: "201", roomType: "suite", capacity: 4, price: 249, floor: 2, status: "cleaning" },
    { roomNumber: "202", roomType: "deluxe", capacity: 3, price: 189, floor: 2, status: "maintenance" },
  ];
  const rooms = [];
  for (const r of roomRows) {
    const [row] = await rest("POST", "hotel_rooms", {
      id: uuid(),
      tenant_id: hotelTenant.id,
      room_number: r.roomNumber,
      room_type: r.roomType,
      capacity: r.capacity,
      price_per_night: r.price,
      status: r.status,
      floor_number: r.floor,
      amenities: ["wifi", "tv"],
      created_at: now(),
      updated_at: now(),
    });
    rooms.push(row);
  }

  const [guest] = await rest("POST", "hotel_guests", {
    id: uuid(),
    tenant_id: hotelTenant.id,
    first_name: "Alice",
    last_name: "Nguyen",
    email: "alice@example.com",
    phone: "555-0101",
    city: "Austin",
    country: "USA",
    vip: true,
    created_at: now(),
    updated_at: now(),
  });

  const occupiedRoom = rooms[1];
  await rest("PATCH", `hotel_rooms?id=eq.${occupiedRoom.id}`, { occupied_by_guest_id: guest.id, updated_at: now() }, { prefer: "return=minimal" });

  const checkIn = new Date();
  const checkOut = new Date();
  checkOut.setDate(checkOut.getDate() + 3);

  const [reservation] = await rest("POST", "hotel_reservations", {
    id: uuid(),
    tenant_id: hotelTenant.id,
    guest_id: guest.id,
    room_id: occupiedRoom.id,
    check_in: checkIn.toISOString().slice(0, 10),
    check_out: checkOut.toISOString().slice(0, 10),
    number_of_nights: 3,
    total_price: 387,
    payment_status: "paid",
    created_at: now(),
    updated_at: now(),
  });

  await rest("POST", "hotel_invoices", {
    id: uuid(),
    tenant_id: hotelTenant.id,
    guest_id: guest.id,
    reservation_id: reservation.id,
    amount: 387,
    tax: 31,
    total_amount: 418,
    status: "paid",
    paid_at: now(),
    created_at: now(),
  });
  console.log("  Hotel Test tenant + demo data: done");

  // --- Student Test tenant -------------------------------------------------
  const [studentTenant] = await rest("POST", "tenants", {
    id: uuid(),
    name: "Student Test Academy",
    subdomain: "student-test",
    plan: "starter",
    enabled_modules: ["student"],
    monthly_revenue: 29,
    created_at: now(),
    updated_at: now(),
  });

  await rest("POST", "users", {
    id: uuid(),
    email: "admin@studenttest.com",
    password: await hash("StudentAdmin123!"),
    role: "tenant_admin",
    tenant_id: studentTenant.id,
    first_name: "Priya",
    last_name: "Shah",
    created_at: now(),
    updated_at: now(),
  });

  const [instructor] = await rest("POST", "student_instructors", {
    id: uuid(),
    tenant_id: studentTenant.id,
    first_name: "Daniel",
    last_name: "Kim",
    email: "daniel.kim@studenttest.com",
    specialization: "Mathematics",
    hire_date: "2022-01-10",
    created_at: now(),
  });

  const [studentClass] = await rest("POST", "student_classes", {
    id: uuid(),
    tenant_id: studentTenant.id,
    course_name: "Algebra II",
    course_code: "MATH-201",
    instructor_id: instructor.id,
    capacity: 25,
    enrolled_count: 1,
    price_per_course: 450,
    start_date: now().slice(0, 10),
    schedule: { dayOfWeek: "Monday", startTime: "09:00", endTime: "10:30", room: "B12" },
    created_at: now(),
  });

  const [student] = await rest("POST", "student_students", {
    id: uuid(),
    tenant_id: studentTenant.id,
    first_name: "Maya",
    last_name: "Torres",
    email: "maya.torres@example.com",
    enrollment_date: now().slice(0, 10),
    parent_name: "Carlos Torres",
    parent_email: "carlos.torres@example.com",
    status: "active",
    created_at: now(),
    updated_at: now(),
  });

  await rest("POST", "student_enrollments", {
    id: uuid(),
    tenant_id: studentTenant.id,
    student_id: student.id,
    class_id: studentClass.id,
    enrollment_date: now().slice(0, 10),
    progress_percentage: 40,
    status: "active",
    created_at: now(),
  });

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);
  await rest("POST", "student_tuition_records", {
    id: uuid(),
    tenant_id: studentTenant.id,
    student_id: student.id,
    class_id: studentClass.id,
    amount_due: 450,
    amount_paid: 200,
    due_date: dueDate.toISOString().slice(0, 10),
    status: "partial",
    created_at: now(),
  });
  console.log("  Student Test tenant + demo data: done");

  console.log("\nSeed complete.");
  console.log(`Super admin:          ${superAdminEmail} / ${superAdminPassword}`);
  console.log("Hotel Test admin:     admin@hoteltest.com / HotelAdmin123!");
  console.log("Student Test admin:   admin@studenttest.com / StudentAdmin123!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
