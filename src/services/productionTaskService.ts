import { Request } from 'express';
import { FilterQuery } from 'mongoose';
import { WorkerTask, WorkerTaskDoc } from '../models/WorkerTask';
import { Worker } from '../models/Worker';
import { Order } from '../models/Order';
import { ApiError } from '../utils/ApiError';
import { serializeDoc } from '../utils/serialize';
import { searchRegex, cleanText } from '../utils/helpers';
import { nextTaskNumber } from '../utils/idGenerator';
import { writeAudit } from '../utils/audit';
import { findByPublicId, findByPublicIdOrThrow } from './lookup';
import { getSettingsDoc, maybeRequirePin } from '../utils/pin';
import { recordPieceRateFromTaskProgress } from './ledgerService';

export async function listTasks(query: Record<string, unknown>) {
  const filter: FilterQuery<WorkerTaskDoc> = {};
  if (query.stage) filter.stage = String(query.stage);
  if (query.status) filter.status = String(query.status);
  if (query.workerId) filter.workerId = String(query.workerId);
  if (query.orderId) filter.orderId = String(query.orderId);
  if (query.activeTab === 'completed') filter.status = 'Completed';
  if (query.activeTab === 'active') filter.status = { $ne: 'Completed' };
  if (query.search && String(query.search).trim()) {
    const rx = searchRegex(String(query.search));
    filter.$or = [{ taskNumber: rx }, { workerName: rx }, { orderName: rx }, { itemName: rx }, { orderNumber: rx }];
  }
  const rows = await WorkerTask.find(filter).sort({ assignedDate: -1 });
  return rows.map((r) => serializeDoc(r));
}

export async function getTask(id: string) {
  const task = await findByPublicIdOrThrow(WorkerTask, id, 'Production task', ['taskNumber']);
  return serializeDoc(task);
}

export async function createTask(body: Record<string, unknown>, req: Request) {
  const worker = await findByPublicId(Worker, String(body.workerId));
  const order = await findByPublicId(Order, String(body.orderId), ['orderNumber']);
  const ids = await nextTaskNumber();

  const task = await WorkerTask.create({
    customId: ids.customId,
    taskNumber: ids.taskNumber,
    workerId: worker?.customId || String(body.workerId),
    workerName: (body.workerName as string) || worker?.name,
    workerPhone: (body.workerPhone as string) || worker?.phone,
    orderId: order?.customId || String(body.orderId),
    orderName: (body.orderName as string) || order?.name,
    orderNumber: (body.orderNumber as string) || order?.orderNumber,
    itemId: body.itemId,
    itemName: body.itemName,
    size: body.size,
    stage: body.stage,
    assignedPieces: body.assignedPieces,
    completedPieces: 0,
    assignedDate: new Date(),
    targetDate: body.targetDate ? new Date(String(body.targetDate)) : undefined,
    shift: body.shift || 'General Shift',
    status: 'Assigned',
    notes: cleanText(body.notes as string),
  });

  await writeAudit({
    req,
    actionType: 'TASK_ASSIGNED',
    entityType: 'Task',
    entityId: task.taskNumber,
    description: `Assigned ${task.assignedPieces} ${task.itemName} ${task.stage} pieces to ${task.workerName} (${task.workerId})`,
    details: { workerId: task.workerId, quantity: task.assignedPieces, stage: task.stage },
    severity: 'INFO',
  });

  return serializeDoc(task);
}

