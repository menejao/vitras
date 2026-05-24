import { z } from "zod";

const shortString = (max) => z.string().trim().max(max);
const optionalShortString = (max) => shortString(max).optional();
const optionalDateString = () => z.string().trim().max(50).optional();
const optionalNumberLike = () => z.union([z.string(), z.number()]).optional();

const LoginSchema = z.object({
  email: z.string().min(1).max(255),
  password: z.string().min(1).max(1024)
});

const RegisterSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().min(1).max(255),
  password: z.string().min(1).max(1024),
  role: z.string().min(1).max(50),
  teamId: z.string().max(100).optional(),
  councilNumber: z.string().max(30).optional(),
  councilUf: z.string().max(2).optional()
});

const PatientBaseShape = {
  name: z.string().trim().min(1).max(300),
  motherName: optionalShortString(300),
  guardianName: optionalShortString(300),
  phone: z.string().trim().min(1).max(30),
  phoneAlt: optionalShortString(30),
  cpf: optionalShortString(20),
  cns: optionalShortString(30),
  cnsCpf: optionalShortString(30),
  address: optionalShortString(500),
  microArea: optionalShortString(100),
  assignedAcsId: optionalShortString(100),
  teamId: optionalShortString(100),
  careCategory: optionalShortString(100),
  chronicConditions: z.array(z.string().trim().max(100)).max(20).optional(),
  maritalStatus: optionalShortString(50),
  incompleteProfile: z.boolean().optional(),
  inactive: z.boolean().optional(),
  inactivationReason: optionalShortString(1000),
  inactivatedBy: optionalShortString(200),
  inactivatedAt: optionalDateString(),
  sexAtBirth: optionalShortString(50),
  genderIdentity: optionalShortString(80),
  birthDate: optionalDateString(),
  pregnancyStartDate: optionalDateString(),
  expectedDeliveryDate: optionalDateString(),
  gestationalAgeDumWeeks: optionalNumberLike(),
  gestationalAgeDumDays: optionalNumberLike(),
  gestationalAgeUsgWeeks: optionalNumberLike(),
  gestationalAgeUsgDays: optionalNumberLike(),
  usgDate1: optionalDateString(),
  usgDate2: optionalDateString(),
  usgDate3: optionalDateString(),
  prenatalStartDate: optionalDateString(),
  postpartumStartDate: optionalDateString(),
  comorbidities: optionalShortString(4000),
  medications: optionalShortString(4000),
  allergies: optionalShortString(4000)
};

const PatientCreateSchema = z.object(PatientBaseShape);
const PatientUpdateSchema = z.object({
  motherName: optionalShortString(300),
  phone: optionalShortString(30),
  phoneAlt: optionalShortString(30),
  cpf: optionalShortString(20),
  cns: optionalShortString(30),
  cnsCpf: optionalShortString(30),
  address: optionalShortString(500),
  microArea: optionalShortString(100),
  assignedAcsId: optionalShortString(100),
  careCategory: optionalShortString(100),
  chronicConditions: z.array(z.string().trim().max(100)).max(20).optional(),
  maritalStatus: optionalShortString(50),
  incompleteProfile: z.boolean().optional(),
  inactive: z.boolean().optional(),
  inactivationReason: optionalShortString(1000),
  inactivatedBy: optionalShortString(200),
  inactivatedAt: optionalDateString(),
  sexAtBirth: optionalShortString(50),
  genderIdentity: optionalShortString(80),
  birthDate: optionalDateString(),
  pregnancyStartDate: optionalDateString(),
  expectedDeliveryDate: optionalDateString(),
  gestationalAgeDumWeeks: optionalNumberLike(),
  gestationalAgeDumDays: optionalNumberLike(),
  gestationalAgeUsgWeeks: optionalNumberLike(),
  gestationalAgeUsgDays: optionalNumberLike(),
  usgDate1: optionalDateString(),
  usgDate2: optionalDateString(),
  usgDate3: optionalDateString(),
  prenatalStartDate: optionalDateString(),
  postpartumStartDate: optionalDateString(),
  comorbidities: optionalShortString(4000),
  medications: optionalShortString(4000),
  allergies: optionalShortString(4000)
});

