import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import * as studentService from "@/services/student.service";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenantIsolation";
import { requireModule } from "@/middleware/moduleGuard";
import { paginationSchema } from "@/utils/validators";
import { sendCsv } from "@/utils/csv";
import { recordAudit } from "@/utils/audit";

const router = Router();
router.use(authenticate, resolveTenant, requireModule("student"));
// Staff can read/create/update within the module; deleting is admin-only.
router.delete("*", requireRole("tenant_admin", "super_admin"));

const exportQuerySchema = z.object({ search: z.string().trim().optional() });

const studentStatusEnum = z.enum(["active", "inactive", "graduated", "suspended"]);
const classStatusEnum = z.enum(["active", "completed", "cancelled"]);
const enrollmentStatusEnum = z.enum(["active", "completed", "dropped", "suspended"]);
const announcementAudienceEnum = z.enum(["all_students", "class_specific", "instructor_only"]);

/** Treats "" (as sent by untouched optional select/date/text fields in EntityCrudPage) as absent. */
const emptyToUndefined = (value: unknown): unknown => (value === "" ? undefined : value);
const optionalEmail = () => z.preprocess(emptyToUndefined, z.string().email().optional());
const optionalDate = () => z.preprocess(emptyToUndefined, z.coerce.date().optional());
const optionalUuid = () => z.preprocess(emptyToUndefined, z.string().uuid().optional());

// ============================================================
// STUDENTS
// ============================================================

const createStudentSchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  email: optionalEmail(),
  phone: z.string().max(20).optional(),
  dateOfBirth: optionalDate(),
  gender: z.string().max(50).optional(),
  address: z.string().optional(),
  parentName: z.string().max(255).optional(),
  parentEmail: optionalEmail(),
  parentPhone: z.string().max(20).optional(),
  enrollmentDate: z.coerce.date(),
  status: z.preprocess(emptyToUndefined, studentStatusEnum.optional()),
});
const updateStudentSchema = createStudentSchema.partial();

router.get("/students", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await studentService.listStudents(req.tenantId!, query));
  } catch (err) {
    next(err);
  }
});

router.get("/students/export", async (req, res, next) => {
  try {
    const { search } = exportQuerySchema.parse(req.query);
    const rows = await studentService.listStudentsForExport(req.tenantId!, search);
    sendCsv(res, "students.csv", rows);
  } catch (err) {
    next(err);
  }
});

router.post("/students", async (req, res, next) => {
  try {
    const input = createStudentSchema.parse(req.body);
    const student = await studentService.createStudent(req.tenantId!, input);
    await recordAudit(req, "create", "student_students", student.id, input);
    res.status(201).json(student);
  } catch (err) {
    next(err);
  }
});

router.patch("/students/:id", async (req, res, next) => {
  try {
    const input = updateStudentSchema.parse(req.body);
    const student = await studentService.updateStudent(req.tenantId!, req.params.id, input);
    await recordAudit(req, "update", "student_students", student.id, input);
    res.json(student);
  } catch (err) {
    next(err);
  }
});

router.delete("/students/:id", async (req, res, next) => {
  try {
    await studentService.deleteStudent(req.tenantId!, req.params.id);
    await recordAudit(req, "delete", "student_students", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// INSTRUCTORS
// ============================================================

const createInstructorSchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  email: optionalEmail(),
  phone: z.string().max(20).optional(),
  specialization: z.string().max(255).optional(),
  bio: z.string().optional(),
  hireDate: optionalDate(),
});
const updateInstructorSchema = createInstructorSchema.partial();

router.get("/instructors", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await studentService.listInstructors(req.tenantId!, query));
  } catch (err) {
    next(err);
  }
});

router.get("/instructors/export", async (req, res, next) => {
  try {
    const { search } = exportQuerySchema.parse(req.query);
    const rows = await studentService.listInstructorsForExport(req.tenantId!, search);
    sendCsv(res, "instructors.csv", rows);
  } catch (err) {
    next(err);
  }
});

