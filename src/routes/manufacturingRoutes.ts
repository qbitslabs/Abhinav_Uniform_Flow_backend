import { Router } from 'express';
import * as manufacturingController from '../controllers/manufacturingController';
import { validate } from '../middlewares/validationMiddleware';
import { mfgListSchema, createMfgSchema, mfgStageSchema } from '../validators/schemas';

const router = Router();

router.get('/tickets', validate(mfgListSchema), manufacturingController.list);
router.get('/tickets/:id', manufacturingController.getOne);
router.patch('/tickets/:id/stage', validate(mfgStageSchema), manufacturingController.updateStage);
router.post('/tickets', validate(createMfgSchema), manufacturingController.create);

export default router;
