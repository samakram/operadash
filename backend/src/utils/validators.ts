import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  // Capped well above the UI's paginated table page sizes (10-100) because
  // EntityCrudPage and several CRM pages also use this same query to pull an
  // unpaginated options list for relational dropdowns (guest/room/patient/table
  // pickers etc.) at pageSize=200 — a lower cap 400s every one of those.
  pageSize: z.coerce.number().int().min(1).max(500).default(25),
  search: z.string().trim().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

export function paginationToPrisma(query: PaginationQuery): { skip: number; take: number } {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function buildPaginatedResult<T>(data: T[], total: number, query: PaginationQuery): PaginatedResult<T> {
  return {
    data,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}