const TaskCreateSchema = z.object({
  patientId: z.string().trim().min(1).max(100),
  assigneeId: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(500),
  notes: optionalShortString(4000),
  status: z.enum(["pending", "in_progress", "done"]).optional(),
  dueDate: optionalDateString()
});

const TaskPatchSchema = z.object({
  status: z.enum(["pending", "in_progress", "done"]).optional(),
  notes: optionalShortString(4000)
});

const AppointmentCreateSchema = z.object({
  date: z.string().trim().min(1).max(50),
  summary: z.string().trim().min(1).max(10000),
  demandType: optionalShortString(40),
  conduct: optionalShortString(4000),
  nextStep: optionalShortString(4000)
});

const AgendaCreateSchema = z.object({
  patientId: z.string().trim().min(1).max(100),
  date: z.string().trim().min(1).max(50),
  time: z.string().trim().min(1).max(20),
  doctorId: optionalShortString(100),
  type: z.enum(["consultation", "return", "procedure", "other"]).optional(),
  notes: optionalShortString(4000),
  status: z.enum(["scheduled", "arrived", "attending", "done", "absent"]).optional()
});

const AgendaPatchSchema = z.object({
  date: z.string().trim().min(1).max(50).optional(),
  time: z.string().trim().min(1).max(20).optional(),
  doctorId: optionalShortString(100),
  type: z.enum(["consultation", "return", "procedure", "other"]).optional(),
  notes: optionalShortString(4000),
  status: z.enum(["scheduled", "arrived", "attending", "done", "absent"]).optional()
});

const ReferralCreateSchema = z.object({
  patientId: z.string().trim().min(1).max(100),
  specialty: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(1).max(4000),
  priority: z.enum(["urgent", "priority", "routine"]).optional(),
  date: z.string().trim().min(1).max(50),
  notes: optionalShortString(4000),
  status: z.enum(["pending", "regulated", "scheduled", "done", "cancelled"]).optional()
});

const ReferralPatchSchema = z.object({
  specialty: z.string().trim().min(1).max(120).optional(),
  reason: z.string().trim().min(1).max(4000).optional(),
  priority: z.enum(["urgent", "priority", "routine"]).optional(),
  date: z.string().trim().min(1).max(50).optional(),
  notes: optionalShortString(4000),
  status: z.enum(["pending", "regulated", "scheduled", "done", "cancelled"]).optional()
});

const PharmacyStockCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(120),
  unit: z.string().trim().min(1).max(60),
  qty: z.number().min(0).max(100000),
  minQty: z.number().min(0).max(100000),
  location: z.string().trim().min(1).max(200)
});

const PharmacyStockUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().min(1).max(120).optional(),
  unit: z.string().trim().min(1).max(60).optional(),
  qty: z.number().min(0).max(100000).optional(),
  minQty: z.number().min(0).max(100000).optional(),
  location: z.string().trim().min(1).max(200).optional()
});

const PharmacyAdjustSchema = z.object({
  delta: z.number().int().min(-100000).max(100000),
  reason: z.string().trim().min(3).max(1000)
});

const PharmacyDispenseSchema = z.object({
  itemId: z.string().trim().min(1).max(100),
  qty: z.number().int().min(1).max(100000),
  patientId: z.string().trim().min(1).max(100),
  prescriberId: z.string().trim().min(1).max(100),
  numReceita: z.string().trim().min(1).max(120),
  lote: optionalShortString(120),
  dtReceita: z.string().trim().min(1).max(50),
  notes: optionalShortString(2000)
});

const SuppliesAdjustSchema = z.object({
  qty: z.number().int().min(1).max(100000)
});

const SuppliesDispenseSchema = z.object({
  patientId: z.string().trim().min(1).max(100),
  items: z.array(z.object({
    id: z.string().trim().min(1).max(100),
    qty: z.number().int().min(1).max(100000)
  })).min(1).max(60),
  continuo: z.boolean().optional(),
  obs: optionalShortString(2000)
});

const SuppliesCloseContinuousSchema = z.object({
  reason: z.string().trim().min(8).max(1000)
});

