import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/authController';
import { authenticate } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validationMiddleware';
import { loginSchema, verifyPinSchema } from '../validators/schemas';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too Many Requests', message: 'Too many login attempts', statusCode: 429 },
});

router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.get('/me', authenticate, authController.me);
router.post('/verify-pin', authenticate, validate(verifyPinSchema), authController.verifyPin);
router.post('/logout', authenticate, authController.logout);

export default router;
