import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { createDatabase } from './db/database.js';
import { CatalogRepository } from './repositories/catalogRepository.js';
import { OrderService } from './services/orderService.js';
import { createApiRouter } from './routes/api.js';

export interface AppOptions {
  db?: Database.Database;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Database and services
  const db = options.db || createDatabase();
  const catalogRepo = new CatalogRepository(db);
  const orderService = new OrderService(db, catalogRepo);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'medex-checkout-backend' });
  });

  // Mount API endpoints
  app.use('/api', createApiRouter(catalogRepo, orderService));

  // 404 Handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  return app;
}
