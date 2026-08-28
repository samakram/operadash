import { Prisma } from "@prisma/client";
import type {
  AnnouncementAudience,
  ClassStatus,
  EnrollmentStatus,
  StudentStatus,
  TuitionStatus,
} from "@prisma/client";
import { prisma } from "@/database/db";
import { AppError } from "@/utils/errors";
import { buildPaginatedResult, type PaginationQuery } from "@/utils/validators";

// ============================================================
// SHARED HELPERS
// ============================================================

function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function toNum(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function toIsoDate(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

/** Parses a `YYYY-MM-DD` search term into a Date for exact-date search matches, or null otherwise. */
function parseSearchDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Prisma `@db.Date` columns serialize to full ISO datetime strings by default
 * (e.g. "2025-01-15T00:00:00.000Z"), which `<input type="date">` on the frontend
 * cannot populate. Normalizing the listed fields to plain `YYYY-MM-DD` strings
 * here keeps API responses directly editable by the generic CRUD form.
 */
function withDateStrings<T extends Record<string, unknown>>(row: T, fields: readonly (keyof T & string)[]): T {
  const out: Record<string, unknown> = { ...row };
  for (const field of fields) {
    const value = out[field];
    if (value instanceof Date) {
      out[field] = value.toISOString().slice(0, 10);
    }
  }
  return out as T;
}

async function ensureExists<T>(finder: Promise<T | null>, message: string): Promise<T> {
  const record = await finder;
  if (!record) throw AppError.badRequest(message);
  return record;
}

// ============================================================
// STUDENTS
// ============================================================

export interface CreateStudentInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: Date;
  gender?: string;
  address?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  enrollmentDate: Date;
  status?: StudentStatus;
}

export type UpdateStudentInput = Partial<CreateStudentInput>;

function buildStudentWhere(tenantId: string, search?: string): Prisma.StudentStudentWhereInput {
  if (!search) return { tenantId };
  const or: Prisma.StudentStudentWhereInput[] = [
    { firstName: { contains: search, mode: "insensitive" } },
    { lastName: { contains: search, mode: "insensitive" } },
    { email: { contains: search, mode: "insensitive" } },
  ];
  const parsedDate = parseSearchDate(search);
  if (parsedDate) or.push({ enrollmentDate: parsedDate });
  return { tenantId, OR: or };
}

function studentOrderBy(query: PaginationQuery): Prisma.StudentStudentOrderByWithRelationInput {
  switch (query.sortBy) {
    case "firstName":
      return { firstName: query.sortDir };
    case "lastName":
      return { lastName: query.sortDir };
    case "email":
      return { email: query.sortDir };
    case "enrollmentDate":
      return { enrollmentDate: query.sortDir };
    case "status":
      return { status: query.sortDir };
    default:
      return { createdAt: query.sortDir };
  }
}

const studentDateFields = ["dateOfBirth", "enrollmentDate"] as const;

export async function listStudents(tenantId: string, query: PaginationQuery) {
  const where = buildStudentWhere(tenantId, query.search);
  const [rows, total] = await Promise.all([
    prisma.studentStudent.findMany({ where, orderBy: studentOrderBy(query), skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.studentStudent.count({ where }),
  ]);
  const data = rows.map((r) => withDateStrings(r, studentDateFields));
  return buildPaginatedResult(data, total, query);
}

export async function listStudentsForExport(tenantId: string, search?: string): Promise<Record<string, unknown>[]> {
  const rows = await prisma.studentStudent.findMany({ where: buildStudentWhere(tenantId, search), orderBy: { createdAt: "desc" } });
  return rows.map((s) => ({
    firstName: s.firstName,
    lastName: s.lastName,
    email: s.email ?? "",
    phone: s.phone ?? "",
    dateOfBirth: toIsoDate(s.dateOfBirth),
    gender: s.gender ?? "",
    parentName: s.parentName ?? "",
    parentEmail: s.parentEmail ?? "",
    parentPhone: s.parentPhone ?? "",
    enrollmentDate: toIsoDate(s.enrollmentDate),
    status: s.status,
  }));
}

export async function createStudent(tenantId: string, input: CreateStudentInput) {
  const created = await prisma.studentStudent.create({ data: { tenantId, ...input } });
  return withDateStrings(created, studentDateFields);
}

export async function updateStudent(tenantId: string, id: string, input: UpdateStudentInput) {
  await ensureExists(prisma.studentStudent.findFirst({ where: { id, tenantId }, select: { id: true } }), "Student not found");
  const updated = await prisma.studentStudent.update({ where: { id }, data: input });
  return withDateStrings(updated, studentDateFields);
}

export async function deleteStudent(tenantId: string, id: string): Promise<void> {
  await ensureExists(prisma.studentStudent.findFirst({ where: { id, tenantId }, select: { id: true } }), "Student not found");
  await prisma.studentStudent.delete({ where: { id } });
}

// ============================================================
// INSTRUCTORS
// ============================================================

export interface CreateInstructorInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  specialization?: string;
  bio?: string;
  hireDate?: Date;
}

export type UpdateInstructorInput = Partial<CreateInstructorInput>;

function buildInstructorWhere(tenantId: string, search?: string): Prisma.StudentInstructorWhereInput {
  if (!search) return { tenantId };
  return {
    tenantId,
    OR: [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { specialization: { contains: search, mode: "insensitive" } },
    ],
  };
}

function instructorOrderBy(query: PaginationQuery): Prisma.StudentInstructorOrderByWithRelationInput {
  switch (query.sortBy) {
    case "firstName":
      return { firstName: query.sortDir };
    case "lastName":
      return { lastName: query.sortDir };
    case "email":
      return { email: query.sortDir };
    default:
      return { createdAt: query.sortDir };
  }
}

const instructorDateFields = ["hireDate"] as const;

export async function listInstructors(tenantId: string, query: PaginationQuery) {
  const where = buildInstructorWhere(tenantId, query.search);
  const [rows, total] = await Promise.all([
    prisma.studentInstructor.findMany({ where, orderBy: instructorOrderBy(query), skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.studentInstructor.count({ where }),
  ]);
  const data = rows.map((r) => withDateStrings(r, instructorDateFields));
  return buildPaginatedResult(data, total, query);
}

export async function listInstructorsForExport(tenantId: string, search?: string): Promise<Record<string, unknown>[]> {
  const rows = await prisma.studentInstructor.findMany({ where: buildInstructorWhere(tenantId, search), orderBy: { createdAt: "desc" } });
  return rows.map((i) => ({
    firstName: i.firstName,
    lastName: i.lastName,
    email: i.email ?? "",
    phone: i.phone ?? "",
    specialization: i.specialization ?? "",
    hireDate: toIsoDate(i.hireDate),
  }));
}

export async function createInstructor(tenantId: string, input: CreateInstructorInput) {
  const created = await prisma.studentInstructor.create({ data: { tenantId, ...input } });
  return withDateStrings(created, instructorDateFields);
}

export async function updateInstructor(tenantId: string, id: string, input: UpdateInstructorInput) {
  await ensureExists(prisma.studentInstructor.findFirst({ where: { id, tenantId }, select: { id: true } }), "Instructor not found");
  const updated = await prisma.studentInstructor.update({ where: { id }, data: input });
  return withDateStrings(updated, instructorDateFields);
}

export async function deleteInstructor(tenantId: string, id: string): Promise<void> {
  await ensureExists(prisma.studentInstructor.findFirst({ where: { id, tenantId }, select: { id: true } }), "Instructor not found");
  const classCount = await prisma.studentClass.count({ where: { tenantId, instructorId: id } });
  if (classCount > 0) {
    throw AppError.conflict("Cannot delete an instructor who is still assigned to classes");
  }
  await prisma.studentInstructor.delete({ where: { id } });
}

// ============================================================
// CLASSES
// ============================================================

export interface CreateClassInput {
  courseName: string;
  courseCode?: string;
  instructorId: string;
  description?: string;
  schedule?: Prisma.InputJsonValue;
  capacity: number;
  pricePerCourse?: number;
  startDate?: Date;
  endDate?: Date;
  status?: ClassStatus;
}

export type UpdateClassInput = Partial<CreateClassInput>;

function buildClassWhere(tenantId: string, search?: string): Prisma.StudentClassWhereInput {
  if (!search) return { tenantId };
  return {
    tenantId,
    OR: [
      { courseName: { contains: search, mode: "insensitive" } },
      { courseCode: { contains: search, mode: "insensitive" } },
    ],
  };
}

function classOrderBy(query: PaginationQuery): Prisma.StudentClassOrderByWithRelationInput {
  switch (query.sortBy) {
    case "courseName":
      return { courseName: query.sortDir };
    case "capacity":
      return { capacity: query.sortDir };
    case "enrolledCount":
      return { enrolledCount: query.sortDir };
    case "startDate":
      return { startDate: query.sortDir };
    case "status":
      return { status: query.sortDir };
    default:
      return { createdAt: query.sortDir };
  }
}

const classInclude = { instructor: true } satisfies Prisma.StudentClassInclude;
const classDateFields = ["startDate", "endDate"] as const;

export async function listClasses(tenantId: string, query: PaginationQuery) {
  const where = buildClassWhere(tenantId, query.search);
  const [rows, total] = await Promise.all([
    prisma.studentClass.findMany({
      where,
      include: classInclude,
      orderBy: classOrderBy(query),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.studentClass.count({ where }),
  ]);
  const data = rows.map((r) => withDateStrings(r, classDateFields));
  return buildPaginatedResult(data, total, query);
}

export async function listClassesForExport(tenantId: string, search?: string): Promise<Record<string, unknown>[]> {
  const rows = await prisma.studentClass.findMany({ where: buildClassWhere(tenantId, search), include: classInclude, orderBy: { createdAt: "desc" } });
  return rows.map((c) => ({
    courseName: c.courseName,
    courseCode: c.courseCode ?? "",
    instructorName: fullName(c.instructor.firstName, c.instructor.lastName),
    capacity: c.capacity,
    enrolledCount: c.enrolledCount,
    pricePerCourse: c.pricePerCourse === null ? "" : toNum(c.pricePerCourse),
    startDate: toIsoDate(c.startDate),
    endDate: toIsoDate(c.endDate),
    status: c.status,
  }));
}

export async function createClass(tenantId: string, input: CreateClassInput) {
  await ensureExists(prisma.studentInstructor.findFirst({ where: { id: input.instructorId, tenantId }, select: { id: true } }), "Instructor not found");
  const created = await prisma.studentClass.create({ data: { tenantId, ...input }, include: classInclude });
  return withDateStrings(created, classDateFields);
}

export async function updateClass(tenantId: string, id: string, input: UpdateClassInput) {
  await ensureExists(prisma.studentClass.findFirst({ where: { id, tenantId }, select: { id: true } }), "Class not found");
  if (input.instructorId) {
    await ensureExists(prisma.studentInstructor.findFirst({ where: { id: input.instructorId, tenantId }, select: { id: true } }), "Instructor not found");
  }
  const updated = await prisma.studentClass.update({ where: { id }, data: input, include: classInclude });
  return withDateStrings(updated, classDateFields);
}

export async function deleteClass(tenantId: string, id: string): Promise<void> {
  await ensureExists(prisma.studentClass.findFirst({ where: { id, tenantId }, select: { id: true } }), "Class not found");
  await prisma.studentClass.delete({ where: { id } });
}

/** Recomputes and persists a class's enrolledCount from actual active enrollment rows. */
async function syncClassEnrolledCount(classId: string): Promise<void> {
  const activeCount = await prisma.studentEnrollment.count({ where: { classId, status: "active" } });
  await prisma.studentClass.update({ where: { id: classId }, data: { enrolledCount: activeCount } });
}

// ============================================================
// ENROLLMENTS
// ============================================================

export interface CreateEnrollmentInput {
  studentId: string;
  classId: string;
  enrollmentDate: Date;
  status?: EnrollmentStatus;
  progressPercentage?: number;
}

export type UpdateEnrollmentInput = Partial<CreateEnrollmentInput>;

const enrollmentInclude = { student: true, class: { include: classInclude } } satisfies Prisma.StudentEnrollmentInclude;

function buildEnrollmentWhere(tenantId: string, search?: string): Prisma.StudentEnrollmentWhereInput {
  if (!search) return { tenantId };
  return {
    tenantId,
    OR: [
      { student: { firstName: { contains: search, mode: "insensitive" } } },
      { student: { lastName: { contains: search, mode: "insensitive" } } },
      { class: { courseName: { contains: search, mode: "insensitive" } } },
    ],
  };
}

function enrollmentOrderBy(query: PaginationQuery): Prisma.StudentEnrollmentOrderByWithRelationInput {
  switch (query.sortBy) {
    case "enrollmentDate":
      return { enrollmentDate: query.sortDir };
    case "status":
      return { status: query.sortDir };
    case "progressPercentage":
      return { progressPercentage: query.sortDir };
    default:
      return { createdAt: query.sortDir };
  }
}

const enrollmentDateFields = ["enrollmentDate"] as const;

export async function listEnrollments(tenantId: string, query: PaginationQuery) {
  const where = buildEnrollmentWhere(tenantId, query.search);
  const [rows, total] = await Promise.all([
    prisma.studentEnrollment.findMany({
      where,
      include: enrollmentInclude,
      orderBy: enrollmentOrderBy(query),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.studentEnrollment.count({ where }),
  ]);
  const data = rows.map((r) => withDateStrings(r, enrollmentDateFields));
  return buildPaginatedResult(data, total, query);
}

export async function listEnrollmentsForExport(tenantId: string, search?: string): Promise<Record<string, unknown>[]> {
  const rows = await prisma.studentEnrollment.findMany({ where: buildEnrollmentWhere(tenantId, search), include: enrollmentInclude, orderBy: { createdAt: "desc" } });
  return rows.map((e) => ({
    studentName: fullName(e.student.firstName, e.student.lastName),
    className: e.class.courseName,
    enrollmentDate: toIsoDate(e.enrollmentDate),
    status: e.status,
    progressPercentage: e.progressPercentage,
  }));
}

export async function createEnrollment(tenantId: string, input: CreateEnrollmentInput) {
  await ensureExists(prisma.studentStudent.findFirst({ where: { id: input.studentId, tenantId }, select: { id: true } }), "Student not found");
  const cls = await ensureExists(prisma.studentClass.findFirst({ where: { id: input.classId, tenantId } }), "Class not found");

  const status = input.status ?? "active";
  if (status === "active") {
    const activeCount = await prisma.studentEnrollment.count({ where: { classId: input.classId, status: "active" } });
    if (activeCount >= cls.capacity) {
      throw AppError.conflict("This class is already at capacity");
    }
  }

  const created = await prisma.studentEnrollment.create({
    data: {
      tenantId,
      studentId: input.studentId,
      classId: input.classId,
      enrollmentDate: input.enrollmentDate,
      status,
      progressPercentage: input.progressPercentage ?? 0,
    },
  });
  await syncClassEnrolledCount(input.classId);
  const result = await prisma.studentEnrollment.findUniqueOrThrow({ where: { id: created.id }, include: enrollmentInclude });
  return withDateStrings(result, enrollmentDateFields);
}

export async function updateEnrollment(tenantId: string, id: string, input: UpdateEnrollmentInput) {
  const existing = await ensureExists(prisma.studentEnrollment.findFirst({ where: { id, tenantId } }), "Enrollment not found");

  const nextClassId = input.classId ?? existing.classId;
  const nextStatus = input.status ?? existing.status;

  if (input.classId) {
    await ensureExists(prisma.studentClass.findFirst({ where: { id: input.classId, tenantId }, select: { id: true } }), "Class not found");
  }
  if (input.studentId) {
    await ensureExists(prisma.studentStudent.findFirst({ where: { id: input.studentId, tenantId }, select: { id: true } }), "Student not found");
  }

  const becomingActiveElsewhere = nextStatus === "active" && !(existing.status === "active" && nextClassId === existing.classId);
  if (becomingActiveElsewhere) {
    const cls = await ensureExists(prisma.studentClass.findFirst({ where: { id: nextClassId, tenantId } }), "Class not found");
    const activeCount = await prisma.studentEnrollment.count({ where: { classId: nextClassId, status: "active", id: { not: id } } });
    if (activeCount >= cls.capacity) {
      throw AppError.conflict("This class is already at capacity");
    }
  }

  await prisma.studentEnrollment.update({ where: { id }, data: input });
  await syncClassEnrolledCount(existing.classId);
  if (nextClassId !== existing.classId) {
    await syncClassEnrolledCount(nextClassId);
  }
  const result = await prisma.studentEnrollment.findUniqueOrThrow({ where: { id }, include: enrollmentInclude });
  return withDateStrings(result, enrollmentDateFields);
}

export async function deleteEnrollment(tenantId: string, id: string): Promise<void> {
  const existing = await ensureExists(prisma.studentEnrollment.findFirst({ where: { id, tenantId }, select: { id: true, classId: true } }), "Enrollment not found");
  await prisma.studentEnrollment.delete({ where: { id } });
  await syncClassEnrolledCount(existing.classId);
}

// ============================================================
// ATTENDANCE
// ============================================================

export interface CreateAttendanceInput {
  studentId: string;
  classId: string;
  attendanceDate: Date;
  present: boolean;
  notes?: string;
}

export type UpdateAttendanceInput = Partial<CreateAttendanceInput>;

const attendanceInclude = { student: true, class: true } satisfies Prisma.StudentAttendanceInclude;

function buildAttendanceWhere(tenantId: string, search?: string): Prisma.StudentAttendanceWhereInput {
  if (!search) return { tenantId };
  return {
    tenantId,
    OR: [
      { student: { firstName: { contains: search, mode: "insensitive" } } },
      { student: { lastName: { contains: search, mode: "insensitive" } } },
      { class: { courseName: { contains: search, mode: "insensitive" } } },
    ],
  };
}

function attendanceOrderBy(query: PaginationQuery): Prisma.StudentAttendanceOrderByWithRelationInput {
  switch (query.sortBy) {
    case "attendanceDate":
      return { attendanceDate: query.sortDir };
    case "present":
      return { present: query.sortDir };
    default:
      return { createdAt: query.sortDir };
  }
}

const attendanceDateFields = ["attendanceDate"] as const;

export async function listAttendance(tenantId: string, query: PaginationQuery) {
  const where = buildAttendanceWhere(tenantId, query.search);
  const [rows, total] = await Promise.all([
    prisma.studentAttendance.findMany({
      where,
      include: attendanceInclude,
      orderBy: attendanceOrderBy(query),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.studentAttendance.count({ where }),
  ]);
  const data = rows.map((r) => withDateStrings(r, attendanceDateFields));
  return buildPaginatedResult(data, total, query);
}

export async function listAttendanceForExport(tenantId: string, search?: string): Promise<Record<string, unknown>[]> {
  const rows = await prisma.studentAttendance.findMany({ where: buildAttendanceWhere(tenantId, search), include: attendanceInclude, orderBy: { createdAt: "desc" } });
  return rows.map((a) => ({
    studentName: fullName(a.student.firstName, a.student.lastName),
    className: a.class.courseName,
    attendanceDate: toIsoDate(a.attendanceDate),
    present: a.present,
    notes: a.notes ?? "",
  }));
}

export async function createAttendance(tenantId: string, input: CreateAttendanceInput) {
  await ensureExists(prisma.studentStudent.findFirst({ where: { id: input.studentId, tenantId }, select: { id: true } }), "Student not found");
  await ensureExists(prisma.studentClass.findFirst({ where: { id: input.classId, tenantId }, select: { id: true } }), "Class not found");
  const created = await prisma.studentAttendance.create({ data: { tenantId, ...input } });
  const result = await prisma.studentAttendance.findUniqueOrThrow({ where: { id: created.id }, include: attendanceInclude });
  return withDateStrings(result, attendanceDateFields);
}

export async function updateAttendance(tenantId: string, id: string, input: UpdateAttendanceInput) {
  await ensureExists(prisma.studentAttendance.findFirst({ where: { id, tenantId }, select: { id: true } }), "Attendance record not found");
  await prisma.studentAttendance.update({ where: { id }, data: input });
  const result = await prisma.studentAttendance.findUniqueOrThrow({ where: { id }, include: attendanceInclude });
  return withDateStrings(result, attendanceDateFields);
}

export async function deleteAttendance(tenantId: string, id: string): Promise<void> {
  await ensureExists(prisma.studentAttendance.findFirst({ where: { id, tenantId }, select: { id: true } }), "Attendance record not found");
  await prisma.studentAttendance.delete({ where: { id } });
}

export interface BulkAttendanceRecord {
  studentId: string;
  present: boolean;
  notes?: string;
}

export interface BulkAttendanceInput {
  classId: string;
  date: Date;
  records: BulkAttendanceRecord[];
}

export async function bulkMarkAttendance(tenantId: string, input: BulkAttendanceInput) {
  await ensureExists(prisma.studentClass.findFirst({ where: { id: input.classId, tenantId }, select: { id: true } }), "Class not found");

  const studentIds = input.records.map((r) => r.studentId);
  const validStudents = await prisma.studentStudent.findMany({ where: { tenantId, id: { in: studentIds } }, select: { id: true } });
  const validStudentIds = new Set(validStudents.map((s) => s.id));
  const invalid = studentIds.filter((id) => !validStudentIds.has(id));
  if (invalid.length > 0) {
    throw AppError.badRequest("One or more students were not found", { invalidStudentIds: invalid });
  }

  const existing = await prisma.studentAttendance.findMany({
    where: { tenantId, classId: input.classId, attendanceDate: input.date, studentId: { in: studentIds } },
  });
  const existingByStudent = new Map(existing.map((e) => [e.studentId, e]));

  const ops = input.records.map((record) => {
    const found = existingByStudent.get(record.studentId);
    if (found) {
      return prisma.studentAttendance.update({ where: { id: found.id }, data: { present: record.present, notes: record.notes ?? null } });
    }
    return prisma.studentAttendance.create({
      data: {
        tenantId,
        studentId: record.studentId,
        classId: input.classId,
        attendanceDate: input.date,
        present: record.present,
        notes: record.notes ?? null,
      },
    });
  });

  return prisma.$transaction(ops);
}

// ============================================================
// GRADES
// ============================================================

export interface CreateGradeInput {
  studentId: string;
  classId: string;
  assignmentName?: string;
  score: number;
  maxScore: number;
  weight?: number;
  submittedDate?: Date;
  comments?: string;
}

export type UpdateGradeInput = Partial<CreateGradeInput>;

const gradeInclude = { student: true, class: true } satisfies Prisma.StudentGradeInclude;

function buildGradeWhere(tenantId: string, search?: string): Prisma.StudentGradeWhereInput {
  if (!search) return { tenantId };
  return {
    tenantId,
    OR: [
      { student: { firstName: { contains: search, mode: "insensitive" } } },
      { student: { lastName: { contains: search, mode: "insensitive" } } },
      { class: { courseName: { contains: search, mode: "insensitive" } } },
      { assignmentName: { contains: search, mode: "insensitive" } },
    ],
  };
}

function gradeOrderBy(query: PaginationQuery): Prisma.StudentGradeOrderByWithRelationInput {
  switch (query.sortBy) {
    case "score":
      return { score: query.sortDir };
    case "submittedDate":
      return { submittedDate: query.sortDir };
    case "assignmentName":
      return { assignmentName: query.sortDir };
    default:
      return { createdAt: query.sortDir };
  }
}

const gradeDateFields = ["submittedDate"] as const;

export async function listGrades(tenantId: string, query: PaginationQuery) {
  const where = buildGradeWhere(tenantId, query.search);
  const [rows, total] = await Promise.all([
    prisma.studentGrade.findMany({
      where,
      include: gradeInclude,
      orderBy: gradeOrderBy(query),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.studentGrade.count({ where }),
  ]);
  const data = rows.map((r) => withDateStrings(r, gradeDateFields));
  return buildPaginatedResult(data, total, query);
}

export async function listGradesForExport(tenantId: string, search?: string): Promise<Record<string, unknown>[]> {
  const rows = await prisma.studentGrade.findMany({ where: buildGradeWhere(tenantId, search), include: gradeInclude, orderBy: { createdAt: "desc" } });
  return rows.map((g) => ({
    studentName: fullName(g.student.firstName, g.student.lastName),
    className: g.class.courseName,
    assignmentName: g.assignmentName ?? "",
    score: toNum(g.score),
    maxScore: toNum(g.maxScore),
    weight: g.weight,
    submittedDate: toIsoDate(g.submittedDate),
    comments: g.comments ?? "",
  }));
}

export async function createGrade(tenantId: string, input: CreateGradeInput) {
  await ensureExists(prisma.studentStudent.findFirst({ where: { id: input.studentId, tenantId }, select: { id: true } }), "Student not found");
  await ensureExists(prisma.studentClass.findFirst({ where: { id: input.classId, tenantId }, select: { id: true } }), "Class not found");
  if (input.maxScore <= 0) {
    throw AppError.badRequest("maxScore must be greater than zero");
  }
  const created = await prisma.studentGrade.create({ data: { tenantId, ...input, weight: input.weight ?? 100 } });
  const result = await prisma.studentGrade.findUniqueOrThrow({ where: { id: created.id }, include: gradeInclude });
  return withDateStrings(result, gradeDateFields);
}

export async function updateGrade(tenantId: string, id: string, input: UpdateGradeInput) {
  await ensureExists(prisma.studentGrade.findFirst({ where: { id, tenantId }, select: { id: true } }), "Grade not found");
  if (input.maxScore !== undefined && input.maxScore <= 0) {
    throw AppError.badRequest("maxScore must be greater than zero");
  }
  await prisma.studentGrade.update({ where: { id }, data: input });
  const result = await prisma.studentGrade.findUniqueOrThrow({ where: { id }, include: gradeInclude });
  return withDateStrings(result, gradeDateFields);
}

export async function deleteGrade(tenantId: string, id: string): Promise<void> {
  await ensureExists(prisma.studentGrade.findFirst({ where: { id, tenantId }, select: { id: true } }), "Grade not found");
  await prisma.studentGrade.delete({ where: { id } });
}

export interface GradesSummary {
  averagePercentage: number;
  count: number;
}

export async function getGradesSummary(tenantId: string, studentId: string): Promise<GradesSummary> {
  const grades = await prisma.studentGrade.findMany({ where: { tenantId, studentId } });
  if (grades.length === 0) {
    return { averagePercentage: 0, count: 0 };
  }

  let weightedSum = 0;
  let weightTotal = 0;
  for (const grade of grades) {
    const maxScore = toNum(grade.maxScore);
    if (maxScore <= 0) continue;
    const percentage = (toNum(grade.score) / maxScore) * 100;
    weightedSum += percentage * grade.weight;
    weightTotal += grade.weight;
  }

  const averagePercentage = weightTotal > 0 ? weightedSum / weightTotal : 0;
  return { averagePercentage: Math.round(averagePercentage * 100) / 100, count: grades.length };
}

// ============================================================
// TUITION RECORDS
// ============================================================

export interface CreateTuitionRecordInput {
  studentId: string;
  classId: string;
  amountDue: number;
  amountPaid?: number;
  dueDate: Date;
  paidDate?: Date;
  paymentMethod?: string;
  notes?: string;
}

export type UpdateTuitionRecordInput = Partial<CreateTuitionRecordInput>;

const tuitionInclude = { student: true, class: true } satisfies Prisma.StudentTuitionRecordInclude;

function computeTuitionStatus(amountDue: number, amountPaid: number, dueDate: Date): TuitionStatus {
  if (amountPaid >= amountDue) return "paid";
  if (dueDate.getTime() < Date.now()) return "overdue";
  if (amountPaid > 0) return "partial";
  return "pending";
}

function buildTuitionWhere(tenantId: string, search?: string): Prisma.StudentTuitionRecordWhereInput {
  if (!search) return { tenantId };
  return {
    tenantId,
    OR: [
      { student: { firstName: { contains: search, mode: "insensitive" } } },
      { student: { lastName: { contains: search, mode: "insensitive" } } },
      { class: { courseName: { contains: search, mode: "insensitive" } } },
    ],
  };
}

function tuitionOrderBy(query: PaginationQuery): Prisma.StudentTuitionRecordOrderByWithRelationInput {
  switch (query.sortBy) {
    case "amountDue":
      return { amountDue: query.sortDir };
    case "dueDate":
      return { dueDate: query.sortDir };
    case "status":
      return { status: query.sortDir };
    default:
      return { createdAt: query.sortDir };
  }
}

type TuitionWithRelations = Prisma.StudentTuitionRecordGetPayload<{ include: typeof tuitionInclude }>;

/** Recomputes each record's status from amountDue/amountPaid/dueDate, persisting any rows found stale. */
async function reconcileTuitionStatuses(records: TuitionWithRelations[]): Promise<TuitionWithRelations[]> {
  const stale: { id: string; status: TuitionStatus }[] = [];
  const reconciled = records.map((record) => {
    const status = computeTuitionStatus(toNum(record.amountDue), toNum(record.amountPaid), record.dueDate);
    if (status !== record.status) stale.push({ id: record.id, status });
    return { ...record, status };
  });

  if (stale.length > 0) {
    await prisma.$transaction(stale.map((s) => prisma.studentTuitionRecord.update({ where: { id: s.id }, data: { status: s.status } })));
  }

  return reconciled;
}

const tuitionDateFields = ["dueDate", "paidDate"] as const;

export async function listTuitionRecords(tenantId: string, query: PaginationQuery) {
  const where = buildTuitionWhere(tenantId, query.search);
  const [rows, total] = await Promise.all([
    prisma.studentTuitionRecord.findMany({
      where,
      include: tuitionInclude,
      orderBy: tuitionOrderBy(query),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.studentTuitionRecord.count({ where }),
  ]);
  const reconciled = await reconcileTuitionStatuses(rows);
  const data = reconciled.map((r) => withDateStrings(r, tuitionDateFields));
  return buildPaginatedResult(data, total, query);
}

export async function listTuitionRecordsForExport(tenantId: string, search?: string): Promise<Record<string, unknown>[]> {
  const rows = await prisma.studentTuitionRecord.findMany({ where: buildTuitionWhere(tenantId, search), include: tuitionInclude, orderBy: { createdAt: "desc" } });
  const reconciled = await reconcileTuitionStatuses(rows);
  return reconciled.map((t) => ({
    studentName: fullName(t.student.firstName, t.student.lastName),
    className: t.class.courseName,
    amountDue: toNum(t.amountDue),
    amountPaid: toNum(t.amountPaid),
    dueDate: toIsoDate(t.dueDate),
    paidDate: toIsoDate(t.paidDate),
    paymentMethod: t.paymentMethod ?? "",
    status: t.status,
    notes: t.notes ?? "",
  }));
}

export async function createTuitionRecord(tenantId: string, input: CreateTuitionRecordInput) {
  await ensureExists(prisma.studentStudent.findFirst({ where: { id: input.studentId, tenantId }, select: { id: true } }), "Student not found");
  await ensureExists(prisma.studentClass.findFirst({ where: { id: input.classId, tenantId }, select: { id: true } }), "Class not found");

  const amountPaid = input.amountPaid ?? 0;
  const status = computeTuitionStatus(input.amountDue, amountPaid, input.dueDate);

  const created = await prisma.studentTuitionRecord.create({
    data: { tenantId, ...input, amountPaid, status },
  });
  const result = await prisma.studentTuitionRecord.findUniqueOrThrow({ where: { id: created.id }, include: tuitionInclude });
  return withDateStrings(result, tuitionDateFields);
}

export async function updateTuitionRecord(tenantId: string, id: string, input: UpdateTuitionRecordInput) {
  const existing = await ensureExists(prisma.studentTuitionRecord.findFirst({ where: { id, tenantId } }), "Tuition record not found");

  const amountDue = input.amountDue ?? toNum(existing.amountDue);
  const amountPaid = input.amountPaid ?? toNum(existing.amountPaid);
  const dueDate = input.dueDate ?? existing.dueDate;
  const status = computeTuitionStatus(amountDue, amountPaid, dueDate);

  await prisma.studentTuitionRecord.update({ where: { id }, data: { ...input, status } });
  const result = await prisma.studentTuitionRecord.findUniqueOrThrow({ where: { id }, include: tuitionInclude });
  return withDateStrings(result, tuitionDateFields);
}

export async function deleteTuitionRecord(tenantId: string, id: string): Promise<void> {
  await ensureExists(prisma.studentTuitionRecord.findFirst({ where: { id, tenantId }, select: { id: true } }), "Tuition record not found");
  await prisma.studentTuitionRecord.delete({ where: { id } });
}

// ============================================================
// ANNOUNCEMENTS
// ============================================================

export interface CreateAnnouncementInput {
  title: string;
  content: string;
  audienceType: AnnouncementAudience;
  targetClassId?: string;
}

export type UpdateAnnouncementInput = Partial<CreateAnnouncementInput>;

const announcementInclude = { targetClass: true } satisfies Prisma.StudentAnnouncementInclude;

function buildAnnouncementWhere(tenantId: string, search?: string): Prisma.StudentAnnouncementWhereInput {
  if (!search) return { tenantId };
  return {
    tenantId,
    OR: [
      { title: { contains: search, mode: "insensitive" } },
      { content: { contains: search, mode: "insensitive" } },
    ],
  };
}

function announcementOrderBy(query: PaginationQuery): Prisma.StudentAnnouncementOrderByWithRelationInput {
  switch (query.sortBy) {
    case "title":
      return { title: query.sortDir };
    case "audienceType":
      return { audienceType: query.sortDir };
    default:
      return { createdAt: query.sortDir };
  }
}

export async function listAnnouncements(tenantId: string, query: PaginationQuery) {
  const where = buildAnnouncementWhere(tenantId, query.search);
  const [data, total] = await Promise.all([
    prisma.studentAnnouncement.findMany({
      where,
      include: announcementInclude,
      orderBy: announcementOrderBy(query),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.studentAnnouncement.count({ where }),
  ]);
  return buildPaginatedResult(data, total, query);
}

export async function listAnnouncementsForExport(tenantId: string, search?: string): Promise<Record<string, unknown>[]> {
  const rows = await prisma.studentAnnouncement.findMany({ where: buildAnnouncementWhere(tenantId, search), include: announcementInclude, orderBy: { createdAt: "desc" } });
  return rows.map((a) => ({
    title: a.title,
    content: a.content,
    audienceType: a.audienceType,
    targetClassName: a.targetClass?.courseName ?? "",
    createdAt: a.createdAt.toISOString(),
  }));
}

export async function createAnnouncement(tenantId: string, createdBy: string, input: CreateAnnouncementInput) {
  if (input.audienceType === "class_specific" && !input.targetClassId) {
    throw AppError.badRequest("targetClassId is required for a class-specific announcement");
  }
  if (input.targetClassId) {
    await ensureExists(prisma.studentClass.findFirst({ where: { id: input.targetClassId, tenantId }, select: { id: true } }), "Class not found");
  }
  const created = await prisma.studentAnnouncement.create({ data: { tenantId, createdBy, ...input } });
  return prisma.studentAnnouncement.findUniqueOrThrow({ where: { id: created.id }, include: announcementInclude });
}

export async function updateAnnouncement(tenantId: string, id: string, input: UpdateAnnouncementInput) {
  const existing = await ensureExists(prisma.studentAnnouncement.findFirst({ where: { id, tenantId } }), "Announcement not found");
  const nextAudience = input.audienceType ?? existing.audienceType;
  const nextTargetClassId = input.targetClassId ?? existing.targetClassId ?? undefined;
  if (nextAudience === "class_specific" && !nextTargetClassId) {
    throw AppError.badRequest("targetClassId is required for a class-specific announcement");
  }
  if (input.targetClassId) {
    await ensureExists(prisma.studentClass.findFirst({ where: { id: input.targetClassId, tenantId }, select: { id: true } }), "Class not found");
  }
  await prisma.studentAnnouncement.update({ where: { id }, data: input });
  return prisma.studentAnnouncement.findUniqueOrThrow({ where: { id }, include: announcementInclude });
}

export async function deleteAnnouncement(tenantId: string, id: string): Promise<void> {
  await ensureExists(prisma.studentAnnouncement.findFirst({ where: { id, tenantId }, select: { id: true } }), "Announcement not found");
  await prisma.studentAnnouncement.delete({ where: { id } });
}

// ============================================================
// DASHBOARD
// ============================================================

export interface DashboardData {
  totalActiveStudents: number;
  classesRunning: number;
  attendanceRatePercentage: number;
  pendingTuitionAmount: number;
  upcomingClasses: Prisma.StudentClassGetPayload<{ include: typeof classInclude }>[];
  recentEnrollments: Prisma.StudentEnrollmentGetPayload<{ include: typeof enrollmentInclude }>[];
  lowAttendanceStudents: { studentId: string; firstName: string; lastName: string; attendanceRatePercentage: number }[];
}

export async function getDashboard(tenantId: string): Promise<DashboardData> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [totalActiveStudents, classesRunning, attendanceRecords, tuitionRecords, upcomingClasses, recentEnrollments] = await Promise.all([
    prisma.studentStudent.count({ where: { tenantId, status: "active" } }),
    prisma.studentClass.count({ where: { tenantId, status: "active" } }),
    prisma.studentAttendance.findMany({
      where: { tenantId, attendanceDate: { gte: thirtyDaysAgo } },
      select: { present: true, studentId: true },
    }),
    prisma.studentTuitionRecord.findMany({ where: { tenantId }, select: { amountDue: true, amountPaid: true } }),
    prisma.studentClass.findMany({ where: { tenantId, status: "active" }, include: classInclude, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.studentEnrollment.findMany({ where: { tenantId }, include: enrollmentInclude, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const attendanceRatePercentage =
    attendanceRecords.length === 0 ? 0 : Math.round((attendanceRecords.filter((r) => r.present).length / attendanceRecords.length) * 10000) / 100;

  const pendingTuitionAmount = tuitionRecords.reduce((sum, t) => sum + Math.max(0, toNum(t.amountDue) - toNum(t.amountPaid)), 0);

  const byStudent = new Map<string, { present: number; total: number }>();
  for (const record of attendanceRecords) {
    const entry = byStudent.get(record.studentId) ?? { present: 0, total: 0 };
    entry.total += 1;
    if (record.present) entry.present += 1;
    byStudent.set(record.studentId, entry);
  }

  const lowAttendanceIds = [...byStudent.entries()]
    .filter(([, v]) => v.total > 0 && v.present / v.total < 0.8)
    .map(([studentId, v]) => ({ studentId, rate: Math.round((v.present / v.total) * 10000) / 100 }));

  const lowAttendanceStudentRecords =
    lowAttendanceIds.length === 0
      ? []
      : await prisma.studentStudent.findMany({
          where: { tenantId, id: { in: lowAttendanceIds.map((s) => s.studentId) } },
          select: { id: true, firstName: true, lastName: true },
        });

  const rateById = new Map(lowAttendanceIds.map((s) => [s.studentId, s.rate]));
  const lowAttendanceStudents = lowAttendanceStudentRecords.map((s) => ({
    studentId: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    attendanceRatePercentage: rateById.get(s.id) ?? 0,
  }));

  return {
    totalActiveStudents,
    classesRunning,
    attendanceRatePercentage,
    pendingTuitionAmount,
    upcomingClasses,
    recentEnrollments,
    lowAttendanceStudents,
  };
}
