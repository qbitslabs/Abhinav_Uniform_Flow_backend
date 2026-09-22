import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController';

const router = Router();
router.get('/stats', dashboardController.stats);
export default router;
