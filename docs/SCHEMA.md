# Database schema

Source of truth: [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma). This file explains the *design decisions* the schema encodes that aren't obvious from reading column lists.

## Shared / platform tables

- **`users`** — every login (`super_admin`, `tenant_admin`, `staff`) is one row here. `tenant_id` is `null` for `super_admin`. Deleting a `Tenant` cascades to its `users` (declared FK, `onDelete: Cascade`).
- **`tenants`** — `enabled_modules` is a Postgres array of the `ModuleName` enum (`hotel`, `student`, `patient`, `restaurant`); a tenant can have more than one module enabled. `plan` gates nothing in code today beyond what's shown in the UI — enforcing plan-based feature limits is a follow-up.
- **`modules`** — a small registry row per module (version/description) used for the super-admin Modules page; not a permissions source (that's `tenants.enabled_modules`, checked by `requireModule` middleware on every module route).
- **`audit_logs`** — written by `recordAudit()` (`backend/src/utils/audit.ts`) after every create/update/delete across all four modules.
- **`feature_flags`** — per-tenant, per-module, per-feature booleans; scaffolded in the schema but not yet read anywhere in application code (a hook for future gradual rollouts).

## Module tables

Each vertical (`hotel_*`, `student_*`, `patient_*`, `restaurant_*`) matches the tables in the original product spec exactly — same names (`snake_case` via Prisma `@@map`/`@map`), same columns, same enumerated status values (modeled as Postgres enums rather than free-text `VARCHAR`, which is stricter than the original spec but catches typos like `"vacnt"` at the database level instead of silently corrupting data).

## Multi-tenancy: why it's app-layer, not `ON DELETE CASCADE` from `tenants`

Every tenant-scoped table has a plain `tenant_id UUID` column with a B-tree index — **not** a declared Prisma relation back to `Tenant`. This is deliberate:

1. **Isolation is enforced at the query layer, not the schema layer.** `backend/src/middleware/tenantIsolation.ts` resolves exactly one `tenantId` per authenticated request (from the JWT for `tenant_admin`/`staff`, from an explicit `?tenantId=` for `super_admin`), and every service function takes that `tenantId` and filters every Prisma call by it. A row belonging to another tenant is unreachable even with a guessed UUID — there's no query path that omits the filter.
2. **~30 module tables** would need ~30 duplicate FK+cascade declarations on `Tenant` for schema-level cascade delete to work, for no behavioral gain over the app-layer guarantee above.

The tradeoff: deleting a tenant does **not** cascade automatically at the database level for module tables. `tenant.service.ts#deleteTenant` handles this explicitly — it runs an ordered `$transaction` of `deleteMany({ where: { tenantId }})` across every module table (children before parents, e.g. `hotel_invoices` before `hotel_reservations` before `hotel_guests`/`hotel_rooms`) before deleting the `Tenant` row itself (whose deletion *does* cascade to `users` via a real FK). If you add a new module table, add its cleanup line there too, or hard-deleting a tenant will leave orphaned rows.

For most operations, prefer **disabling** a tenant (`PATCH /api/tenants/:id { active: false }`) over hard delete — `requireModule` middleware already refuses all module access for an inactive tenant.

## Enums

Every status/category field the spec described as `VARCHAR(50) (option_a, option_b, ...)` is a real Postgres enum in this schema (e.g. `RoomStatus`, `AppointmentStatus`, `OrderStatus`). Adding a new status value requires a migration (`ALTER TYPE ... ADD VALUE`) — intentional, since these values are relied on throughout the service layer's business logic (e.g. occupancy math filters on `RoomStatus.occupied`).

## Money and dates

- Currency fields are `Decimal(10,2)` (or `(5,2)` for percentages/scores) — never `Float`, to avoid floating-point rounding drift in totals.
- `Date`-only fields (`check_in`, `enrollment_date`, `visit_date`, ...) use Prisma's `@db.Date`; timestamp fields (`created_at`, `appointment_datetime`, ...) use full `DateTime`.
