import { Router } from 'express';
import * as auditLogController from '../controllers/auditLogController';
import { superAdminOnly } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validationMiddleware';
import { auditListSchema, createAuditSchema } from '../validators/schemas';

const router = Router();

router.use(superAdminOnly);
router.get('/', validate(auditListSchema), auditLogController.list);
router.get('/stats', auditLogController.stats);
router.post('/', validate(createAuditSchema), auditLogController.create);

export default router;
