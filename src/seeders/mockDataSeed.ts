import { Sector, SectorClient } from '../models/Sector';
import { UniformItem } from '../models/UniformItem';
import { Worker } from '../models/Worker';
import { Order } from '../models/Order';
import { Measurement } from '../models/Measurement';
import { ManufacturingTicket } from '../models/ManufacturingTicket';
import { WorkerTask } from '../models/WorkerTask';
import { setSeq } from '../utils/idGenerator';
import { logger } from '../utils/logger';

const year = new Date().getFullYear();

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Upsert a small demo dataset for local / Atlas testing.
 * Safe to re-run: keyed by customId (no duplicates).
 * Does not touch users, PINs, settings, or audit logs.
 */
export async function seedMockData() {
  // ── Sectors ──────────────────────────────────────────────
  const sectors = [
    {
      customId: 'SEC-01',
      name: 'School',
      description: 'Schools and educational institutions',
      isActive: true,
    },
    {
      customId: 'SEC-02',
      name: 'Corporate',
      description: 'Offices and corporate campuses',
      isActive: true,
    },
    {
      customId: 'SEC-03',
      name: 'Hospital',
      description: 'Hospitals and clinics',
      isActive: true,
    },
  ];

  for (const s of sectors) {
    await Sector.findOneAndUpdate({ customId: s.customId }, s, { upsert: true, new: true });
  }
  await setSeq('sector', 3);
  logger.info(`Mock sectors: ${sectors.length}`);

  const school = await Sector.findOne({ customId: 'SEC-01' });
  const corporate = await Sector.findOne({ customId: 'SEC-02' });
  const hospital = await Sector.findOne({ customId: 'SEC-03' });

  // ── Garment items ────────────────────────────────────────
  const items = [
    {
      customId: 'ITEM-001',
      name: 'School Shirt',
      isActive: true,
      measurementFields: [
        { id: 'mf-chest', name: 'chest', hindiName: 'सीना', unit: 'in', defaultValue: 36 },
        { id: 'mf-lambai', name: 'lambai', hindiName: 'लंबाई', unit: 'in', defaultValue: 28 },
        { id: 'mf-baju', name: 'baju', hindiName: 'बाजू', unit: 'in', defaultValue: 22 },
        { id: 'mf-collar', name: 'collar', hindiName: 'कॉलर', unit: 'in', defaultValue: 15 },
      ],
    },
    {
      customId: 'ITEM-002',
      name: 'School Pant',
      hasWaist: true,
      waistStartSize: '38',
      isActive: true,
      measurementFields: [
        { id: 'mf-kamar', name: 'kamar', hindiName: 'कमर', unit: 'in', defaultValue: 30 },
        { id: 'mf-hip', name: 'hip', hindiName: 'हिप', unit: 'in', defaultValue: 34 },
        { id: 'mf-lambai', name: 'lambai', hindiName: 'लंबाई', unit: 'in', defaultValue: 38 },
        { id: 'mf-mohri', name: 'mohri', hindiName: 'मोहरी', unit: 'in', defaultValue: 16 },
      ],
    },
    {
      customId: 'ITEM-003',
      name: 'Corporate Blazer',
      isActive: true,
      measurementFields: [
        { id: 'mf-chest', name: 'chest', hindiName: 'सीना', unit: 'in', defaultValue: 40 },
        { id: 'mf-lambai', name: 'lambai', hindiName: 'लंबाई', unit: 'in', defaultValue: 30 },
        { id: 'mf-baju', name: 'baju', hindiName: 'बाजू', unit: 'in', defaultValue: 24 },
        { id: 'mf-shoulder', name: 'shoulder', hindiName: 'कंधा', unit: 'in', defaultValue: 17 },
      ],
    },
    {
      customId: 'ITEM-004',
      name: 'Hospital Scrub Top',
      isActive: true,
      measurementFields: [
        { id: 'mf-chest', name: 'chest', hindiName: 'सीना', unit: 'in', defaultValue: 38 },
        { id: 'mf-lambai', name: 'lambai', hindiName: 'लंबाई', unit: 'in', defaultValue: 27 },
      ],
    },
  ];

  for (const item of items) {
    await UniformItem.findOneAndUpdate(
      { customId: item.customId },
      { $set: item, $unset: { rate: '' } },
      { upsert: true, new: true }
    );
  }
  await setSeq('item', 4);
  logger.info(`Mock uniform items: ${items.length}`);

  const shirt = await UniformItem.findOne({ customId: 'ITEM-001' });
  const pant = await UniformItem.findOne({ customId: 'ITEM-002' });
  const blazer = await UniformItem.findOne({ customId: 'ITEM-003' });
  const scrub = await UniformItem.findOne({ customId: 'ITEM-004' });

  // ── Clients ──────────────────────────────────────────────
  const clients = [
    {
      customId: 'CLI-SCH-01',
      name: 'Delhi Public School, RK Puram',
      sectorName: 'School',
      sectorId: school?._id,
      contactPerson: 'Mrs. Mehta',
      contactNumber: '9810011001',
      deliveryAddress: 'DPS RK Puram, Sector 12, New Delhi',
      specialRequirement: 'Navy + white; school crest on pocket',
      designUrl: 'https://drive.google.com/drive/folders/mock-dps-designs',
      defaultGarmentItemIds: [shirt?.customId, pant?.customId].filter(Boolean) as string[],
    },
    {
      customId: 'CLI-SCH-02',
      name: 'St. Mary Convent, Noida',
      sectorName: 'School',
      sectorId: school?._id,
      contactPerson: 'Sr. Agnes',
      contactNumber: '9810011002',
      deliveryAddress: 'Sector 15, Noida, UP',
      specialRequirement: 'Maroon tunic set',
      defaultGarmentItemIds: [shirt?.customId].filter(Boolean) as string[],
    },
    {
      customId: 'CLI-CORP-01',
      name: 'QBITSLABS Pvt Ltd',
      sectorName: 'Corporate',
      sectorId: corporate?._id,
      contactPerson: 'Arnav Sharma',
      contactNumber: '9876543210',
      deliveryAddress: 'Okhla Phase III, New Delhi',
      specialRequirement: 'Charcoal blazers with logo embroidery',
      designUrl: 'https://drive.google.com/drive/folders/mock-qbitslabs',
      defaultGarmentItemIds: [blazer?.customId].filter(Boolean) as string[],
    },
    {
      customId: 'CLI-HOSP-01',
      name: 'City Care Hospital',
      sectorName: 'Hospital',
      sectorId: hospital?._id,
      contactPerson: 'Dr. Kapoor',
      contactNumber: '9810099001',
      deliveryAddress: 'Ring Road, Lajpat Nagar, New Delhi',
      specialRequirement: 'Scrub sets — light blue',
      defaultGarmentItemIds: [scrub?.customId].filter(Boolean) as string[],
    },
  ];

  for (const c of clients) {
    await SectorClient.findOneAndUpdate({ customId: c.customId }, c, { upsert: true, new: true });
  }
  await setSeq('client-SCH', 2);
  await setSeq('client-CORP', 1);
  await setSeq('client-HOSP', 1);
  logger.info(`Mock clients: ${clients.length}`);

  // ── Workers ──────────────────────────────────────────────
  const workers = [
    {
      customId: 'WRK-001',
      name: 'Ramesh Kumar',
      phone: '9000000001',
      payType: 'Per Piece' as const,
      activities: [
        { activity: 'Cutting' as const, ratePerPiece: 8 },
        { activity: 'Stitching' as const, ratePerPiece: 15 },
      ],
      isActive: true,
    },
    {
      customId: 'WRK-002',
      name: 'Suresh Yadav',
      phone: '9000000002',
      payType: 'Per Piece' as const,
      activities: [
        { activity: 'Stitching' as const, ratePerPiece: 14 },
        { activity: 'Finishing' as const, ratePerPiece: 6 },
      ],
      isActive: true,
    },
    {
      customId: 'WRK-003',
      name: 'Anita Devi',
      phone: '9000000003',
      payType: 'Per Piece' as const,
      activities: [
        { activity: 'QC' as const, ratePerPiece: 5 },
        { activity: 'Packing' as const, ratePerPiece: 4 },
      ],
      isActive: true,
    },
    {
      customId: 'WRK-004',
      name: 'Vikram Singh',
      phone: '9000000004',
      payType: 'Salaried' as const,
      monthlySalary: 18000,
      activities: [{ activity: 'Cutting' as const }, { activity: 'Finishing' as const }],
      isActive: true,
    },
  ];

  for (const w of workers) {
    await Worker.findOneAndUpdate({ customId: w.customId }, w, { upsert: true, new: true });
  }
  await setSeq('worker', 4);
  logger.info(`Mock workers: ${workers.length}`);

  const wrk1 = await Worker.findOne({ customId: 'WRK-001' });
  const wrk2 = await Worker.findOne({ customId: 'WRK-002' });
  const wrk3 = await Worker.findOne({ customId: 'WRK-003' });

  // ── Orders ───────────────────────────────────────────────
  const shirtId = shirt?.customId || 'ITEM-001';
  const pantId = pant?.customId || 'ITEM-002';
  const blazerId = blazer?.customId || 'ITEM-003';
  const scrubId = scrub?.customId || 'ITEM-004';

  const orderDefs = [
    {
      customId: 'ORD-001',
      orderNumber: `ORD-${year}-001`,
      name: 'Delhi Public School, RK Puram',
      sectorId: school?.customId || 'SEC-01',
      sectorName: 'School',
      contactPerson: 'Mrs. Mehta',
      contactNumber: '9810011001',
      deliveryAddress: 'DPS RK Puram, Sector 12, New Delhi',
      specialRequirement: 'Navy + white; crest on pocket',
      items: [
        {
          id: 'oi-1',
          uniformItemId: shirtId,
          uniformItemName: 'School Shirt',
          size: 'M',
          quantity: 120,
          rate: 280,
          totalAmount: 120 * 280,
        },
        {
          id: 'oi-2',
          uniformItemId: pantId,
          uniformItemName: 'School Pant',
          size: 'M',
          quantity: 120,
          rate: 320,
          totalAmount: 120 * 320,
        },
      ],
      totalPieces: 240,
      totalAmount: 120 * 280 + 120 * 320,
      productionStage: 'Stitching' as const,
      deliveryDueDate: daysFromNow(21),
      stageHistory: [
        {
          timestamp: daysFromNow(-10),
          fromStage: 'Order Received',
          toStage: 'Fabric Required',
          actorName: 'System',
          isRevert: false,
        },
        {
          timestamp: daysFromNow(-8),
          fromStage: 'Fabric Required',
          toStage: 'Fabric Received',
          actorName: 'Floor Admin',
          isRevert: false,
        },
        {
          timestamp: daysFromNow(-5),
          fromStage: 'Fabric Received',
          toStage: 'Cutting',
          actorName: 'Floor Admin',
          isRevert: false,
        },
        {
          timestamp: daysFromNow(-2),
          fromStage: 'Cutting',
          toStage: 'Stitching',
          actorName: 'Floor Admin',
          isRevert: false,
        },
      ],
    },
    {
      customId: 'ORD-002',
      orderNumber: `ORD-${year}-002`,
      name: 'QBITSLABS Pvt Ltd',
      sectorId: corporate?.customId || 'SEC-02',
      sectorName: 'Corporate',
      contactPerson: 'Arnav Sharma',
      contactNumber: '9876543210',
      deliveryAddress: 'Okhla Phase III, New Delhi',
      specialRequirement: 'Logo embroidery left chest',
      items: [
        {
          id: 'oi-3',
          uniformItemId: blazerId,
          uniformItemName: 'Corporate Blazer',
          size: 'L',
          quantity: 40,
          rate: 950,
          totalAmount: 40 * 950,
        },
      ],
      totalPieces: 40,
      totalAmount: 40 * 950,
      productionStage: 'Fabric Received' as const,
      deliveryDueDate: daysFromNow(35),
      stageHistory: [
        {
          timestamp: daysFromNow(-3),
          fromStage: 'Order Received',
          toStage: 'Fabric Required',
          actorName: 'Super Admin',
          isRevert: false,
        },
        {
          timestamp: daysFromNow(-1),
          fromStage: 'Fabric Required',
          toStage: 'Fabric Received',
          actorName: 'Floor Admin',
          isRevert: false,
        },
      ],
    },
    {
      customId: 'ORD-003',
      orderNumber: `ORD-${year}-003`,
      name: 'City Care Hospital',
      sectorId: hospital?.customId || 'SEC-03',
      sectorName: 'Hospital',
      contactPerson: 'Dr. Kapoor',
      contactNumber: '9810099001',
      deliveryAddress: 'Ring Road, Lajpat Nagar, New Delhi',
      specialRequirement: 'Light blue scrub tops',
      items: [
        {
          id: 'oi-4',
          uniformItemId: scrubId,
          uniformItemName: 'Hospital Scrub Top',
          size: 'Free Size',
          quantity: 80,
          rate: 220,
          totalAmount: 80 * 220,
        },
      ],
      totalPieces: 80,
      totalAmount: 80 * 220,
      productionStage: 'Order Received' as const,
      deliveryDueDate: daysFromNow(28),
      stageHistory: [],
    },
  ];

  for (const o of orderDefs) {
    await Order.findOneAndUpdate({ customId: o.customId }, o, { upsert: true, new: true });
  }
  await setSeq(`order-${year}`, 3);
  logger.info(`Mock orders: ${orderDefs.length}`);

  // ── Manufacturing tickets ────────────────────────────────
  const mfgTickets = [
    {
      customId: 'MFG-001',
      ticketNumber: 'MFG-000001',
      orderId: 'ORD-001',
      orderName: 'Delhi Public School, RK Puram',
      orderNumber: `ORD-${year}-001`,
      sectorName: 'School',
      itemId: shirtId,
      itemName: 'School Shirt',
      size: '34-40  36-40  38-40',
      quantity: 120,
      productionStage: 'Stitching' as const,
      generatedOn: daysFromNow(-5),
      notes: 'Batch A — shirts',
    },
    {
      customId: 'MFG-002',
      ticketNumber: 'MFG-000002',
      orderId: 'ORD-001',
      orderName: 'Delhi Public School, RK Puram',
      orderNumber: `ORD-${year}-001`,
      sectorName: 'School',
      itemId: pantId,
      itemName: 'School Pant',
      size: '32-40  34-40  36-40',
      quantity: 120,
      productionStage: 'Stitching' as const,
      generatedOn: daysFromNow(-5),
      notes: 'Batch A — pants',
    },
    {
      customId: 'MFG-003',
      ticketNumber: 'MFG-000003',
      orderId: 'ORD-002',
      orderName: 'QBITSLABS Pvt Ltd',
      orderNumber: `ORD-${year}-002`,
      sectorName: 'Corporate',
      itemId: blazerId,
      itemName: 'Corporate Blazer',
      size: 'L',
      quantity: 40,
      productionStage: 'Fabric Received' as const,
      generatedOn: daysFromNow(-1),
    },
  ];

  for (const t of mfgTickets) {
    await ManufacturingTicket.findOneAndUpdate({ customId: t.customId }, t, { upsert: true, new: true });
  }
  await setSeq('mfg', 3);
  logger.info(`Mock manufacturing tickets: ${mfgTickets.length}`);

  // ── Measurements (parchis) ───────────────────────────────
  const measurements = [
    {
      customId: 'MES-001',
      ticketNumber: 'MT-000001',
      orderId: 'ORD-001',
      orderName: 'Delhi Public School, RK Puram',
      personName: 'Aarav Sharma',
      personCode: 'DPS-101',
      garmentItemId: shirtId,
      garmentItemName: 'School Shirt',
      size: 'M',
      measurements: { chest: 34, lambai: 26, baju: 20, collar: 14 },
      workerNames: ['Ramesh Kumar'],
      workerName: 'Ramesh Kumar',
      status: 'In Tailoring' as const,
      urgency: 'Normal',
      dueDate: daysFromNow(14),
    },
    {
      customId: 'MES-002',
      ticketNumber: 'MT-000002',
      orderId: 'ORD-001',
      orderName: 'Delhi Public School, RK Puram',
      personName: 'Ishaan Verma',
      personCode: 'DPS-102',
      garmentItemId: pantId,
      garmentItemName: 'School Pant',
      size: 'M',
      measurements: { kamar: 28, hip: 32, lambai: 36, mohri: 15 },
      workerNames: ['Suresh Yadav'],
      workerName: 'Suresh Yadav',
      status: 'Open' as const,
      urgency: 'Urgent',
      dueDate: daysFromNow(10),
    },
    {
      customId: 'MES-003',
      ticketNumber: 'MT-000003',
      orderId: 'ORD-002',
      orderName: 'QBITSLABS Pvt Ltd',
      personName: 'Priya Nair',
      personCode: 'QBIT-07',
      garmentItemId: blazerId,
      garmentItemName: 'Corporate Blazer',
      size: 'L',
      measurements: { chest: 38, lambai: 29, baju: 23, shoulder: 16 },
      workerNames: [],
      status: 'Open' as const,
      urgency: 'Normal',
      dueDate: daysFromNow(30),
    },
  ];

  for (const m of measurements) {
    await Measurement.findOneAndUpdate({ customId: m.customId }, m, { upsert: true, new: true });
  }
  await setSeq('measurement', 3);
  logger.info(`Mock measurements: ${measurements.length}`);

  // ── Floor tasks ──────────────────────────────────────────
  const tasks = [
    {
      customId: 'TSK-001',
      taskNumber: 'TSK-00001',
      workerId: wrk1?.customId || 'WRK-001',
      workerName: wrk1?.name || 'Ramesh Kumar',
      workerPhone: wrk1?.phone,
      orderId: 'ORD-001',
      orderName: 'Delhi Public School, RK Puram',
      orderNumber: `ORD-${year}-001`,
      itemId: shirtId,
      itemName: 'School Shirt',
      size: 'M',
      stage: 'Cutting',
      assignedPieces: 120,
      completedPieces: 120,
      assignedDate: daysFromNow(-5),
      targetDate: daysFromNow(-2),
      shift: 'Morning Shift',
      status: 'Completed' as const,
      notes: 'Cutting complete for shirt batch',
    },
    {
      customId: 'TSK-002',
      taskNumber: 'TSK-00002',
      workerId: wrk2?.customId || 'WRK-002',
      workerName: wrk2?.name || 'Suresh Yadav',
      workerPhone: wrk2?.phone,
      orderId: 'ORD-001',
      orderName: 'Delhi Public School, RK Puram',
      orderNumber: `ORD-${year}-001`,
      itemId: shirtId,
      itemName: 'School Shirt',
      size: 'M',
      stage: 'Stitching',
      assignedPieces: 60,
      completedPieces: 25,
      assignedDate: daysFromNow(-2),
      targetDate: daysFromNow(5),
      shift: 'General Shift',
      status: 'In Progress' as const,
      notes: 'First stitching lot',
    },
    {
      customId: 'TSK-003',
      taskNumber: 'TSK-00003',
      workerId: wrk1?.customId || 'WRK-001',
      workerName: wrk1?.name || 'Ramesh Kumar',
      workerPhone: wrk1?.phone,
      orderId: 'ORD-001',
      orderName: 'Delhi Public School, RK Puram',
      orderNumber: `ORD-${year}-001`,
      itemId: pantId,
      itemName: 'School Pant',
      size: 'M',
      stage: 'Stitching',
      assignedPieces: 60,
      completedPieces: 0,
      assignedDate: daysFromNow(-1),
      targetDate: daysFromNow(7),
      shift: 'Evening Shift',
      status: 'Assigned' as const,
    },
    {
      customId: 'TSK-004',
      taskNumber: 'TSK-00004',
      workerId: wrk3?.customId || 'WRK-003',
      workerName: wrk3?.name || 'Anita Devi',
      workerPhone: wrk3?.phone,
      orderId: 'ORD-001',
      orderName: 'Delhi Public School, RK Puram',
      orderNumber: `ORD-${year}-001`,
      itemId: shirtId,
      itemName: 'School Shirt',
      size: 'M',
      stage: 'QC',
      assignedPieces: 20,
      completedPieces: 0,
      assignedDate: daysFromNow(0),
      targetDate: daysFromNow(3),
      shift: 'Morning Shift',
      status: 'Pending' as const,
      notes: 'QC after first stitching lot',
    },
  ];

  for (const t of tasks) {
    await WorkerTask.findOneAndUpdate({ customId: t.customId }, t, { upsert: true, new: true });
  }
  await setSeq('task', 4);
  logger.info(`Mock worker tasks: ${tasks.length}`);

  // ── Worker ledger sample vouchers ────────────────────────
  const { WorkerLedger } = await import('../models/WorkerLedger.js');
  const ledgerRows = [
    {
      customId: 'LED-0001',
      voucherNumber: `VCH-${year}-0001`,
      workerId: 'WRK-001',
      workerName: 'Ramesh Kumar',
      workerPhone: '9000000001',
      transactionType: 'Advance Payment' as const,
      entryType: 'Debit' as const,
      amount: 2000,
      paymentMode: 'Cash' as const,
      date: daysFromNow(-20),
      notes: 'Advance against stitching batch',
      recordedBy: 'Floor Admin',
    },
    {
      customId: 'LED-0002',
      voucherNumber: `VCH-${year}-0002`,
      workerId: 'WRK-001',
      workerName: 'Ramesh Kumar',
      workerPhone: '9000000001',
      transactionType: 'Piece-Rate Earning' as const,
      entryType: 'Credit' as const,
      amount: 1800,
      pieces: 120,
      ratePerPiece: 15,
      garmentItemName: 'School Shirt',
      orderNumber: `ORD-${year}-001`,
      paymentMode: 'N/A' as const,
      date: daysFromNow(-4),
      notes: 'Cutting complete credit',
      recordedBy: 'System',
    },
    {
      customId: 'LED-0003',
      voucherNumber: `VCH-${year}-0003`,
      workerId: 'WRK-002',
      workerName: 'Suresh Yadav',
      workerPhone: '9000000002',
      transactionType: 'Piece-Rate Earning' as const,
      entryType: 'Credit' as const,
      amount: 350,
      pieces: 25,
      ratePerPiece: 14,
      garmentItemName: 'School Shirt',
      orderNumber: `ORD-${year}-001`,
      paymentMode: 'N/A' as const,
      date: daysFromNow(-1),
      notes: 'Partial stitching progress',
      recordedBy: 'System',
    },
    {
      customId: 'LED-0004',
      voucherNumber: `VCH-${year}-0004`,
      workerId: 'WRK-002',
      workerName: 'Suresh Yadav',
      workerPhone: '9000000002',
      transactionType: 'Wage Payout' as const,
      entryType: 'Debit' as const,
      amount: 500,
      paymentMode: 'UPI' as const,
      referenceNumber: 'UPI-MOCK-9921',
      date: daysFromNow(-1),
      notes: 'Partial payout',
      recordedBy: 'Super Admin',
    },
    {
      customId: 'LED-0005',
      voucherNumber: `VCH-${year}-0005`,
      workerId: 'WRK-001',
      workerName: 'Ramesh Kumar',
      workerPhone: '9000000001',
      transactionType: 'Bonus' as const,
      entryType: 'Credit' as const,
      amount: 300,
      paymentMode: 'Cash' as const,
      date: daysFromNow(-15),
      notes: 'Festival bonus',
      recordedBy: 'Super Admin',
    },
  ];

  for (const row of ledgerRows) {
    await WorkerLedger.findOneAndUpdate({ customId: row.customId }, row, { upsert: true, new: true });
  }
  await setSeq(`ledger-${year}`, 5);
  logger.info(`Mock ledger vouchers: ${ledgerRows.length}`);

  logger.info(
    'Mock data ready — 3 sectors, 4 clients, 4 garments, 4 workers, 3 orders, 3 MFG tickets, 3 measurements, 4 tasks, 5 ledger vouchers'
  );
}
