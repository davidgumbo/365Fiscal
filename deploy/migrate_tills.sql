-- 365 Fiscal: Add POS Tills & Cashier tracking
-- Run this directly: psql -U fiscal365_user -d fiscal365 -f migrate_tills.sql

-- 1. Add missing columns to pos_orders (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pos_orders' AND column_name = 'cashier_name'
    ) THEN
        ALTER TABLE pos_orders ADD COLUMN cashier_name VARCHAR(200) DEFAULT '';
        RAISE NOTICE 'Added cashier_name column to pos_orders';
    ELSE
        RAISE NOTICE 'cashier_name column already exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pos_orders' AND column_name = 'till_id'
    ) THEN
        ALTER TABLE pos_orders ADD COLUMN till_id INTEGER;
        RAISE NOTICE 'Added till_id column to pos_orders';
    ELSE
        RAISE NOTICE 'till_id column already exists';
    END IF;
END $$;

-- 2. Create pos_tills table if missing
CREATE TABLE IF NOT EXISTS pos_tills (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    name VARCHAR(200) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_pos_tills_company_id ON pos_tills(company_id);

-- 3. Create pos_till_employees association table if missing
CREATE TABLE IF NOT EXISTS pos_till_employees (
    till_id INTEGER NOT NULL REFERENCES pos_tills(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES pos_employees(id) ON DELETE CASCADE,
    PRIMARY KEY (till_id, employee_id)
);

-- 4. Stamp alembic version
UPDATE alembic_version SET version_num = 'y1z2a3b4c5d6';

SELECT 'Migration complete!' AS status;
