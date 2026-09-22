export const PRODUCTION_STAGES = [
  'Order Received',
  'Fabric Required',
  'Fabric Received',
  'Cutting',
  'Stitching',
  'Finishing',
  'QC',
  'Packing',
  'Ready to Dispatch',
  'Dispatched',
] as const;

export type ProductionStage = (typeof PRODUCTION_STAGES)[number];

export const FLOOR_STAGES = ['Cutting', 'Stitching', 'Finishing', 'QC', 'Packing'] as const;
export type FloorStage = (typeof FLOOR_STAGES)[number];

export const WORKER_PAY_TYPES = ['Salaried', 'Per Piece'] as const;
export type WorkerPayType = (typeof WORKER_PAY_TYPES)[number];

export function isFloorStage(stage: string): stage is FloorStage {
  return (FLOOR_STAGES as readonly string[]).includes(stage);
}

export const TAILORING_STATUSES = ['Open', 'In Tailoring', 'Finished', 'Delivered'] as const;
export type TailoringStatus = (typeof TAILORING_STATUSES)[number];

export const TASK_STATUSES = ['Pending', 'Assigned', 'In Progress', 'Completed', 'On Hold'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const URGENCY_LEVELS = ['Normal', 'Urgent', 'Express'] as const;

export const USER_ROLES = ['Super Admin', 'Floor Admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ACTOR_ROLES = ['Super Admin', 'Floor Admin', 'System'] as const;
export type ActorRole = (typeof ACTOR_ROLES)[number];

export function normalizeUserRole(role: string | undefined): UserRole {
  if (role === 'Super Admin') return 'Super Admin';
  return 'Floor Admin';
}

export const SHIFTS = ['Morning Shift', 'Evening Shift', 'General Shift'] as const;

export function stageIndex(stage: string): number {
  return PRODUCTION_STAGES.indexOf(stage as ProductionStage);
}

export function isProductionStage(stage: string): stage is ProductionStage {
  return (PRODUCTION_STAGES as readonly string[]).includes(stage);
}
