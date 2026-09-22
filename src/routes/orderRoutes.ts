import { Router } from 'express';
import * as orderController from '../controllers/orderController';
import { validate } from '../middlewares/validationMiddleware';
import {
  orderListSchema,
  createOrderSchema,
  updateOrderSchema,
  updateStageSchema,
} from '../validators/schemas';

const router = Router();

router.get('/', validate(orderListSchema), orderController.list);
router.get('/:id', orderController.getOne);
router.post('/', validate(createOrderSchema), orderController.create);
router.put('/:id', validate(updateOrderSchema), orderController.update);
router.patch('/:id/stage', validate(updateStageSchema), orderController.updateStage);
router.delete('/:id', orderController.remove);

export default router;
