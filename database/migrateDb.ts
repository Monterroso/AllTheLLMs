/**
 * Database Migration Runner
 * This utility applies SQL migrations to the database in order
 * It tracks which migrations have been applied in the migrations table
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import supabase from '@database/index';
import { logger } from '@utils/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Applies all pending migrations to the database
 * Migrations are applied in order based on their filename
 * Each migration is tracked in the migrations table
 */
async function runMigrations() {
  logger.info('Starting database migrations...');
  
  try {
    // Get all migration files
    const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort to ensure migrations run in order
    
    if (migrationFiles.length === 0) {
      logger.info('No migration files found.');
      return;
    }
    
    // Get already applied migrations
    let appliedMigrationNames: string[] = [];
    try {
      const { data: appliedMigrations, error: fetchError } = await supabase
        .from('migrations')
        .select('name');
        
      if (fetchError) {
        // If error is because migrations table doesn't exist yet, that's expected for first run
        if (!fetchError.message.includes('does not exist')) {
          throw fetchError;
        }
      } else {
        appliedMigrationNames = appliedMigrations?.map(m => m.name) || [];
      }
    } catch (error) {
      // If we can't query the migrations table, it probably doesn't exist yet
      logger.info('Migrations table does not exist yet, will be created by first migration.');
    }
    
    // Determine the current batch number
    let currentBatch = 1;
    if (appliedMigrationNames.length > 0) {
      try {
        const { data: maxBatch } = await supabase
          .from('migrations')
          .select('batch')
          .order('batch', { ascending: false })
          .limit(1);
          
        if (maxBatch && maxBatch.length > 0) {
          currentBatch = maxBatch[0].batch + 1;
        }
      } catch (error) {
        // If we can't query the batch, use default of 1
        logger.info('Could not determine current batch number, using 1.');
      }
    }
    
    // Apply pending migrations
    for (const file of migrationFiles) {
      // Skip the 000 migration as it was run manually
      if (file.startsWith('000_')) {
        logger.info(`Skipping ${file} as it was run manually.`);
        continue;
      }
      
      const migrationName = path.basename(file, '.sql');
      
      // Skip if already applied
      if (appliedMigrationNames.includes(migrationName)) {
        logger.info(`Migration ${migrationName} already applied, skipping.`);
        continue;
      }
      
      // Read and execute the migration
      const migrationPath = path.join(migrationsDir, file);
      const migrationSql = fs.readFileSync(migrationPath, 'utf8');
      
      logger.info(`Applying migration: ${migrationName}`);
      
      try {
        // Execute the SQL (except for the INSERT INTO migrations part)
        const sqlWithoutInsert = migrationSql.split('INSERT INTO migrations')[0];
        
        const { error: migrationError } = await supabase.rpc('exec_sql', { 
          sql_query: sqlWithoutInsert 
        });
        
        if (migrationError) {
          throw new Error(`Error applying migration ${migrationName}: ${migrationError.message}`);
        }
        
        // Record the migration (manually, since the INSERT in the SQL file might not work for first migration)
        try {
          const { error: insertError } = await supabase
            .from('migrations')
            .insert({
              name: migrationName,
              batch: currentBatch
            });
            
          if (insertError) {
            throw new Error(`Error recording migration ${migrationName}: ${insertError.message}`);
          }
        } catch (error) {
          // If we can't insert into migrations table, it might not exist yet
          // This is expected for the first migration that creates the migrations table
          if (migrationName === '001_create_migrations_table') {
            logger.info('Migrations table created, no need to record this migration.');
          } else {
            throw error;
          }
        }
        
        logger.success(`Migration ${migrationName} applied successfully.`);
      } catch (error) {
        logger.error(`Failed to apply migration ${migrationName}:`, error);
        throw error;
      }
    }
    
    logger.success('All migrations completed successfully.');
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migrations if this file is executed directly
// Using ES modules syntax instead of CommonJS require.main === module
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(error => {
      logger.error('Unhandled error during migration:', error);
      process.exit(1);
    });
}

export default runMigrations; 