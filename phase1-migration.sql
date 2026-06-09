-- ============================================================
-- PHASE 1 MIGRATION — Purchase Entry, Stock Transfer, Audit Log
-- Run this ONCE in Supabase SQL Editor
-- No ALTER TABLE needed — code uses original constraint values
-- ============================================================

-- ============================================================
-- 1. PURCHASE INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shop_id         UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  supplier_id     UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name   TEXT NOT NULL,
  invoice_number  TEXT,
  invoice_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  total_items     INTEGER DEFAULT 0,
  total_quantity  INTEGER DEFAULT 0,
  total_cost      NUMERIC(12,2) DEFAULT 0,
  notes           TEXT,
  biller_name     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. PURCHASE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_items (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  purchase_invoice_id UUID REFERENCES purchase_invoices(id) ON DELETE CASCADE NOT NULL,
  shop_id             UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  product_id          UUID REFERENCES products(id) ON DELETE SET NULL,
  barcode             TEXT,
  product_name        TEXT NOT NULL,
  quantity            INTEGER NOT NULL DEFAULT 1,
  unit_cost           NUMERIC(10,2) NOT NULL DEFAULT 0,
  selling_price       NUMERIC(10,2) DEFAULT 0,
  mrp                 NUMERIC(10,2) DEFAULT 0,
  total_cost          NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- ============================================================
-- 3. STOCK TRANSFERS
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_transfers (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  transfer_number TEXT NOT NULL UNIQUE,
  from_shop_id    UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  to_shop_id      UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  status          TEXT DEFAULT 'COMPLETED'
                    CHECK (status IN ('COMPLETED', 'CANCELLED')),
  notes           TEXT,
  biller_name     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. STOCK TRANSFER ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  transfer_id     UUID REFERENCES stock_transfers(id) ON DELETE CASCADE NOT NULL,
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
  barcode         TEXT,
  product_name    TEXT NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  unit_cost       NUMERIC(10,2) DEFAULT 0
);

-- ============================================================
-- 5. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_shop_id      ON purchase_invoices(shop_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier_id  ON purchase_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_created_at   ON purchase_invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_items_invoice_id      ON purchase_items(purchase_invoice_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product_id      ON purchase_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from_shop      ON stock_transfers(from_shop_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to_shop        ON stock_transfers(to_shop_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_created_at     ON stock_transfers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_transfer_id ON stock_transfer_items(transfer_id);

-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE purchase_invoices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_invoices_owner" ON purchase_invoices FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

CREATE POLICY "purchase_items_owner" ON purchase_items FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

CREATE POLICY "stock_transfers_owner" ON stock_transfers FOR ALL
  USING (
    from_shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid())
    OR
    to_shop_id   IN (SELECT id FROM shops WHERE owner_id = auth.uid())
  );

CREATE POLICY "stock_transfer_items_owner" ON stock_transfer_items FOR ALL
  USING (transfer_id IN (
    SELECT id FROM stock_transfers
    WHERE from_shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid())
       OR to_shop_id   IN (SELECT id FROM shops WHERE owner_id = auth.uid())
  ));
