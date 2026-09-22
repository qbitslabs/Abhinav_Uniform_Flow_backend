import { Router } from 'express';
import * as settingsController from '../controllers/settingsController';
import { superAdminOnly } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validationMiddleware';
import { updateSettingsSchema } from '../validators/schemas';

const router = Router();

// Read: Floor Admin + Super Admin (company print header, auth flags)
router.get('/', settingsController.get);

// Write / destructive: Super Admin only
router.use(superAdminOnly);
router.put('/', validate(updateSettingsSchema), settingsController.update);
router.post('/reset-demo', settingsController.resetDemo);
router.get('/backup', settingsController.backup);

export default router;
