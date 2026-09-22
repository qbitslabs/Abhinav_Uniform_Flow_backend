import { Router } from 'express';
import * as workerController from '../controllers/workerController';
import { superAdminOnly } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validationMiddleware';
import { workerListSchema, createWorkerSchema, updateWorkerSchema } from '../validators/schemas';

const router = Router();

router.get('/', validate(workerListSchema), workerController.list);
router.get('/:id', workerController.getOne);
router.post('/', superAdminOnly, validate(createWorkerSchema), workerController.create);
router.put('/:id', superAdminOnly, validate(updateWorkerSchema), workerController.update);
router.delete('/:id', superAdminOnly, workerController.remove);

export default router;
