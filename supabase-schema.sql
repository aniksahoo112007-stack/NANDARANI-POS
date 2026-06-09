-- ============================================================
-- NANDARANI POS - Complete Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'owner' CHECK (role IN ('owner', 'manager', 'biller')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. SHOPS
-- ============================================================
CREATE TABLE shops (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT,
  bill_prefix TEXT NOT NULL UNIQUE,
  barcode_prefix TEXT NOT NULL UNIQUE,
  address TEXT,
  pincode TEXT,
  phone TEXT,
  whatsapp TEXT,
  gst_number TEXT,
  upi_id TEXT,
  upi_name TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. SHOP SETTINGS
-- ============================================================
CREATE TABLE shop_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL UNIQUE,
  default_gst_rate NUMERIC(5,2) DEFAULT 0,
  default_discount NUMERIC(5,2) DEFAULT 0,
  low_stock_limit INTEGER DEFAULT 5,
  bill_footer TEXT DEFAULT 'Thank you for shopping with us!',
  return_policy TEXT DEFAULT 'Exchange within 7 days with bill.',
  biller_names TEXT[] DEFAULT '{}',
  payment_methods TEXT[] DEFAULT ARRAY['Cash', 'UPI', 'Card', 'Bank Transfer'],
  show_mrp_on_bill BOOLEAN DEFAULT TRUE,
  round_off_bill BOOLEAN DEFAULT TRUE,
  enable_gst BOOLEAN DEFAULT FALSE,
  thermal_width_mm INTEGER DEFAULT 80,
  currency_symbol TEXT DEFAULT '₹',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. BILL SEQUENCES (atomic auto-increment per shop)
-- ============================================================
CREATE TABLE bill_sequences (
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE PRIMARY KEY,
  last_number BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. BARCODE SEQUENCES (atomic auto-increment per shop)
-- ============================================================
CREATE TABLE barcode_sequences (
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE PRIMARY KEY,
  last_number BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. SUPPLIERS
-- ============================================================
CREATE TABLE suppliers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  gst_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. PRODUCTS (inventory items)
-- ============================================================
CREATE TABLE products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  barcode TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  sub_category TEXT,
  brand TEXT,
  size TEXT,
  color TEXT,
  gender TEXT CHECK (gender IN ('Men', 'Women', 'Kids', 'Unisex', '')),
  fabric TEXT,
  purchase_price NUMERIC(10,2) DEFAULT 0,
  selling_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  mrp NUMERIC(10,2) DEFAULT 0,
  discount_pct NUMERIC(5,2) DEFAULT 0,
  gst_rate NUMERIC(5,2) DEFAULT 0,
  hsn_code TEXT,
  stock_quantity INTEGER DEFAULT 0,
  low_stock_limit INTEGER DEFAULT 5,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,
  image_url TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, barcode)
);

-- ============================================================
-- 8. INVENTORY MOVEMENTS
-- ============================================================
CREATE TABLE inventory_movements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('IN', 'OUT', 'ADJUSTMENT', 'RETURN_IN', 'EXCHANGE_IN', 'EXCHANGE_OUT')),
  quantity INTEGER NOT NULL,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  reference_type TEXT CHECK (reference_type IN ('BILL', 'RETURN', 'EXCHANGE', 'MANUAL', 'PURCHASE')),
  reference_id UUID,
  reference_number TEXT,
  notes TEXT,
  biller_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. CUSTOMERS
-- ============================================================
CREATE TABLE customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  address TEXT,
  gst_number TEXT,
  total_purchase NUMERIC(12,2) DEFAULT 0,
  total_due NUMERIC(12,2) DEFAULT 0,
  last_purchase_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. BILLS
-- ============================================================
CREATE TABLE bills (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  bill_number TEXT NOT NULL,
  bill_type TEXT DEFAULT 'NORMAL' CHECK (bill_type IN ('NORMAL', 'GST')),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_whatsapp TEXT,
  customer_address TEXT,
  customer_gst TEXT,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  item_discount NUMERIC(10,2) DEFAULT 0,
  bill_discount NUMERIC(10,2) DEFAULT 0,
  bill_discount_pct NUMERIC(5,2) DEFAULT 0,
  gst_amount NUMERIC(10,2) DEFAULT 0,
  cgst_amount NUMERIC(10,2) DEFAULT 0,
  sgst_amount NUMERIC(10,2) DEFAULT 0,
  igst_amount NUMERIC(10,2) DEFAULT 0,
  round_off NUMERIC(5,2) DEFAULT 0,
  grand_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(10,2) DEFAULT 0,
  due_amount NUMERIC(10,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'DUE' CHECK (payment_status IN ('PAID', 'PARTIAL', 'DUE', 'REFUNDED', 'EXCHANGED', 'CANCELLED')),
  checkout_type TEXT DEFAULT 'OFFLINE' CHECK (checkout_type IN ('OFFLINE', 'ONLINE')),
  biller_name TEXT,
  notes TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, bill_number)
);

-- ============================================================
-- 11. BILL ITEMS
-- ============================================================
CREATE TABLE bill_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  bill_id UUID REFERENCES bills(id) ON DELETE CASCADE NOT NULL,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  barcode TEXT,
  product_name TEXT NOT NULL,
  category TEXT,
  size TEXT,
  color TEXT,
  hsn_code TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  mrp NUMERIC(10,2) DEFAULT 0,
  discount_pct NUMERIC(5,2) DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  gst_rate NUMERIC(5,2) DEFAULT 0,
  gst_amount NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_custom_item BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 12. PAYMENTS
-- ============================================================
CREATE TABLE payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  bill_id UUID REFERENCES bills(id) ON DELETE CASCADE NOT NULL,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'Cash',
  payment_type TEXT DEFAULT 'SALE' CHECK (payment_type IN ('SALE', 'DUE_COLLECTION', 'REFUND')),
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 13. RETURNS
-- ============================================================
CREATE TABLE returns (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  return_number TEXT NOT NULL,
  original_bill_id UUID REFERENCES bills(id) ON DELETE SET NULL,
  original_bill_number TEXT,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  refund_amount NUMERIC(10,2) DEFAULT 0,
  refund_method TEXT DEFAULT 'Cash',
  reason TEXT,
  notes TEXT,
  status TEXT DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'CANCELLED')),
  biller_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE return_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  return_id UUID REFERENCES returns(id) ON DELETE CASCADE NOT NULL,
  bill_item_id UUID REFERENCES bill_items(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  barcode TEXT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- ============================================================
-- 14. EXCHANGES
-- ============================================================
CREATE TABLE exchanges (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  exchange_number TEXT NOT NULL,
  original_bill_id UUID REFERENCES bills(id) ON DELETE SET NULL,
  original_bill_number TEXT,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  returned_value NUMERIC(10,2) DEFAULT 0,
  new_items_value NUMERIC(10,2) DEFAULT 0,
  price_difference NUMERIC(10,2) DEFAULT 0,
  payment_method TEXT DEFAULT 'Cash',
  reason TEXT,
  notes TEXT,
  biller_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE exchange_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  exchange_id UUID REFERENCES exchanges(id) ON DELETE CASCADE NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('RETURNED', 'NEW')),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  barcode TEXT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- ============================================================
-- 15. ACTIVITY LOGS
-- ============================================================
CREATE TABLE activity_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  shop_id UUID REFERENCES shops(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  entity_label TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX idx_products_shop_id ON products(shop_id);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_name ON products USING gin(to_tsvector('english', name));
CREATE INDEX idx_bills_shop_id ON bills(shop_id);
CREATE INDEX idx_bills_customer_id ON bills(customer_id);
CREATE INDEX idx_bills_created_at ON bills(created_at DESC);
CREATE INDEX idx_bills_payment_status ON bills(payment_status);
CREATE INDEX idx_bill_items_bill_id ON bill_items(bill_id);
CREATE INDEX idx_bill_items_product_id ON bill_items(product_id);
CREATE INDEX idx_customers_shop_id ON customers(shop_id);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_payments_bill_id ON payments(bill_id);
CREATE INDEX idx_inventory_movements_product_id ON inventory_movements(product_id);
CREATE INDEX idx_inventory_movements_shop_id ON inventory_movements(shop_id);
CREATE INDEX idx_inventory_movements_created_at ON inventory_movements(created_at DESC);
CREATE INDEX idx_returns_shop_id ON returns(shop_id);
CREATE INDEX idx_exchanges_shop_id ON exchanges(shop_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function: get next bill number (atomic)
CREATE OR REPLACE FUNCTION get_next_bill_number(p_shop_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next BIGINT;
  v_prefix TEXT;
  v_bill_number TEXT;
BEGIN
  -- Atomic increment
  UPDATE bill_sequences
  SET last_number = last_number + 1, updated_at = NOW()
  WHERE shop_id = p_shop_id
  RETURNING last_number INTO v_next;

  IF NOT FOUND THEN
    INSERT INTO bill_sequences(shop_id, last_number)
    VALUES (p_shop_id, 1)
    RETURNING last_number INTO v_next;
  END IF;

  SELECT bill_prefix INTO v_prefix FROM shops WHERE id = p_shop_id;
  v_bill_number := v_prefix || '-' || LPAD(v_next::TEXT, 6, '0');
  RETURN v_bill_number;
END;
$$;

-- Function: get next barcode (atomic)
CREATE OR REPLACE FUNCTION get_next_barcode(p_shop_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next BIGINT;
  v_prefix TEXT;
  v_barcode TEXT;
BEGIN
  UPDATE barcode_sequences
  SET last_number = last_number + 1, updated_at = NOW()
  WHERE shop_id = p_shop_id
  RETURNING last_number INTO v_next;

  IF NOT FOUND THEN
    INSERT INTO barcode_sequences(shop_id, last_number)
    VALUES (p_shop_id, 1)
    RETURNING last_number INTO v_next;
  END IF;

  SELECT barcode_prefix INTO v_prefix FROM shops WHERE id = p_shop_id;
  v_barcode := v_prefix || '-' || LPAD(v_next::TEXT, 6, '0');
  RETURN v_barcode;
END;
$$;

-- Function: reset bill sequence
CREATE OR REPLACE FUNCTION reset_bill_sequence(p_shop_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE bill_sequences SET last_number = 0, updated_at = NOW() WHERE shop_id = p_shop_id;
END;
$$;

-- Function: reset barcode sequence
CREATE OR REPLACE FUNCTION reset_barcode_sequence(p_shop_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE barcode_sequences SET last_number = 0, updated_at = NOW() WHERE shop_id = p_shop_id;
END;
$$;

-- Trigger: update updated_at automatically
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_shops_updated_at BEFORE UPDATE ON shops FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_shop_settings_updated_at BEFORE UPDATE ON shop_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_bills_updated_at BEFORE UPDATE ON bills FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE barcode_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: user can only see their own
CREATE POLICY "profiles_own" ON profiles FOR ALL USING (id = auth.uid());

-- Shops: owner sees their shops
CREATE POLICY "shops_owner" ON shops FOR ALL USING (owner_id = auth.uid());

-- All shop-scoped tables: user must own the shop
CREATE POLICY "shop_settings_owner" ON shop_settings FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

CREATE POLICY "bill_sequences_owner" ON bill_sequences FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

CREATE POLICY "barcode_sequences_owner" ON barcode_sequences FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

CREATE POLICY "suppliers_owner" ON suppliers FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

CREATE POLICY "products_owner" ON products FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

CREATE POLICY "inventory_movements_owner" ON inventory_movements FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

CREATE POLICY "customers_owner" ON customers FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

CREATE POLICY "bills_owner" ON bills FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

CREATE POLICY "bill_items_owner" ON bill_items FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

CREATE POLICY "payments_owner" ON payments FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

CREATE POLICY "returns_owner" ON returns FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

CREATE POLICY "return_items_owner" ON return_items FOR ALL
  USING (return_id IN (SELECT id FROM returns WHERE shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid())));

CREATE POLICY "exchanges_owner" ON exchanges FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

CREATE POLICY "exchange_items_owner" ON exchange_items FOR ALL
  USING (exchange_id IN (SELECT id FROM exchanges WHERE shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid())));

CREATE POLICY "activity_logs_owner" ON activity_logs FOR ALL
  USING (user_id = auth.uid());

-- ============================================================
-- SEED: Insert initial setup function
-- After user signs up, call this to create shops + settings
-- ============================================================
CREATE OR REPLACE FUNCTION setup_initial_shops(p_user_id UUID, p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_shop1_id UUID;
  v_shop2_id UUID;
BEGIN
  -- Insert profile
  INSERT INTO profiles(id, email, full_name, role)
  VALUES (p_user_id, p_email, 'Owner', 'owner')
  ON CONFLICT (id) DO NOTHING;

  -- Create Shop 1
  INSERT INTO shops(owner_id, name, display_name, bill_prefix, barcode_prefix,
    phone, whatsapp, address)
  VALUES (p_user_id, 'NANDARANI BASTRALAY', 'NANDARANI BASTRALAY', 'NB', 'NB',
    '9933426708', '6296240320', '')
  RETURNING id INTO v_shop1_id;

  -- Create Shop 2
  INSERT INTO shops(owner_id, name, display_name, bill_prefix, barcode_prefix,
    phone, whatsapp, address)
  VALUES (p_user_id, 'NEW NANDARANI BASTRALAY', 'NEW NANDARANI BASTRALAY', 'NBN', 'NBN',
    '9933426708', '6296240320', '')
  RETURNING id INTO v_shop2_id;

  -- Settings for shop 1
  INSERT INTO shop_settings(shop_id) VALUES (v_shop1_id);
  INSERT INTO shop_settings(shop_id) VALUES (v_shop2_id);

  -- Sequences
  INSERT INTO bill_sequences(shop_id, last_number) VALUES (v_shop1_id, 0);
  INSERT INTO bill_sequences(shop_id, last_number) VALUES (v_shop2_id, 0);
  INSERT INTO barcode_sequences(shop_id, last_number) VALUES (v_shop1_id, 0);
  INSERT INTO barcode_sequences(shop_id, last_number) VALUES (v_shop2_id, 0);
END;
$$;
