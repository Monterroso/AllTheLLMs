/**
 * Migration Script
 * This script runs database migrations to set up or update the database schema
 * Run with: npm run migrate
 */

import runMigrations from '@database/migrateDb';
import { logger } from '@utils/logger';

// Run migrations
logger.info('Starting migration script...');

runMigrations()
  .then(() => {
    logger.success('Migrations completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Migration failed:', error);
    process.exit(1);
  }); 