router.post("/instructors", async (req, res, next) => {
  try {
    const input = createInstructorSchema.parse(req.body);
    const instructor = await studentService.createInstructor(req.tenantId!, input);
    await recordAudit(req, "create", "student_instructors", instructor.id, input);
    res.status(201).json(instructor);
  } catch (err) {
    next(err);
  }
});

router.patch("/instructors/:id", async (req, res, next) => {
  try {
    const input = updateInstructorSchema.parse(req.body);
    const instructor = await studentService.updateInstructor(req.tenantId!, req.params.id, input);
    await recordAudit(req, "update", "student_instructors", instructor.id, input);
    res.json(instructor);
  } catch (err) {
    next(err);
  }
});

router.delete("/instructors/:id", async (req, res, next) => {
  try {
    await studentService.deleteInstructor(req.tenantId!, req.params.id);
    await recordAudit(req, "delete", "student_instructors", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// CLASSES
// ============================================================

const createClassSchema = z.object({
  courseName: z.string().min(1).max(255),
  courseCode: z.string().max(50).optional(),
  instructorId: z.string().uuid(),
  description: z.string().optional(),
  schedule: z.unknown().optional(),
  capacity: z.coerce.number().int().min(1),
  pricePerCourse: z.coerce.number().min(0).optional(),
  startDate: optionalDate(),
  endDate: optionalDate(),
  status: z.preprocess(emptyToUndefined, classStatusEnum.optional()),
});
const updateClassSchema = createClassSchema.partial();

function toClassServiceInput<T extends z.infer<typeof createClassSchema> | z.infer<typeof updateClassSchema>>(
  input: T,
): Omit<T, "schedule"> & { schedule?: Prisma.InputJsonValue } {
  return { ...input, schedule: input.schedule as Prisma.InputJsonValue | undefined };
}

router.get("/classes", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await studentService.listClasses(req.tenantId!, query));
  } catch (err) {
    next(err);
  }
});

router.get("/classes/export", async (req, res, next) => {
  try {
    const { search } = exportQuerySchema.parse(req.query);
    const rows = await studentService.listClassesForExport(req.tenantId!, search);
    sendCsv(res, "classes.csv", rows);
  } catch (err) {
    next(err);
  }
});

router.post("/classes", async (req, res, next) => {
  try {
    const input = createClassSchema.parse(req.body);
    const cls = await studentService.createClass(req.tenantId!, toClassServiceInput(input));
    await recordAudit(req, "create", "student_classes", cls.id, input);
    res.status(201).json(cls);
  } catch (err) {
    next(err);
  }
});

router.patch("/classes/:id", async (req, res, next) => {
  try {
    const input = updateClassSchema.parse(req.body);
    const cls = await studentService.updateClass(req.tenantId!, req.params.id, toClassServiceInput(input));
    await recordAudit(req, "update", "student_classes", cls.id, input);
    res.json(cls);
  } catch (err) {
    next(err);
  }
});

router.delete("/classes/:id", async (req, res, next) => {
  try {
    await studentService.deleteClass(req.tenantId!, req.params.id);
    await recordAudit(req, "delete", "student_classes", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// ENROLLMENTS
// ============================================================

const createEnrollmentSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  enrollmentDate: z.coerce.date(),
  status: z.preprocess(emptyToUndefined, enrollmentStatusEnum.optional()),
  progressPercentage: z.coerce.number().int().min(0).max(100).optional(),
});
const updateEnrollmentSchema = createEnrollmentSchema.partial();

router.get("/enrollments", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await studentService.listEnrollments(req.tenantId!, query));
  } catch (err) {
    next(err);
  }
});

router.get("/enrollments/export", async (req, res, next) => {
  try {
    const { search } = exportQuerySchema.parse(req.query);
    const rows = await studentService.listEnrollmentsForExport(req.tenantId!, search);
    sendCsv(res, "enrollments.csv", rows);
  } catch (err) {
    next(err);
  }
});

router.post("/enrollments", async (req, res, next) => {
  try {
    const input = createEnrollmentSchema.parse(req.body);
    const enrollment = await studentService.createEnrollment(req.tenantId!, input);
    await recordAudit(req, "create", "student_enrollments", enrollment.id, input);
    res.status(201).json(enrollment);
  } catch (err) {
    next(err);
  }
});

