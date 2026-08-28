import { describe, expect, it } from "vitest";
import { buildPaginatedResult, paginationSchema, paginationToPrisma } from "@/utils/validators";

describe("validators", () => {
  describe("paginationSchema", () => {
    it("applies sensible defaults when nothing is provided", () => {
      const result = paginationSchema.parse({});
      expect(result).toMatchObject({ page: 1, pageSize: 25, sortDir: "desc" });
    });

    it("coerces string query-param numbers", () => {
      const result = paginationSchema.parse({ page: "3", pageSize: "10" });
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
    });

    it("caps pageSize at 100 and rejects a zero/negative page", () => {
      expect(() => paginationSchema.parse({ pageSize: "500" })).toThrow();
      expect(() => paginationSchema.parse({ page: "0" })).toThrow();
    });
  });

  describe("paginationToPrisma", () => {
    it("computes skip/take from page and pageSize", () => {
      const query = paginationSchema.parse({ page: "3", pageSize: "20" });
      expect(paginationToPrisma(query)).toEqual({ skip: 40, take: 20 });
    });

    it("skip is 0 on the first page", () => {
      const query = paginationSchema.parse({});
      expect(paginationToPrisma(query)).toEqual({ skip: 0, take: 25 });
    });
  });

  describe("buildPaginatedResult", () => {
    it("computes totalPages, rounding up", () => {
      const query = paginationSchema.parse({ page: "1", pageSize: "10" });
      const result = buildPaginatedResult([1, 2, 3], 25, query);
      expect(result).toEqual({ data: [1, 2, 3], page: 1, pageSize: 10, total: 25, totalPages: 3 });
    });

    it("floors totalPages at 1 even with zero results", () => {
      const query = paginationSchema.parse({});
      const result = buildPaginatedResult([], 0, query);
      expect(result.totalPages).toBe(1);
    });
  });
});
