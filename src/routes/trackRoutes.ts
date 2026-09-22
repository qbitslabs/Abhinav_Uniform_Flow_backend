import { Router } from 'express';
import * as trackController from '../controllers/trackController';

const router = Router();

// Public Tracking Routes (No login required - for clients, schools, and students)
router.get('/:id', trackController.trackRecord);
router.get('/', trackController.trackRecord);

export default router;
