// ============================================================
// NANDARANI POS — Complete TypeScript Types
// ============================================================

export type UserRole = 'owner' | 'manager' | 'biller'
export type Gender = 'Men' | 'Women' | 'Kids' | 'Unisex' | ''
export type PaymentStatus = 'PAID' | 'PARTIAL' | 'DUE' | 'REFUNDED' | 'EXCHANGED' | 'CANCELLED'
export type BillType = 'NORMAL' | 'GST'
export type CheckoutType = 'OFFLINE' | 'ONLINE'
export type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN_IN' | 'EXCHANGE_IN' | 'EXCHANGE_OUT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'PURCHASE'
export type ReferenceType = 'BILL' | 'RETURN' | 'EXCHANGE' | 'MANUAL' | 'PURCHASE' | 'TRANSFER'
export type PaymentType = 'SALE' | 'DUE_COLLECTION' | 'REFUND'
export type ExchangeItemType = 'RETURNED' | 'NEW'

// ============================================================
// DB Entities
// ============================================================

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Shop {
  id: string
  owner_id: string
  name: string
  display_name: string | null
  bill_prefix: string
  barcode_prefix: string
  address: string | null
  pincode: string | null
  phone: string | null
  whatsapp: string | null
  gst_number: string | null
  upi_id: string | null
  upi_name: string | null
  logo_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ShopSettings {
  id: string
  shop_id: string
  default_gst_rate: number
  default_discount: number
  low_stock_limit: number
  bill_footer: string
  return_policy: string
  biller_names: string[]
  payment_methods: string[]
  show_mrp_on_bill: boolean
  round_off_bill: boolean
  enable_gst: boolean
  thermal_width_mm: number
  currency_symbol: string
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  shop_id: string
  barcode: string
  name: string
  category: string | null
  sub_category: string | null
  brand: string | null
  size: string | null
  color: string | null
  gender: Gender
  fabric: string | null
  purchase_price: number
  selling_price: number
  mrp: number
  discount_pct: number
  gst_rate: number
  hsn_code: string | null
  stock_quantity: number
  low_stock_limit: number
  supplier_id: string | null
  supplier_name: string | null
  image_url: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface InventoryMovement {
  id: string
  shop_id: string
  product_id: string
  movement_type: MovementType
  quantity: number
  quantity_before: number
  quantity_after: number
  reference_type: ReferenceType | null
  reference_id: string | null
  reference_number: string | null
  notes: string | null
  biller_name: string | null
  created_at: string
  product?: Product
}

export interface Customer {
  id: string
  shop_id: string
  name: string
  phone: string | null
  whatsapp: string | null
  address: string | null
  gst_number: string | null
  total_purchase: number
  total_due: number
  last_purchase_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Bill {
  id: string
  shop_id: string
  bill_number: string
  bill_type: BillType
  customer_id: string | null
  customer_name: string | null
  customer_phone: string | null
  customer_whatsapp: string | null
  customer_address: string | null
  customer_gst: string | null
  subtotal: number
  item_discount: number
  bill_discount: number
  bill_discount_pct: number
  gst_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  round_off: number
  grand_total: number
  paid_amount: number
  due_amount: number
  payment_status: PaymentStatus
  checkout_type: CheckoutType
  biller_name: string | null
  notes: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
  bill_items?: BillItem[]
  payments?: Payment[]
}

export interface BillItem {
  id: string
  bill_id: string
  shop_id: string
  product_id: string | null
  barcode: string | null
  product_name: string
  category: string | null
  size: string | null
  color: string | null
  hsn_code: string | null
  quantity: number
  unit_price: number
  mrp: number
  discount_pct: number
  discount_amount: number
  gst_rate: number
  gst_amount: number
  total_amount: number
  is_custom_item: boolean
  created_at: string
}

export interface Payment {
  id: string
  bill_id: string
  shop_id: string
  customer_id: string | null
  amount: number
  payment_method: string
  payment_type: PaymentType
  reference_number: string | null
  notes: string | null
  created_at: string
}

export interface Return {
  id: string
  shop_id: string
  return_number: string
  original_bill_id: string | null
  original_bill_number: string | null
  customer_id: string | null
  customer_name: string | null
  refund_amount: number
  refund_method: string
  reason: string | null
  notes: string | null
  status: 'COMPLETED' | 'CANCELLED'
  biller_name: string | null
  created_at: string
  return_items?: ReturnItem[]
}

export interface ReturnItem {
  id: string
  return_id: string
  bill_item_id: string | null
  product_id: string | null
  barcode: string | null
  product_name: string
  quantity: number
  unit_price: number
  total_amount: number
}

export interface Exchange {
  id: string
  shop_id: string
  exchange_number: string
  original_bill_id: string | null
  original_bill_number: string | null
  customer_id: string | null
  customer_name: string | null
  returned_value: number
  new_items_value: number
  price_difference: number
  payment_method: string
  reason: string | null
  notes: string | null
  biller_name: string | null
  created_at: string
  exchange_items?: ExchangeItem[]
}

export interface ExchangeItem {
  id: string
  exchange_id: string
  item_type: ExchangeItemType
  product_id: string | null
  barcode: string | null
  product_name: string
  quantity: number
  unit_price: number
  total_amount: number
}

export interface Supplier {
  id: string
  shop_id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  gst_number: string | null
  notes: string | null
  created_at: string
}

export interface ActivityLog {
  id: string
  user_id: string | null
  shop_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  entity_label: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

// ============================================================
// POS Cart Types
// ============================================================

export interface CartItem {
  id: string // temp UUID for cart
  product_id: string | null
  barcode: string
  product_name: string
  category: string
  size: string
  color: string
  hsn_code: string
  quantity: number
  unit_price: number
  mrp: number
  discount_pct: number
  discount_amount: number
  gst_rate: number
  gst_amount: number
  total_amount: number
  stock_quantity: number // available stock
  is_custom_item: boolean
  image_url?: string
}

export interface CartTotals {
  subtotal: number
  item_discount: number
  bill_discount: number
  gst_amount: number
  cgst_amount: number
  sgst_amount: number
  round_off: number
  grand_total: number
  paid_amount: number
  due_amount: number
}

export interface POSState {
  shop_id: string
  bill_type: BillType
  checkout_type: CheckoutType
  customer: Partial<Customer> | null
  cart: CartItem[]
  bill_discount_pct: number
  bill_discount_amount: number
  payment_method: string
  additional_payment_method: string
  paid_amount: number
  biller_name: string
  notes: string
}

// ============================================================
// Form Types
// ============================================================

export interface ProductFormData {
  name: string
  category: string
  sub_category: string
  brand: string
  size: string
  color: string
  gender: Gender
  fabric: string
  purchase_price: number
  selling_price: number
  mrp: number
  discount_pct: number
  gst_rate: number
  hsn_code: string
  stock_quantity: number
  low_stock_limit: number
  supplier_name: string
  image_url: string
  notes: string
}

export interface CustomerFormData {
  name: string
  phone: string
  whatsapp: string
  address: string
  gst_number: string
  notes: string
}

export interface ShopSettingsFormData {
  name: string
  display_name: string
  address: string
  pincode: string
  phone: string
  whatsapp: string
  gst_number: string
  upi_id: string
  upi_name: string
  bill_prefix: string
  barcode_prefix: string
  default_gst_rate: number
  default_discount: number
  low_stock_limit: number
  bill_footer: string
  return_policy: string
  biller_names: string[]
  payment_methods: string[]
  round_off_bill: boolean
  enable_gst: boolean
  show_mrp_on_bill: boolean
  logo_url: string
}

// ============================================================
// Dashboard Analytics Types
// ============================================================

export interface DashboardStats {
  today_sales: number
  today_bills: number
  monthly_sales: number
  monthly_bills: number
  total_revenue: number
  total_due: number
  total_products: number
  low_stock_count: number
  total_customers: number
}

export interface SalesTrend {
  date: string
  amount: number
  bills: number
}

export interface TopProduct {
  product_id: string
  product_name: string
  barcode: string
  total_qty: number
  total_amount: number
}

// ============================================================
// Report Types
// ============================================================

export type ReportPeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'

export interface ReportFilter {
  period: ReportPeriod
  from_date: string
  to_date: string
  shop_id: string
}

// ============================================================
// Phase 1 — Purchase & Transfer Types
// ============================================================

export interface PurchaseInvoice {
  id: string
  shop_id: string
  supplier_id: string | null
  supplier_name: string
  invoice_number: string | null
  invoice_date: string
  total_items: number
  total_quantity: number
  total_cost: number
  notes: string | null
  biller_name: string | null
  created_at: string
  purchase_items?: PurchaseItem[]
}

export interface PurchaseItem {
  id: string
  purchase_invoice_id: string
  shop_id: string
  product_id: string | null
  barcode: string | null
  product_name: string
  quantity: number
  unit_cost: number
  selling_price: number
  mrp: number
  total_cost: number
}

export interface StockTransfer {
  id: string
  transfer_number: string
  from_shop_id: string
  to_shop_id: string
  status: 'COMPLETED' | 'CANCELLED'
  notes: string | null
  biller_name: string | null
  created_at: string
  stock_transfer_items?: StockTransferItem[]
}

export interface StockTransferItem {
  id: string
  transfer_id: string
  product_id: string | null
  barcode: string | null
  product_name: string
  quantity: number
  unit_cost: number
}

// ============================================================
// Phase 2 — Hold Bill, Quotation Types
// ============================================================

export type QuotationStatus = 'DRAFT' | 'SENT' | 'CONVERTED' | 'CANCELLED'

export interface HeldBill {
  id: string
  shop_id: string
  label: string | null
  cart: import('./index').CartItem[]
  customer: Partial<import('./index').Customer> | null
  customer_form: {
    name: string
    phone: string
    whatsapp: string
    address: string
    gst_number: string
  } | null
  bill_type: import('./index').BillType
  checkout_type: import('./index').CheckoutType
  bill_discount_pct: number
  bill_discount_amount: number
  payment_method: string
  payment_mode: string
  paid_amount: number
  biller_name: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Quotation {
  id: string
  shop_id: string
  quotation_number: string
  status: QuotationStatus
  converted_bill_id: string | null
  customer_id: string | null
  customer_name: string | null
  customer_phone: string | null
  customer_whatsapp: string | null
  customer_address: string | null
  customer_gst: string | null
  bill_type: import('./index').BillType
  subtotal: number
  item_discount: number
  bill_discount: number
  bill_discount_pct: number
  gst_amount: number
  grand_total: number
  valid_days: number
  notes: string | null
  biller_name: string | null
  created_at: string
  updated_at: string
  quotation_items?: QuotationItem[]
}

export interface QuotationItem {
  id: string
  quotation_id: string
  shop_id: string
  product_id: string | null
  barcode: string | null
  product_name: string
  category: string | null
  size: string | null
  color: string | null
  hsn_code: string | null
  quantity: number
  unit_price: number
  mrp: number
  discount_pct: number
  discount_amount: number
  gst_rate: number
  gst_amount: number
  total_amount: number
  is_custom_item: boolean
}

// Split payment entry used in checkout
export interface SplitPaymentEntry {
  method: string
  amount: number
}
