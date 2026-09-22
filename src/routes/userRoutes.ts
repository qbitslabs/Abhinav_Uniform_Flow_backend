import { Router } from 'express';
import * as userController from '../controllers/userController';
import { superAdminOnly } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validationMiddleware';
import {
  createFloorAdminSchema,
  updateFloorAdminSchema,
  setUserActiveSchema,
} from '../validators/schemas';

const router = Router();

router.use(superAdminOnly);
router.get('/', userController.list);
router.post('/floor-admin', validate(createFloorAdminSchema), userController.createFloorAdmin);
router.put('/:id', validate(updateFloorAdminSchema), userController.updateFloorAdmin);
router.patch('/:id/active', validate(setUserActiveSchema), userController.setActive);

export default router;
