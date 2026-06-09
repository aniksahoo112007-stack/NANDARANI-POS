-- ============================================================
-- NANDARANI POS — Phase 3 SQL Migration
-- Run in Supabase SQL Editor
-- All statements use IF NOT EXISTS / IF EXISTS — safe to re-run
-- ============================================================

-- ─── Feature 1: Product Variant Matrix ────────────────────────────────────────
-- Products already store size+color per row (each variant = one product row).
-- We add a parent_product_id so variants can be grouped visually.
ALTER TABLE products ADD COLUMN IF NOT EXISTS parent_product_id UUID REFERENCES products(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_products_parent ON products(parent_product_id);

-- ─── Feature 2: Stock Audit ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_audits (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shop_id      UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  audit_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  status       TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CONFIRMED')),
  total_items  INTEGER DEFAULT 0,
  total_variance INTEGER DEFAULT 0,
  notes        TEXT,
  biller_name  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_audit_items (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  audit_id          UUID REFERENCES stock_audits(id) ON DELETE CASCADE NOT NULL,
  shop_id           UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  product_id        UUID REFERENCES products(id) ON DELETE SET NULL,
  barcode           TEXT,
  product_name      TEXT NOT NULL,
  category          TEXT,
  system_quantity   INTEGER NOT NULL DEFAULT 0,
  physical_quantity INTEGER NOT NULL DEFAULT 0,
  variance          INTEGER NOT NULL DEFAULT 0,
  adjustment_reason TEXT,
  is_adjusted       BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_audits_shop_date ON stock_audits(shop_id, audit_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_audit_items_audit ON stock_audit_items(audit_id);

-- RLS
ALTER TABLE stock_audits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stock_audits' AND policyname='shop_owner_audits') THEN
    CREATE POLICY shop_owner_audits ON stock_audits FOR ALL
      USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));
  END IF;
END $$;

ALTER TABLE stock_audit_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stock_audit_items' AND policyname='shop_owner_audit_items') THEN
    CREATE POLICY shop_owner_audit_items ON stock_audit_items FOR ALL
      USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));
  END IF;
END $$;

-- ─── Feature 8: Purchase price in bill_items ──────────────────────────────────
-- Records the purchase cost at the time of sale for profit calculation
ALTER TABLE bill_items ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(10,2) DEFAULT 0;

-- ─── Feature 10: Daily Closing ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_closings (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shop_id         UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  closing_date    DATE NOT NULL,
  total_bills     INTEGER DEFAULT 0,
  cash_total      NUMERIC(10,2) DEFAULT 0,
  upi_total       NUMERIC(10,2) DEFAULT 0,
  card_total      NUMERIC(10,2) DEFAULT 0,
  other_total     NUMERIC(10,2) DEFAULT 0,
  due_created     NUMERIC(10,2) DEFAULT 0,
  due_collected   NUMERIC(10,2) DEFAULT 0,
  returns_total   NUMERIC(10,2) DEFAULT 0,
  exchanges_total NUMERIC(10,2) DEFAULT 0,
  gross_revenue   NUMERIC(10,2) DEFAULT 0,
  total_cost      NUMERIC(10,2) DEFAULT 0,
  gross_profit    NUMERIC(10,2) DEFAULT 0,
  net_revenue     NUMERIC(10,2) DEFAULT 0,
  closed_by       TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, closing_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_closings_shop_date ON daily_closings(shop_id, closing_date DESC);

ALTER TABLE daily_closings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_closings' AND policyname='shop_owner_closings') THEN
    CREATE POLICY shop_owner_closings ON daily_closings FOR ALL
      USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));
  END IF;
END $$;

-- ─── Feature 13: Transfer Request System ──────────────────────────────────────
-- Upgrade stock_transfers.status to support request workflow
ALTER TABLE stock_transfers DROP CONSTRAINT IF EXISTS stock_transfers_status_check;
ALTER TABLE stock_transfers ADD CONSTRAINT stock_transfers_status_check
  CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'));

-- Add workflow columns (safe with IF NOT EXISTS)
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS requested_by  TEXT;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS approved_by   TEXT;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS approved_at   TIMESTAMPTZ;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ============================================================
-- Migration complete.
-- Run npm run build after applying.
-- ============================================================
