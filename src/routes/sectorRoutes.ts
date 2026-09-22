import { Router } from 'express';
import * as sectorController from '../controllers/sectorController';
import { superAdminOnly } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validationMiddleware';
import { createSectorSchema, updateSectorSchema, clientListSchema, createClientSchema } from '../validators/schemas';

const router = Router();

router.get('/', sectorController.list);
router.get('/clients', validate(clientListSchema), sectorController.listClients);
router.post('/clients', superAdminOnly, validate(createClientSchema), sectorController.createClient);
router.put('/clients/:id', superAdminOnly, sectorController.updateClient);
router.delete('/clients/:id', superAdminOnly, sectorController.removeClient);

router.post('/', superAdminOnly, validate(createSectorSchema), sectorController.create);
router.put('/:id', superAdminOnly, validate(updateSectorSchema), sectorController.update);
router.delete('/:id', superAdminOnly, sectorController.remove);

export default router;