router.patch("/enrollments/:id", async (req, res, next) => {
  try {
    const input = updateEnrollmentSchema.parse(req.body);
    const enrollment = await studentService.updateEnrollment(req.tenantId!, req.params.id, input);
    await recordAudit(req, "update", "student_enrollments", enrollment.id, input);
    res.json(enrollment);
  } catch (err) {
    next(err);
  }
});

router.delete("/enrollments/:id", async (req, res, next) => {
  try {
    await studentService.deleteEnrollment(req.tenantId!, req.params.id);
    await recordAudit(req, "delete", "student_enrollments", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// ATTENDANCE
// ============================================================

const createAttendanceSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  attendanceDate: z.coerce.date(),
  present: z.boolean(),
  notes: z.string().optional(),
});
const updateAttendanceSchema = createAttendanceSchema.partial();

const bulkAttendanceSchema = z.object({
  classId: z.string().uuid(),
  date: z.coerce.date(),
  records: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        present: z.boolean(),
        notes: z.string().optional(),
      }),
    )
    .min(1),
});

router.get("/attendance", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await studentService.listAttendance(req.tenantId!, query));
  } catch (err) {
    next(err);
  }
});

router.get("/attendance/export", async (req, res, next) => {
  try {
    const { search } = exportQuerySchema.parse(req.query);
    const rows = await studentService.listAttendanceForExport(req.tenantId!, search);
    sendCsv(res, "attendance.csv", rows);
  } catch (err) {
    next(err);
  }
});

router.post("/attendance/bulk", async (req, res, next) => {
  try {
    const input = bulkAttendanceSchema.parse(req.body);
    const records = await studentService.bulkMarkAttendance(req.tenantId!, input);
    await recordAudit(req, "bulk_mark", "student_attendance", null, { classId: input.classId, date: input.date, count: input.records.length });
    res.status(201).json(records);
  } catch (err) {
    next(err);
  }
});

