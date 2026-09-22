import { z } from 'zod';

const pagination = {
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
};

export const loginSchema = z.object({
  body: z.object({
    username: z.string().min(1),
    password: z.string().min(1),
  }),
});

export const verifyPinSchema = z.object({
  body: z.object({
    pin: z.string().min(1),
    type: z.enum(['supervisor', 'floor', 'admin']).optional(),
  }),
});

export const createFloorAdminSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    username: z.string().min(3),
    password: z.string().min(6),
    phone: z.string().min(7),
    email: z.string().email().optional().or(z.literal('')),
    monthlySalary: z.coerce.number().min(0),
    salaryStartDate: z.string().min(1),
  }),
});

export const updateFloorAdminSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    name: z.string().min(1).optional(),
    password: z.string().min(6).optional().or(z.literal('')),
    phone: z.string().min(7).optional(),
    email: z.string().email().optional().or(z.literal('')),
    monthlySalary: z.coerce.number().min(0).optional().nullable(),
    salaryStartDate: z.string().min(1).optional(),
    isActive: z.coerce.boolean().optional(),
  }),
});

export const setUserActiveSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    isActive: z.coerce.boolean(),
  }),
});

export const orderListSchema = z.object({
  query: z.object({
    ...pagination,
    search: z.string().optional(),
    sector: z.string().optional(),
    stage: z.string().optional(),
    sort: z.string().optional(),
  }),
});

const orderItemInput = z.object({
  id: z.string().optional(),
  uniformItemId: z.string().min(1),
  uniformItemName: z.string().min(1),
  size: z.string().optional(),
  quantity: z.coerce.number().int().min(1),
  rate: z.coerce.number().min(0),
});

export const createOrderSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    sectorId: z.string().min(1),
    sectorName: z.string().min(1),
    contactPerson: z.string().min(1),
    contactNumber: z.string().min(1),
    deliveryAddress: z.string().min(1),
    specialRequirement: z.string().optional(),
    deliveryDueDate: z.string().optional(),
    items: z.array(orderItemInput).min(1),
  }),
});

export const updateOrderSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    name: z.string().optional(),
    contactPerson: z.string().optional(),
    contactNumber: z.string().optional(),
    deliveryAddress: z.string().optional(),
    specialRequirement: z.string().optional(),
    deliveryDueDate: z.string().nullable().optional(),
    items: z.array(orderItemInput).optional(),
  }),
});

export const updateStageSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    newStage: z.string().min(1),
    reason: z.string().optional(),
    isRevert: z.coerce.boolean().optional(),
    actorName: z.string().optional(),
    pin: z.string().optional(),
    supervisorPin: z.string().optional(),
  }),
});

export const mfgListSchema = z.object({
  query: z.object({
    orderId: z.string().optional(),
    stage: z.string().optional(),
    search: z.string().optional(),
    activeTab: z.enum(['active', 'dispatched']).optional(),
  }),
});

export const createMfgSchema = z.object({
  body: z.object({
    orderId: z.string().min(1),
    itemId: z.string().optional(),
    itemName: z.string().min(1),
    size: z.string().optional(),
    quantity: z.coerce.number().int().min(1),
    notes: z.string().optional(),
  }),
});

export const mfgStageSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    delta: z.coerce.number().int().optional(),
    newStage: z.string().optional(),
    reason: z.string().optional(),
    pin: z.string().optional(),
  }),
});

export const measurementListSchema = z.object({
  query: z.object({
    ...pagination,
    orderId: z.string().optional(),
    garmentItemId: z.string().optional(),
    status: z.string().optional(),
    search: z.string().optional(),
    tab: z.enum(['active', 'delivered']).optional(),
  }),
});

export const createMeasurementSchema = z.object({
  body: z.object({
    orderId: z.string().min(1).optional(),
    orderName: z.string().optional(),
    personName: z.string().min(1),
    personCode: z.string().optional(),
    garmentItemId: z.string().min(1),
    garmentItemName: z.string().min(1),
    size: z.string().optional(),
    measurements: z.record(z.coerce.number()).optional(),
    notes: z.string().optional(),
    workerName: z.string().optional(),
    workerNames: z.array(z.string()).optional(),
    dueDate: z.string().optional(),
    urgency: z.enum(['Normal', 'Urgent', 'Express']).optional(),
  }),
});

export const updateMeasurementSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    personName: z.string().optional(),
    personCode: z.string().optional(),
    garmentItemId: z.string().optional(),
    garmentItemName: z.string().optional(),
    size: z.string().optional(),
    measurements: z.record(z.coerce.number()).optional(),
    notes: z.string().optional(),
    workerName: z.string().optional(),
    workerNames: z.array(z.string()).optional(),
    status: z.enum(['Open', 'In Tailoring', 'Finished', 'Delivered']).optional(),
    dueDate: z.string().optional(),
    urgency: z.enum(['Normal', 'Urgent', 'Express']).optional(),
  }),
});

export const batchAssignSchema = z.object({
  body: z.object({
    measurementIds: z.array(z.string()).min(1),
    workerNames: z.array(z.string()).min(1),
  }),
});

export const measurementStatusSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    status: z.enum(['Open', 'In Tailoring', 'Finished', 'Delivered']),
  }),
});

export const taskListSchema = z.object({
  query: z.object({
    stage: z.string().optional(),
    status: z.string().optional(),
    workerId: z.string().optional(),
    orderId: z.string().optional(),
    search: z.string().optional(),
    activeTab: z.enum(['active', 'completed']).optional(),
  }),
});

