import { Router } from 'express';
import * as productionTaskController from '../controllers/productionTaskController';
import { validate } from '../middlewares/validationMiddleware';
import { taskListSchema, createTaskSchema, updateTaskSchema, taskProgressSchema } from '../validators/schemas';

const router = Router();

router.get('/', validate(taskListSchema), productionTaskController.list);
router.get('/:id', productionTaskController.getOne);
router.post('/', validate(createTaskSchema), productionTaskController.create);
router.put('/:id', validate(updateTaskSchema), productionTaskController.update);
router.patch('/:id/progress', validate(taskProgressSchema), productionTaskController.progress);
router.delete('/:id', productionTaskController.remove);

export default router;