export async function updateTask(id: string, body: Record<string, unknown>, req: Request) {
  const task = await findByPublicIdOrThrow(WorkerTask, id, 'Production task', ['taskNumber']);
  const before = {
    workerId: task.workerId,
    workerName: task.workerName,
    stage: task.stage,
    assignedPieces: task.assignedPieces,
    shift: task.shift,
    targetDate: task.targetDate,
    notes: task.notes,
  };

  if (body.workerId) {
    const worker = await findByPublicId(Worker, String(body.workerId));
    task.workerId = worker?.customId || String(body.workerId);
    if (worker) {
      task.workerName = worker.name;
      task.workerPhone = worker.phone;
    }
  }
  if (body.workerName) task.workerName = String(body.workerName);
  if (body.workerPhone) task.workerPhone = String(body.workerPhone);
  if (body.stage) task.stage = String(body.stage);
  if (body.assignedPieces) {
    task.assignedPieces = Number(body.assignedPieces);
    if (task.completedPieces > task.assignedPieces) task.completedPieces = task.assignedPieces;
  }
  if (body.targetDate !== undefined) task.targetDate = body.targetDate ? new Date(String(body.targetDate)) : undefined;
  if (body.shift) task.shift = String(body.shift);
  if (body.notes !== undefined) task.notes = cleanText(body.notes as string);
  await task.save();

  await writeAudit({
    req,
    actionType: 'TASK_UPDATED',
    entityType: 'Task',
    entityId: task.taskNumber,
    description: `Updated floor task ${task.taskNumber} (${task.itemName} · ${task.stage} · ${task.workerName})`,
    details: {
      before,
      after: {
        workerId: task.workerId,
        workerName: task.workerName,
        stage: task.stage,
        assignedPieces: task.assignedPieces,
        shift: task.shift,
        targetDate: task.targetDate,
        notes: task.notes,
      },
    },
    severity: 'INFO',
  });

  return serializeDoc(task);
}

export async function updateTaskProgress(id: string, body: Record<string, unknown>, req: Request) {
  const task = await findByPublicIdOrThrow(WorkerTask, id, 'Production task', ['taskNumber']);
  const previousCompleted = task.completedPieces;
  const previousStatus = task.status;

  if (body.newCompletedPieces !== undefined) {
    task.completedPieces = Number(body.newCompletedPieces);
  } else if (body.completedDelta !== undefined) {
    task.completedPieces = Math.max(0, task.completedPieces + Number(body.completedDelta));
  }

  if (task.completedPieces > task.assignedPieces) {
    throw ApiError.badRequest('Completed pieces cannot exceed assigned pieces');
  }

  if (body.status) {
    task.status = body.status as WorkerTaskDoc['status'];
  } else if (task.completedPieces >= task.assignedPieces) {
    task.status = 'Completed';
  } else if (task.completedPieces > 0 && task.status === 'Assigned') {
    task.status = 'In Progress';
  } else if (task.completedPieces > 0) {
    task.status = 'In Progress';
  }

  await task.save();

  // Ledger credit only when the floor task is fully done (first time it becomes Completed)
  const becameComplete = previousStatus !== 'Completed' && task.status === 'Completed';
  if (becameComplete && task.completedPieces > 0) {
    await recordPieceRateFromTaskProgress({
      workerId: task.workerId,
      stage: task.stage,
      piecesDelta: task.completedPieces,
      garmentItemName: task.itemName,
      orderNumber: task.orderNumber,
      taskNumber: task.taskNumber,
      req,
    });
  }

  await writeAudit({
    req,
    actionType: 'TASK_PROGRESS_LOGGED',
    entityType: 'Task',
    entityId: task.taskNumber,
    description: `Task ${task.taskNumber}: ${task.workerName} progress ${previousCompleted} → ${task.completedPieces}/${task.assignedPieces} (${task.status})`,
    details: {
      taskId: task.taskNumber,
      completed: task.completedPieces,
      status: task.status,
      becameComplete,
    },
    severity: task.status === 'Completed' ? 'SUCCESS' : 'INFO',
  });

  return serializeDoc(task);
}

export async function deleteTask(id: string, pin: string | undefined, req: Request) {
  const settings = await getSettingsDoc();
  await maybeRequirePin(pin, settings.requireAuthForDelete !== false, req);
  const task = await findByPublicIdOrThrow(WorkerTask, id, 'Production task', ['taskNumber']);
  await task.deleteOne();
  await writeAudit({
    req,
    actionType: 'TASK_DELETED',
    entityType: 'Task',
    entityId: task.taskNumber,
    description: `Deleted floor task ${task.taskNumber} (${task.itemName} · ${task.stage} · ${task.workerName})`,
    details: {
      workerId: task.workerId,
      assignedPieces: task.assignedPieces,
      completedPieces: task.completedPieces,
      status: task.status,
    },
    severity: 'CRITICAL',
  });
}