const CriticalActionReasonSchema = z.object({
  reason: z.string().trim().min(8).max(1000)
});

const ExamCreateSchema = z.object({
  title: z.string().trim().min(1).max(300),
  date: z.string().trim().min(1).max(50),
  notes: optionalShortString(20000),
  source: z.enum(["posto", "externo"]).optional()
});

const ExamAttachmentCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(120),
  size: z.number().int().min(1).max(15 * 1024 * 1024),
  dataBase64: z.string().trim().min(1).max(25 * 1024 * 1024)
});

const RecordCreateSchema = z.object({
  type: z.enum(["visit", "consultation", "vaccine", "procedure", "note", "prescription", "exam_request", "referral", "nursing", "evolution", "attendance_attest", "medical_attest"]),
  date: z.string().trim().min(1).max(50),
  title: z.string().trim().min(1).max(500),
  details: optionalShortString(20000),
  protocolTag: optionalShortString(100),
  metadata: z.record(z.any()).optional()
});

const QueueCreateSchema = z.object({
  patientId: z.string().trim().min(1).max(100),
  priority: z.enum(["urgent", "elderly", "pregnant", "child", "normal"]),
  reason: optionalShortString(1000),
  demandType: z.enum(["scheduled", "spontaneous"]).optional(),
  destination: z.enum(["doctor", "nurse"]).optional(),
  agendaRef: optionalShortString(100)
});

const QueuePatchSchema = z.object({
  status: z.enum(["waiting", "triage", "ready", "attending", "done"]).optional(),
  priority: z.enum(["urgent", "elderly", "pregnant", "child", "normal"]).optional(),
  reason: optionalShortString(1000),
  demandType: z.enum(["scheduled", "spontaneous"]).optional(),
  destination: z.enum(["doctor", "nurse"]).optional(),
  triageStart: optionalDateString(),
  triageDone: optionalDateString(),
  vitals: z.record(z.any()).optional()
});

const PrivacyRequestCreateSchema = z.object({
  patientId: z.string().min(1).max(100),
  type: z.enum(["access", "correction", "deletion"])
});

const MePatchSchema = z.object({
  name: optionalShortString(200),
  email: optionalShortString(255),
  password: z.string().max(1024).optional(),
  currentPassword: z.string().max(1024).optional(),
  councilNumber: optionalShortString(30),
  councilUf: optionalShortString(2)
});

const ImpersonationStartSchema = z.object({
  targetUserId: z.string().trim().min(1).max(100),
  reason: z.string().trim().min(8).max(500)
});

const BreakGlassSchema = z.object({
  reason: z.string().trim().min(8).max(500)
});

const AccessRequestCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().min(1).max(255),
  jobTitle: z.string().trim().min(1).max(100)
});

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body || {});
    if (!result.success) {
      return res.status(400).json({
        error: "Dados inválidos",
        details: result.error.issues.map((i) => {
          const path = i.path.length ? i.path.join(".") : "body";
          return `${path}: ${i.message}`;
        })
      });
    }
    req.body = result.data;
    next();
  };
}

export {
  LoginSchema,
  RegisterSchema,
  PatientCreateSchema,
  PatientUpdateSchema,
  TaskCreateSchema,
  TaskPatchSchema,
  AppointmentCreateSchema,
  AgendaCreateSchema,
  AgendaPatchSchema,
  ReferralCreateSchema,
  ReferralPatchSchema,
  PharmacyStockCreateSchema,
  PharmacyStockUpdateSchema,
  PharmacyAdjustSchema,
  PharmacyDispenseSchema,
  SuppliesAdjustSchema,
  SuppliesDispenseSchema,
  SuppliesCloseContinuousSchema,
  CriticalActionReasonSchema,
  ExamCreateSchema,
  ExamAttachmentCreateSchema,
  RecordCreateSchema,
  QueueCreateSchema,
  QueuePatchSchema,
  PrivacyRequestCreateSchema,
  MePatchSchema,
  ImpersonationStartSchema,
  BreakGlassSchema,
  AccessRequestCreateSchema,
  validate
};
