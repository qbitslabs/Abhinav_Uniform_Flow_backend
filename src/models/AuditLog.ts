import { Schema, model, Document } from 'mongoose';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_SEVERITIES,
  AuditActionType,
  AuditEntityType,
  AuditSeverity,
} from '../constants/auditActions';

export interface AuditLogDoc extends Document {
  customId: string;
  timestamp: Date;
  actorId: string;
  actorName: string;
  actorRole: 'Super Admin' | 'Floor Admin' | 'System';
  actionType: AuditActionType;
  entityType: AuditEntityType;
  entityId: string;
  description: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  severity: AuditSeverity;
  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLogDoc>(
  {
    customId: { type: String, required: true, unique: true },
    timestamp: { type: Date, default: Date.now, index: true },
    actorId: { type: String, required: true, index: true },
    actorName: { type: String, required: true },
    actorRole: { type: String, enum: ['Super Admin', 'Floor Admin', 'System'], required: true },
    actionType: { type: String, enum: AUDIT_ACTIONS, required: true, index: true },
    entityType: { type: String, enum: AUDIT_ENTITY_TYPES, required: true },
    entityId: { type: String, required: true, index: true },
    description: { type: String, required: true },
    details: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    severity: { type: String, enum: AUDIT_SEVERITIES, default: 'INFO', index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'audit_logs' }
);

auditLogSchema.index({ description: 'text', actorName: 'text', entityId: 'text' });

export const AuditLog = model<AuditLogDoc>('AuditLog', auditLogSchema);
