import { Order } from '../models/Order';
import { Measurement } from '../models/Measurement';
import { PRODUCTION_STAGES } from '../constants/stages';
import { isObjectId } from '../utils/helpers';

export interface ClientTrackOrderResult {
  type: 'order';
  data: {
    trackingId: string;
    orderNumber: string;
    clientName: string;
    sectorName: string;
    productionStage: string;
    currentStageIndex: number;
    totalStages: number;
    stages: {
      key: string;
      label: string;
      status: 'completed' | 'current' | 'upcoming';
      timestamp?: Date;
    }[];
    totalPieces: number;
    items: {
      name: string;
      size?: string;
      quantity: number;
    }[];
    deliveryDueDate?: Date;
    orderDate: Date;
    lastUpdated: Date;
    measurementsCount: number;
  };
}

export interface ClientTrackMeasurementResult {
  type: 'measurement';
  data: {
    trackingId: string;
    ticketNumber: string;
    personName: string;
    personCode?: string;
    garmentItemName: string;
    size: string;
    status: string; // 'Open' | 'In Tailoring' | 'Finished' | 'Delivered'
    currentStageIndex: number;
    totalStages: number;
    stages: {
      key: string;
      label: string;
      status: 'completed' | 'current' | 'upcoming';
      timestamp?: Date;
    }[];
    orderName?: string;
    orderNumber?: string;
    orderStage?: string;
    measurements: Record<string, number>;
    notes?: string;
    dueDate?: Date;
    createdAt: Date;
    lastUpdated: Date;
  };
}

export async function lookupTrackingRecord(queryStr: string): Promise<ClientTrackOrderResult | ClientTrackMeasurementResult | null> {
  const query = String(queryStr || '').trim();
  if (!query) return null;

  const escapedRegex = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exactRegex = new RegExp(`^${escapedRegex}$`, 'i');

  // 1. Check Order by orderNumber, customId, or _id
  const orderOrConditions: Record<string, unknown>[] = [
    { orderNumber: exactRegex },
    { customId: exactRegex },
  ];
  if (isObjectId(query)) {
    orderOrConditions.push({ _id: query });
  }

  const order = await Order.findOne({ $or: orderOrConditions });

  if (order) {
    const measurementsCount = await Measurement.countDocuments({ orderId: order.customId });

    // Map stages
    const currentIdx = PRODUCTION_STAGES.indexOf(order.productionStage as any);
    const stages = PRODUCTION_STAGES.map((stg, idx) => {
      let status: 'completed' | 'current' | 'upcoming' = 'upcoming';
      if (currentIdx > -1) {
        if (idx < currentIdx) status = 'completed';
        else if (idx === currentIdx) status = 'current';
      }

      // Find stage history timestamp if available
      const historyItem = order.stageHistory?.find((h) => h.toStage === stg);

      return {
        key: stg,
        label: stg,
        status,
        timestamp: historyItem ? historyItem.timestamp : (idx === 0 ? order.createdAt : undefined),
      };
    });

    return {
      type: 'order',
      data: {
        trackingId: order.orderNumber,
        orderNumber: order.orderNumber,
        clientName: order.name,
        sectorName: order.sectorName,
        productionStage: order.productionStage,
        currentStageIndex: currentIdx >= 0 ? currentIdx + 1 : 1,
        totalStages: PRODUCTION_STAGES.length,
        stages,
        totalPieces: order.totalPieces,
        items: (order.items || []).map((item) => ({
          name: item.uniformItemName,
          size: item.size,
          quantity: item.quantity,
        })),
        deliveryDueDate: order.deliveryDueDate,
        orderDate: order.createdAt,
        lastUpdated: order.updatedAt,
        measurementsCount,
      },
    };
  }

  // 2. Check Measurement by ticketNumber, customId, personCode
  const measurementOrConditions: Record<string, unknown>[] = [
    { ticketNumber: exactRegex },
    { customId: exactRegex },
  ];
  if (isObjectId(query)) {
    measurementOrConditions.push({ _id: query });
  }

  const measurement = await Measurement.findOne({ $or: measurementOrConditions });

  if (measurement) {
    // If orderId exists, get associated order info
    let orderNumber: string | undefined;
    let orderStage: string | undefined;

    if (measurement.orderId) {
      const parentOrder = await Order.findOne({
        $or: [{ customId: measurement.orderId }, { orderNumber: measurement.orderId }],
      });
      if (parentOrder) {
        orderNumber = parentOrder.orderNumber;
        orderStage = parentOrder.productionStage;
      }
    }

    const measurementsObj: Record<string, number> = {};
    if (measurement.measurements) {
      if (measurement.measurements instanceof Map) {
        measurement.measurements.forEach((val, key) => {
          measurementsObj[key] = val;
        });
      } else if (typeof measurement.measurements === 'object') {
        Object.assign(measurementsObj, measurement.measurements);
      }
    }

    // Tailoring Workflow Stages for Individual Measurements
    const tailoringStagesDef = [
      { key: 'Measurement Recorded', label: 'Measurement Recorded' },
      { key: 'Pattern & Cutting', label: 'Pattern & Cutting' },
      { key: 'In Tailoring & Stitching', label: 'In Tailoring & Stitching' },
      { key: 'Finishing & QC', label: 'Finishing & QC' },
      { key: 'Ready for Pickup / Delivered', label: 'Ready for Pickup / Delivered' },
    ];

    let currentStageIndex = 1;
    const mStatus = measurement.status || 'Open';
    if (mStatus === 'Open') {
      currentStageIndex = 1;
    } else if (mStatus === 'In Tailoring') {
      currentStageIndex = 3;
    } else if (mStatus === 'Finished') {
      currentStageIndex = 4;
    } else if (mStatus === 'Delivered') {
      currentStageIndex = 5;
    }

    const stages = tailoringStagesDef.map((s, idx) => {
      let stageStatus: 'completed' | 'current' | 'upcoming' = 'upcoming';
      if (mStatus === 'Delivered') {
        stageStatus = 'completed';
      } else if (idx + 1 < currentStageIndex) {
        stageStatus = 'completed';
      } else if (idx + 1 === currentStageIndex) {
        stageStatus = 'current';
      }

      let timestamp: Date | undefined;
      if (idx === 0) timestamp = measurement.createdAt;
      else if (idx + 1 === currentStageIndex) timestamp = measurement.updatedAt;

      return {
        key: s.key,
        label: s.label,
        status: stageStatus,
        timestamp,
      };
    });

    return {
      type: 'measurement',
      data: {
        trackingId: measurement.ticketNumber,
        ticketNumber: measurement.ticketNumber,
        personName: measurement.personName,
        personCode: measurement.personCode,
        garmentItemName: measurement.garmentItemName,
        size: measurement.size || 'Custom Fit',
        status: measurement.status || 'Open',
        currentStageIndex,
        totalStages: tailoringStagesDef.length,
        stages,
        orderName: measurement.orderName,
        orderNumber,
        orderStage,
        measurements: measurementsObj,
        notes: measurement.notes,
        dueDate: measurement.dueDate,
        createdAt: measurement.createdAt,
        lastUpdated: measurement.updatedAt,
      },
    };
  }

  return null;
}