export const createTaskSchema = z.object({
  body: z.object({
    workerId: z.string().min(1),
    workerName: z.string().min(1),
    workerPhone: z.string().optional(),
    orderId: z.string().min(1),
    orderName: z.string().min(1),
    orderNumber: z.string().min(1),
    itemId: z.string().optional(),
    itemName: z.string().min(1),
    size: z.string().optional(),
    stage: z.enum(['Cutting', 'Stitching', 'Finishing', 'QC', 'Packing']),
    assignedPieces: z.coerce.number().int().min(1),
    targetDate: z.string().optional(),
    shift: z.enum(['Morning Shift', 'Evening Shift', 'General Shift']).optional(),
    notes: z.string().optional(),
  }),
});

export const updateTaskSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    workerId: z.string().optional(),
    workerName: z.string().optional(),
    workerPhone: z.string().optional(),
    stage: z.enum(['Cutting', 'Stitching', 'Finishing', 'QC', 'Packing']).optional(),
    assignedPieces: z.coerce.number().int().min(1).optional(),
    targetDate: z.string().optional(),
    shift: z.enum(['Morning Shift', 'Evening Shift', 'General Shift']).optional(),
    notes: z.string().optional(),
  }),
});

export const taskProgressSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    completedDelta: z.coerce.number().optional(),
    newCompletedPieces: z.coerce.number().min(0).optional(),
    status: z.enum(['Pending', 'Assigned', 'In Progress', 'Completed', 'On Hold']).optional(),
  }),
});

export const workerListSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    isActive: z.string().optional(),
  }),
});

const workerActivitySchema = z.object({
  activity: z.enum(['Cutting', 'Stitching', 'Finishing', 'QC', 'Packing']),
  ratePerPiece: z.coerce.number().min(0).optional(),
});

export const createWorkerSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    phone: z.string().min(1),
    payType: z.enum(['Salaried', 'Per Piece']).default('Per Piece'),
    monthlySalary: z.coerce.number().min(0).optional().nullable(),
    salaryStartDate: z.string().optional().nullable(),
    activities: z.array(workerActivitySchema).optional(),
  }),
});

export const updateWorkerSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    payType: z.enum(['Salaried', 'Per Piece']).optional(),
    monthlySalary: z.coerce.number().min(0).optional().nullable(),
    salaryStartDate: z.string().optional().nullable(),
    activities: z.array(workerActivitySchema).optional(),
    isActive: z.coerce.boolean().optional(),
    supervisorPin: z.string().optional(),
    pin: z.string().optional(),
  }),
});

export const createSectorSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    isActive: z.coerce.boolean().optional(),
  }),
});

export const updateSectorSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    isActive: z.coerce.boolean().optional(),
  }),
});

export const clientListSchema = z.object({
  query: z.object({
    sectorName: z.string().optional(),
    search: z.string().optional(),
  }),
});

export const createClientSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    sectorName: z.string().min(1),
    contactPerson: z.string().min(1),
    contactNumber: z.string().min(1),
    deliveryAddress: z.string().min(1),
    specialRequirement: z.string().optional(),
    designUrl: z.string().optional(),
    defaultGarmentItemIds: z.array(z.string()).optional(),
  }),
});

export const measurementFieldSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  hindiName: z.string().optional(),
  unit: z.string().optional(),
  defaultValue: z.coerce.number().optional(),
});

export const createItemSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    measurementFields: z.array(measurementFieldSchema).optional(),
    isActive: z.coerce.boolean().optional(),
    supervisorPin: z.string().optional(),
  }),
});

export const updateItemSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    name: z.string().min(1).optional(),
    measurementFields: z.array(measurementFieldSchema).optional(),
    isActive: z.coerce.boolean().optional(),
    supervisorPin: z.string().optional(),
  }),
});

export const auditListSchema = z.object({
  query: z.object({
    ...pagination,
    search: z.string().optional(),
    severity: z.string().optional(),
    actionType: z.string().optional(),
    actorRole: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});

export const createAuditSchema = z.object({
  body: z.object({
    actionType: z.string().min(1),
    entityType: z.string().min(1),
    entityId: z.string().min(1),
    description: z.string().min(1),
    details: z.record(z.unknown()).optional(),
    severity: z.enum(['INFO', 'SUCCESS', 'WARNING', 'CRITICAL']).optional(),
  }),
});

export const updateSettingsSchema = z.object({
  body: z.object({
    supervisorPin: z.string().optional(),
    adminPassword: z.string().optional(),
    currentPassword: z.string().optional(),
    masterPin: z.string().optional(),
    floorPin: z.string().optional(),
    requireAuthForDelete: z.coerce.boolean().optional(),
    requireAuthForEdit: z.coerce.boolean().optional(),
    companyName: z.string().optional(),
    companyPhone: z.string().optional(),
    companyAddress: z.string().optional(),
    gstNumber: z.string().optional(),
    printFooterNote: z.string().optional(),
  }),
});

export const ledgerListSchema = z.object({
  query: z.object({
    ...pagination,
    workerId: z.string().optional(),
    transactionType: z.string().optional(),
    entryType: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    search: z.string().optional(),
  }),
});

export const createLedgerSchema = z.object({
  body: z.object({
    workerId: z.string().min(1),
    transactionType: z.enum([
      'Advance Payment',
      'Piece-Rate Earning',
      'Wage Payout',
      'Bonus',
      'Deduction',
      'Monthly Salary',
    ]),
    amount: z.coerce.number().positive(),
    pieces: z.coerce.number().optional(),
    ratePerPiece: z.coerce.number().optional(),
    garmentItemName: z.string().optional(),
    orderNumber: z.string().optional(),
    paymentMode: z.enum(['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'N/A', 'Other']).optional(),
    referenceNumber: z.string().optional(),
    date: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export const deleteLedgerSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    pin: z.string().optional(),
    supervisorPin: z.string().optional(),
  }).optional(),
});

