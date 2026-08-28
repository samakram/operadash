import { describe, expect, it } from "vitest";
import { prismaMock } from "@/test/prismaMock";
import * as studentService from "@/services/student.service";
import { paginationSchema } from "@/utils/validators";

const TENANT_ID = "tenant-1";

function makeTuitionRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "tuition-1",
    tenantId: TENANT_ID,
    studentId: "student-1",
    classId: "class-1",
    amountDue: 500,
    amountPaid: 0,
    dueDate: new Date("2026-06-01"),
    paidDate: null,
    paymentMethod: null,
    status: "pending",
    notes: null,
    createdAt: new Date("2026-01-01"),
    student: { id: "student-1", firstName: "Sam", lastName: "Lee" },
    class: { id: "class-1", courseName: "Algebra II" },
    ...overrides,
  };
}

describe("student.service — tuition status reconciliation", () => {
  it("recomputes status as paid, overdue, partial, or pending — never trusting the stored value", async () => {
    const now = Date.now();
    const past = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const future = new Date(now + 7 * 24 * 60 * 60 * 1000);

    const rows = [
      makeTuitionRecord({ id: "paid", amountDue: 500, amountPaid: 500, dueDate: future, status: "pending" }), // stored status is stale
      makeTuitionRecord({ id: "overdue", amountDue: 500, amountPaid: 100, dueDate: past, status: "partial" }), // stale
      makeTuitionRecord({ id: "partial", amountDue: 500, amountPaid: 200, dueDate: future, status: "partial" }), // already correct
      makeTuitionRecord({ id: "pending", amountDue: 500, amountPaid: 0, dueDate: future, status: "pending" }), // already correct
    ];

    prismaMock.studentTuitionRecord.findMany.mockResolvedValue(rows as never);
    prismaMock.studentTuitionRecord.count.mockResolvedValue(rows.length);
    prismaMock.$transaction.mockResolvedValue([] as never);

    const result = await studentService.listTuitionRecords(TENANT_ID, paginationSchema.parse({}));
    const byId = Object.fromEntries(result.data.map((r) => [(r as { id: string }).id, (r as { status: string }).status]));

    expect(byId.paid).toBe("paid");
    expect(byId.overdue).toBe("overdue");
    expect(byId.partial).toBe("partial");
    expect(byId.pending).toBe("pending");
  });

  it("only persists rows whose recomputed status actually changed", async () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const rows = [
      makeTuitionRecord({ id: "needs-update", amountDue: 500, amountPaid: 500, dueDate: future, status: "pending" }),
      makeTuitionRecord({ id: "already-correct", amountDue: 500, amountPaid: 0, dueDate: future, status: "pending" }),
    ];

    prismaMock.studentTuitionRecord.findMany.mockResolvedValue(rows as never);
    prismaMock.studentTuitionRecord.count.mockResolvedValue(rows.length);
    let transactionArg: unknown;
    prismaMock.$transaction.mockImplementation((arg: unknown) => {
      transactionArg = arg;
      return Promise.resolve([]);
    });
    prismaMock.studentTuitionRecord.update.mockResolvedValue({} as never);

    await studentService.listTuitionRecords(TENANT_ID, paginationSchema.parse({}));

    expect(Array.isArray(transactionArg)).toBe(true);
    expect((transactionArg as unknown[]).length).toBe(1); // only "needs-update" required a write
  });

  it("skips the reconciliation transaction entirely when nothing is stale", async () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const rows = [makeTuitionRecord({ amountDue: 500, amountPaid: 0, dueDate: future, status: "pending" })];

    prismaMock.studentTuitionRecord.findMany.mockResolvedValue(rows as never);
    prismaMock.studentTuitionRecord.count.mockResolvedValue(1);

    await studentService.listTuitionRecords(TENANT_ID, paginationSchema.parse({}));

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
