export const AUDIT_ACTIONS = [
  'ORDER_CREATED',
  'ORDER_UPDATED',
  'STAGE_UPDATED',
  'STAGE_REVERTED',
  'MFG_TICKET_GENERATED',
  'MEASUREMENT_RECORDED',
  'MEASUREMENT_UPDATED',
  'MEASUREMENT_DELETED',
  'TASK_ASSIGNED',
  'TASK_UPDATED',
  'TASK_PROGRESS_LOGGED',
  'TASK_DELETED',
  'SECTOR_MODIFIED',
  'GARMENT_MODIFIED',
  'WORKER_UPDATED',
  'PAYROLL_CALCULATED',
  'AUTH_LOGIN',
  'AUTH_LOGOUT',
  'SECURITY_ALERT',
  'PIN_CHANGED',
  'USER_CREATED',
  'DATA_CLEARED',
] as const;

export type AuditActionType = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_SEVERITIES = ['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'] as const;
export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];

export const AUDIT_ENTITY_TYPES = [
  'Order',
  'Measurement',
  'Manufacturing',
  'Task',
  'MasterData',
  'Auth',
  'Payroll',
  'Security',
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];
