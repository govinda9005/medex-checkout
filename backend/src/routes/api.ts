import { Router } from 'express';
import { CatalogRepository } from '../repositories/catalogRepository.js';
import { OrderService } from '../services/orderService.js';
import { createServicesController } from '../controllers/servicesController.js';
import { createQuoteController } from '../controllers/quoteController.js';
import { createOrderController } from '../controllers/orderController.js';

export function createApiRouter(
  catalogRepo: CatalogRepository,
  orderService: OrderService
): Router {
  const router = Router();

  const servicesCtrl = createServicesController(catalogRepo);
  const quoteCtrl = createQuoteController(catalogRepo);
  const orderCtrl = createOrderController(orderService);

  // Required API Endpoints
  router.get('/services', servicesCtrl.getServices);
  router.post('/quote', quoteCtrl.postQuote);
  router.post('/orders', orderCtrl.postOrder);

  // Auxiliary Endpoints for Customer Switcher & Admin/Frontend inspection
  router.get('/customers', servicesCtrl.getCustomers);
  router.get('/coupons', servicesCtrl.getCoupons);

  return router;
}
