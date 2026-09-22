import { Router } from 'express';
import * as measurementController from '../controllers/measurementController';
import { validate } from '../middlewares/validationMiddleware';
import {
  measurementListSchema,
  createMeasurementSchema,
  updateMeasurementSchema,
  batchAssignSchema,
  measurementStatusSchema,
} from '../validators/schemas';

const router = Router();

router.get('/', validate(measurementListSchema), measurementController.list);
router.patch('/batch-assign', validate(batchAssignSchema), measurementController.batchAssign);
router.get('/:id', measurementController.getOne);
router.post('/', validate(createMeasurementSchema), measurementController.create);
router.put('/:id', validate(updateMeasurementSchema), measurementController.update);
router.patch('/:id/status', validate(measurementStatusSchema), measurementController.updateStatus);
router.delete('/:id', measurementController.remove);

export default router;
