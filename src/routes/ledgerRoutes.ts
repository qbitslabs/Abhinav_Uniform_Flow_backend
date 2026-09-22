import { Router } from 'express';
import * as ledgerController from '../controllers/ledgerController';
import { superAdminOnly } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validationMiddleware';
import { ledgerListSchema, createLedgerSchema, deleteLedgerSchema } from '../validators/schemas';

const router = Router();

// Read: Floor Admin + Super Admin (worker detail statement)
router.get('/', validate(ledgerListSchema), ledgerController.list);
router.get('/summary', ledgerController.getSummary);

// Write / export: Super Admin only
router.use(superAdminOnly);
router.get('/export', ledgerController.exportExcel);
router.post('/', validate(createLedgerSchema), ledgerController.create);
router.delete('/:id', validate(deleteLedgerSchema), ledgerController.remove);

export default router;
