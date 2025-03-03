# Database Migrations

This directory contains SQL migration files that set up and modify the database schema for the Discord bot.

## Migration Files

Migrations are applied in order based on their filename prefix:

- `000_create_exec_sql_function.sql` - Creates the function to execute raw SQL
- `001_create_migrations_table.sql` - Creates the migrations tracking table
- `002_create_bot_configs_table.sql` - Creates the bot configurations table
- `003_create_servers_table.sql` - Creates the servers table
- `004_create_server_bots_table.sql` - Creates the server-bot relationships table

## Running Migrations

To apply all pending migrations, run:

```bash
npm run migrate
```

This will:
1. Check which migrations have already been applied
2. Apply any new migrations in order
3. Record each successful migration in the `migrations` table

## Creating New Migrations

When adding new migrations:

1. Create a new SQL file with the next sequential number (e.g., `005_...`)
2. Include both the SQL to make the change and an INSERT statement to record the migration
3. Follow the format of existing migration files

Example:

```sql
-- Migration: 005_add_new_column
-- Description: Adds a new column to an existing table

-- Add the column
ALTER TABLE table_name ADD COLUMN new_column_name TEXT;

-- Insert this migration record
INSERT INTO migrations (name, batch) 
VALUES ('005_add_new_column', 1);
```

## Migration Structure

Each migration file should:

1. Start with a comment describing the migration
2. Include the SQL statements to make the schema changes
3. End with an INSERT statement to record the migration (this is handled by the migration runner)

## Troubleshooting

If migrations fail:

1. Check the error message in the console
2. Fix any issues in the migration files
3. Run the migration command again 