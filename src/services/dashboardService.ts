import { Order } from '../models/Order';
import { Worker } from '../models/Worker';
import { Measurement } from '../models/Measurement';
import { ManufacturingTicket } from '../models/ManufacturingTicket';
import { PRODUCTION_STAGES } from '../constants/stages';
import { serializeDoc } from '../utils/serialize';

export async function dashboardStats() {
  const [orders, workers, measurements, mfgTickets] = await Promise.all([
    Order.find(),
    Worker.find({ isActive: { $ne: false } }),
    Measurement.find(),
    ManufacturingTicket.find(),
  ]);

  const totalOrders = orders.length;
  const activeOrders = orders.filter((o) => o.productionStage !== 'Dispatched').length;
  const totalPieces = orders.reduce((s, o) => s + o.totalPieces, 0);
  const measurementsCollected = measurements.length;
  const measurementsPending = Math.max(0, totalPieces - measurementsCollected);
  const readyToDispatch = orders.filter((o) => o.productionStage === 'Ready to Dispatch').length;
  const dispatched = orders.filter((o) => o.productionStage === 'Dispatched').length;

  const sectorMap: Record<string, { count: number; pieces: number }> = {};
  for (const o of orders) {
    if (!sectorMap[o.sectorName]) sectorMap[o.sectorName] = { count: 0, pieces: 0 };
    sectorMap[o.sectorName].count += 1;
    sectorMap[o.sectorName].pieces += o.totalPieces;
  }
  const sectorDistribution = Object.entries(sectorMap).map(([name, val]) => ({
    name,
    orders: val.count,
    pieces: val.pieces,
  }));

  const productionFunnel = PRODUCTION_STAGES.map((stage) => {
    const matching = orders.filter((o) => o.productionStage === stage);
    return {
      stage,
      count: matching.length,
      pieces: matching.reduce((s, o) => s + o.totalPieces, 0),
    };
  });

  const dueSoon = [...orders]
    .filter((o) => o.productionStage !== 'Dispatched')
    .sort((a, b) => {
      const da = a.deliveryDueDate ? a.deliveryDueDate.getTime() : Infinity;
      const db = b.deliveryDueDate ? b.deliveryDueDate.getTime() : Infinity;
      return da - db;
    })
    .slice(0, 10)
    .map((o) => serializeDoc(o));

  return {
    totalOrders,
    activeOrders,
    totalWorkers: workers.length,
    totalMfgTickets: mfgTickets.length,
    totalPieces,
    measurementsCollected,
    measurementsPending,
    readyToDispatch,
    dispatched,
    productionFunnel,
    sectorDistribution,
    activeOrdersTable: dueSoon,
  };
}
