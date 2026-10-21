import { Request, Response } from 'express';
import { CatalogRepository } from '../repositories/catalogRepository.js';

export function createServicesController(catalogRepo: CatalogRepository) {
  return {
    getServices: (_req: Request, res: Response) => {
      try {
        const services = catalogRepo.getAllServices();
        res.status(200).json(services);
      } catch (err: any) {
        res.status(500).json({ error: 'Failed to retrieve services', details: err.message });
      }
    },

    getCustomers: (_req: Request, res: Response) => {
      try {
        const customers = catalogRepo.getAllCustomers();
        res.status(200).json(customers);
      } catch (err: any) {
        res.status(500).json({ error: 'Failed to retrieve customers', details: err.message });
      }
    },

    getCoupons: (_req: Request, res: Response) => {
      try {
        const coupons = catalogRepo.getAllCoupons();
        res.status(200).json(coupons);
      } catch (err: any) {
        res.status(500).json({ error: 'Failed to retrieve coupons', details: err.message });
      }
    }
  };
}
