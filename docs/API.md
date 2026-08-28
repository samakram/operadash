# API reference

Base URL: `http://localhost:4000/api` in development (Vite proxies `/api` — see `frontend/vite.config.ts`); an absolute `VITE_API_URL` in production.

## Auth

All auth state lives in **httpOnly cookies** — the frontend never touches a raw token.

| Endpoint | Method | Notes |
|---|---|---|
| `/auth/login` | POST | `{ email, password }` → sets `operadash_access_token` (24h) + `operadash_refresh_token` (7d) cookies, returns `{ user }` |
| `/auth/refresh` | POST | Reads the refresh cookie, reissues the access cookie |
| `/auth/logout` | POST | Clears both cookies |
| `/auth/me` | GET | Returns the current `{ user }` (requires the access cookie) |
| `/auth/change-password` | POST | `{ currentPassword, newPassword }` |
| `/auth/forgot-password` | POST | `{ email }` → always 202 with an identical generic message, regardless of whether the account exists |
| `/auth/reset-password` | POST | `{ token, newPassword }` — token is single-use, expires in 1h, emailed as a link by `/forgot-password` |

The frontend axios instance (`frontend/src/lib/api.ts`) auto-retries a request once through `/auth/refresh` on a 401, then fires a `operadash:session-expired` window event if that also fails (caught by `AuthContext`, which logs the user out).

## Error shape

Every error response: `{ "error": { "code": string, "message": string, "details"?: unknown } }`. Zod validation failures return `code: "VALIDATION_ERROR"` with `details` as the flattened zod error.

## Pagination

Every list endpoint accepts `?page=1&pageSize=25&search=&sortBy=&sortDir=asc|desc` and returns:

```json
{ "data": [...], "page": 1, "pageSize": 25, "total": 123, "totalPages": 5 }
```

## Platform (super admin only, except `/tenants/me`)

| Endpoint | Method | Role | Notes |
|---|---|---|---|
| `/tenants` | GET, POST | super_admin | create returns `{ tenant, admin, tempPassword }` |
| `/tenants/:id` | GET, PATCH, DELETE | super_admin (or the tenant's own admin/staff for GET) | |
| `/tenants/:id/modules` | PATCH | super_admin | `{ modules: ModuleName[] }` |
| `/tenants/me` | GET | tenant_admin, staff | own tenant, no `:id` needed |
| `/tenants/analytics/platform` | GET | super_admin | revenue, tenant/user counts+growth, module usage |
| `/modules` | GET | super_admin | registry + live tenant usage count |
| `/modules/:name` | GET, PATCH | super_admin | |
| `/users` | GET, POST, PATCH `/:id`, DELETE `/:id` | super_admin, tenant_admin | tenant_admin is hard-scoped to their own tenant and can only create `staff` |
| `/billing/checkout-session` | POST | tenant_admin | Stripe test-mode checkout for a plan upgrade |
| `/billing/webhook` | POST | (Stripe signature) | updates `tenant.plan`/`monthlyRevenue` on `checkout.session.completed` |

## Module APIs (`hotel`, `student`, `patient`, `restaurant`)

All four follow the same shape, mounted at `/api/<module>`. Every route requires: authenticated session → a resolved tenant → that tenant having the module enabled (`authenticate`, `resolveTenant`, `requireModule` middleware, in that order — see `backend/src/middleware/`).

For each entity in a module (e.g. `hotel_guests`, `student_classes`, `patient_appointments`, `restaurant_orders`):

- `GET /<module>/<entity>` — paginated list
- `GET /<module>/<entity>/export` — CSV download of the current filtered list
- `POST /<module>/<entity>` — create
- `PATCH /<module>/<entity>/:id` — update
- `DELETE /<module>/<entity>/:id` — delete (`tenant_admin`/`super_admin` only — `staff` gets 403)

Plus one aggregate `GET /<module>/dashboard` per module returning the real KPI numbers shown on that module's Dashboard tab.

Entities per module (each supports the five routes above at `/api/<module>/<entity>`):

| Module | Entities |
|---|---|
| `hotel` | `guests`, `rooms`, `reservations`, `tasks` (staff assignments), `maintenance`, `invoices` |
| `student` | `students`, `instructors`, `classes`, `enrollments`, `attendance`, `grades`, `tuition`, `announcements` |
| `patient` | `patients`, `providers`, `appointments`, `medical-records`, `prescriptions`, `vitals`, `lab-results`, `insurance`, `billing` |
| `restaurant` | `menu-items`, `orders`, `customers`, `shifts`, `inventory`, `tables`, `reservations` (order line items are managed through their parent order, not independently) |

Plus module-specific business-logic endpoints beyond plain CRUD:

- `POST /student/attendance/bulk` — `{ classId, date, records: [{studentId, present, notes?}] }`, marks a whole class at once.
- `GET /student/grades/summary?studentId=` — `{ averagePercentage, count }` for one student.
- `POST /restaurant/inventory/:id/adjust` — `{ changeQuantity, reason }`, atomically adjusts stock and logs it.
- `PATCH /restaurant/order-items/:id` — kitchen-side per-item status update, independent of the parent order's status.

Business logic worth knowing when integrating against these APIs (full detail in each `backend/src/services/<module>.service.ts`):

- **Hotel**: reservations auto-price from nights × room rate unless overridden; room occupancy state is kept in sync with reservations automatically.
- **Patient**: appointments reject overlapping bookings for the same provider (409); prescriptions hard-block on a patient allergy match (409, case-insensitive substring); medical records lock 24h after creation (403 on late edit).
- **Restaurant**: orders compute `subtotal`/`tax`/`totalAmount` from line items server-side (prices are never trusted from the client); completing an order updates customer loyalty stats and frees the table.
- **Student**: tuition `status` and class `enrolledCount` are recomputed on every relevant read/write rather than trusted as stored state.

## Real-time (Socket.io)

Connects at `/socket.io`, authenticated via the same httpOnly access-token cookie (read off the handshake's `Cookie` header server-side — see `backend/src/socket.ts`; the client never handles a token directly). Each socket joins a `tenant:<tenantId>` room. Events are emitted tenant-scoped via `emitToTenant()`:

- `hotel:task-updated` — a staff assignment/task was created or changed status
- `restaurant:order-updated` — an order was created or changed status/items
