-- Kardex PostgreSQL initialization script
-- This file runs on first container startup
-- (Migrations will be handled by Prisma)

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For full-text search

-- Log initialization
SELECT 'PostgreSQL initialized for Kardex' AS status;
