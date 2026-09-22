import { Router } from 'express';
import * as uniformItemController from '../controllers/uniformItemController';
import { superAdminOnly } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validationMiddleware';
import { createItemSchema, updateItemSchema } from '../validators/schemas';

const router = Router();

router.get('/', uniformItemController.list);
router.post('/', superAdminOnly, validate(createItemSchema), uniformItemController.create);
router.put('/:id', superAdminOnly, validate(updateItemSchema), uniformItemController.update);
router.delete('/:id', superAdminOnly, uniformItemController.remove);

export default router;