router.post("/attendance", async (req, res, next) => {
  try {
    const input = createAttendanceSchema.parse(req.body);
    const record = await studentService.createAttendance(req.tenantId!, input);
    await recordAudit(req, "create", "student_attendance", record.id, input);
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

router.patch("/attendance/:id", async (req, res, next) => {
  try {
    const input = updateAttendanceSchema.parse(req.body);
    const record = await studentService.updateAttendance(req.tenantId!, req.params.id, input);
    await recordAudit(req, "update", "student_attendance", record.id, input);
    res.json(record);
  } catch (err) {
    next(err);
  }
});

router.delete("/attendance/:id", async (req, res, next) => {
  try {
    await studentService.deleteAttendance(req.tenantId!, req.params.id);
    await recordAudit(req, "delete", "student_attendance", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// GRADES
// ============================================================

const createGradeSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  assignmentName: z.string().max(255).optional(),
  score: z.coerce.number().min(0),
  maxScore: z.coerce.number().min(0),
  weight: z.coerce.number().int().min(1).max(1000).optional(),
  submittedDate: optionalDate(),
  comments: z.string().optional(),
});
const updateGradeSchema = createGradeSchema.partial();

const gradesSummaryQuerySchema = z.object({ studentId: z.string().uuid() });

router.get("/grades/summary", async (req, res, next) => {
  try {
    const { studentId } = gradesSummaryQuerySchema.parse(req.query);
    res.json(await studentService.getGradesSummary(req.tenantId!, studentId));
  } catch (err) {
    next(err);
  }
});

router.get("/grades", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await studentService.listGrades(req.tenantId!, query));
  } catch (err) {
    next(err);
  }
});

router.get("/grades/export", async (req, res, next) => {
  try {
    const { search } = exportQuerySchema.parse(req.query);
    const rows = await studentService.listGradesForExport(req.tenantId!, search);
    sendCsv(res, "grades.csv", rows);
  } catch (err) {
    next(err);
  }
});

router.post("/grades", async (req, res, next) => {
  try {
    const input = createGradeSchema.parse(req.body);
    const grade = await studentService.createGrade(req.tenantId!, input);
    await recordAudit(req, "create", "student_grades", grade.id, input);
    res.status(201).json(grade);
  } catch (err) {
    next(err);
  }
});

router.patch("/grades/:id", async (req, res, next) => {
  try {
    const input = updateGradeSchema.parse(req.body);
    const grade = await studentService.updateGrade(req.tenantId!, req.params.id, input);
    await recordAudit(req, "update", "student_grades", grade.id, input);
    res.json(grade);
  } catch (err) {
    next(err);
  }
});

router.delete("/grades/:id", async (req, res, next) => {
  try {
    await studentService.deleteGrade(req.tenantId!, req.params.id);
    await recordAudit(req, "delete", "student_grades", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// TUITION RECORDS (mounted at /tuition)
// ============================================================

const createTuitionSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  amountDue: z.coerce.number().min(0),
  amountPaid: z.coerce.number().min(0).optional(),
  dueDate: z.coerce.date(),
  paidDate: optionalDate(),
  paymentMethod: z.string().max(100).optional(),
  notes: z.string().optional(),
});
const updateTuitionSchema = createTuitionSchema.partial();

router.get("/tuition", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await studentService.listTuitionRecords(req.tenantId!, query));
  } catch (err) {
    next(err);
  }
});

router.get("/tuition/export", async (req, res, next) => {
  try {
    const { search } = exportQuerySchema.parse(req.query);
    const rows = await studentService.listTuitionRecordsForExport(req.tenantId!, search);
    sendCsv(res, "tuition-records.csv", rows);
  } catch (err) {
    next(err);
  }
});

router.post("/tuition", async (req, res, next) => {
  try {
    const input = createTuitionSchema.parse(req.body);
    const record = await studentService.createTuitionRecord(req.tenantId!, input);
    await recordAudit(req, "create", "student_tuition_records", record.id, input);
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

router.patch("/tuition/:id", async (req, res, next) => {
  try {
    const input = updateTuitionSchema.parse(req.body);
    const record = await studentService.updateTuitionRecord(req.tenantId!, req.params.id, input);
    await recordAudit(req, "update", "student_tuition_records", record.id, input);
    res.json(record);
  } catch (err) {
    next(err);
  }
});

router.delete("/tuition/:id", async (req, res, next) => {
  try {
    await studentService.deleteTuitionRecord(req.tenantId!, req.params.id);
    await recordAudit(req, "delete", "student_tuition_records", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// ANNOUNCEMENTS
// ============================================================

const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  audienceType: announcementAudienceEnum,
  targetClassId: optionalUuid(),
});
const updateAnnouncementSchema = createAnnouncementSchema.partial();

router.get("/announcements", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await studentService.listAnnouncements(req.tenantId!, query));
  } catch (err) {
    next(err);
  }
});

router.get("/announcements/export", async (req, res, next) => {
  try {
    const { search } = exportQuerySchema.parse(req.query);
    const rows = await studentService.listAnnouncementsForExport(req.tenantId!, search);
    sendCsv(res, "announcements.csv", rows);
  } catch (err) {
    next(err);
  }
});

router.post("/announcements", async (req, res, next) => {
  try {
    const input = createAnnouncementSchema.parse(req.body);
    const announcement = await studentService.createAnnouncement(req.tenantId!, req.auth!.userId, input);
    await recordAudit(req, "create", "student_announcements", announcement.id, input);
    res.status(201).json(announcement);
  } catch (err) {
    next(err);
  }
});

router.patch("/announcements/:id", async (req, res, next) => {
  try {
    const input = updateAnnouncementSchema.parse(req.body);
    const announcement = await studentService.updateAnnouncement(req.tenantId!, req.params.id, input);
    await recordAudit(req, "update", "student_announcements", announcement.id, input);
    res.json(announcement);
  } catch (err) {
    next(err);
  }
});

router.delete("/announcements/:id", async (req, res, next) => {
  try {
    await studentService.deleteAnnouncement(req.tenantId!, req.params.id);
    await recordAudit(req, "delete", "student_announcements", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// DASHBOARD
// ============================================================

router.get("/dashboard", async (req, res, next) => {
  try {
    res.json(await studentService.getDashboard(req.tenantId!));
  } catch (err) {
    next(err);
  }
});

export default router;
