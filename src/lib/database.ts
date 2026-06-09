// ============================================================
// NANDARANI POS — Database Helpers (Supabase)
// ============================================================
import { supabase } from './supabase'
import type {
  Product, Customer, Bill, BillItem, Payment, Return, ReturnItem,
  Exchange, ExchangeItem, InventoryMovement, CartItem, DashboardStats,
  SalesTrend, TopProduct, Shop, ShopSettings, Supplier, ActivityLog,
  PurchaseInvoice, PurchaseItem, StockTransfer, StockTransferItem,
  HeldBill, Quotation, QuotationItem
} from '../types'

// ============================================================
// ERROR HELPER
// Supabase PostgrestError is NOT instanceof Error — extract message safely
// ============================================================
export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'object' && e !== null) {
    const obj = e as Record<string, unknown>
    if (typeof obj['message'] === 'string') return obj['message']
    if (typeof obj['details'] === 'string') return obj['details']
  }
  return 'An unknown error occurred'
}

// ============================================================
// AUTH
// ============================================================
export const auth = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  },
  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    // Setup initial shops for new user
    if (data.user) {
      await supabase.rpc('setup_initial_shops', {
        p_user_id: data.user.id,
        p_email: email,
      })
    }
    return data
  },
  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },
  async getSession() {
    const { data } = await supabase.auth.getSession()
    return data.session
  },
  onAuthStateChange(callback: Parameters<typeof supabase.auth.onAuthStateChange>[0]) {
    return supabase.auth.onAuthStateChange(callback)
  },
}

// ============================================================
// SHOPS
// ============================================================
export const shops = {
  async getByUser(userId: string): Promise<Shop[]> {
    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .eq('owner_id', userId)
      .eq('is_active', true)
      .order('created_at')
    if (error) throw error

    // Auto-create default shops if none exist
    if (!data || data.length === 0) {
      return shops.createDefaultShops(userId)
    }
    return data
  },

  async createDefaultShops(userId: string): Promise<Shop[]> {
    const defaultShops = [
      {
        owner_id: userId,
        name: 'NANDARANI BASTRALAY',
        display_name: 'Nandarani Bastralay',
        bill_prefix: 'NB',
        barcode_prefix: 'NB',
        phone: '9933426708',
        whatsapp: '6296240320',
        is_active: true,
      },
      {
        owner_id: userId,
        name: 'NEW NANDARANI BASTRALAY',
        display_name: 'New Nandarani Bastralay',
        bill_prefix: 'NBN',
        barcode_prefix: 'NBN',
        phone: '9933426708',
        whatsapp: '6296240320',
        is_active: true,
      },
    ]

    const created: Shop[] = []
    for (const shopData of defaultShops) {
      // Upsert shop by bill_prefix (unique) — safe for retries
      const { data: shop, error: shopErr } = await supabase
        .from('shops')
        .upsert(shopData, { onConflict: 'bill_prefix', ignoreDuplicates: false })
        .select()
        .single()
      if (shopErr) throw shopErr
      created.push(shop)

      // Insert default settings (upsert — safe for retries)
      await supabase.from('shop_settings').upsert({
        shop_id: shop.id,
        default_gst_rate: 5,
        default_discount: 0,
        low_stock_limit: 5,
        bill_footer: 'Thank you for shopping with us!',
        return_policy: 'Exchange within 7 days with bill.',
        biller_names: [],
        payment_methods: ['CASH', 'UPI'],
        show_mrp_on_bill: true,
        round_off_bill: true,
        enable_gst: false,
        thermal_width_mm: 80,
        currency_symbol: '₹',
      })

      // Insert bill sequence (ON CONFLICT DO NOTHING — safe for retries)
      await supabase.from('bill_sequences').upsert(
        { shop_id: shop.id, last_number: 0 },
        { onConflict: 'shop_id', ignoreDuplicates: true }
      )

      // Insert barcode sequence
      await supabase.from('barcode_sequences').upsert(
        { shop_id: shop.id, last_number: 0 },
        { onConflict: 'shop_id', ignoreDuplicates: true }
      )
    }
    return created
  },

  async update(shopId: string, updates: Partial<Shop>): Promise<Shop> {
    const { data, error } = await supabase
      .from('shops')
      .update(updates)
      .eq('id', shopId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getSettings(shopId: string): Promise<ShopSettings | null> {
    const { data, error } = await supabase
      .from('shop_settings')
      .select('*')
      .eq('shop_id', shopId)
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  async updateSettings(shopId: string, updates: Partial<ShopSettings>): Promise<ShopSettings> {
    const { data, error } = await supabase
      .from('shop_settings')
      .update(updates)
      .eq('shop_id', shopId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async resetBillSequence(shopId: string): Promise<void> {
    const { error } = await supabase.rpc('reset_bill_sequence', { p_shop_id: shopId })
    if (error) throw error
  },

  async resetBarcodeSequence(shopId: string): Promise<void> {
    const { error } = await supabase.rpc('reset_barcode_sequence', { p_shop_id: shopId })
    if (error) throw error
  },

  async getNextBarcode(shopId: string): Promise<string> {
    const { data, error } = await supabase.rpc('get_next_barcode', { p_shop_id: shopId })
    if (error) throw error
    return data as string
  },
}

// ============================================================
// PRODUCTS
// ============================================================
export const products = {
  async list(shopId: string, opts?: { search?: string; category?: string; lowStock?: boolean; limit?: number; offset?: number }): Promise<{ data: Product[]; count: number }> {
    // When lowStock filter is on, fetch all matching products then filter client-side
    // (PostgREST cannot compare two columns in a simple filter call)
    if (opts?.lowStock) {
      let q = supabase
        .from('products')
        .select('*')
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .order('stock_quantity')
      if (opts?.search) q = q.or(`name.ilike.%${opts.search}%,barcode.ilike.%${opts.search}%,brand.ilike.%${opts.search}%`)
      if (opts?.category) q = q.eq('category', opts.category)
      const { data, error } = await q
      if (error) throw error
      const filtered = (data || []).filter(p => p.stock_quantity <= p.low_stock_limit)
      const from = opts?.offset ?? 0
      const limit = opts?.limit ?? 50
      return { data: filtered.slice(from, from + limit), count: filtered.length }
    }

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('shop_id', shopId)
      .eq('is_active', true)

    if (opts?.search) {
      query = query.or(`name.ilike.%${opts.search}%,barcode.ilike.%${opts.search}%,brand.ilike.%${opts.search}%`)
    }
    if (opts?.category) query = query.eq('category', opts.category)

    const from = opts?.offset ?? 0
    const to = from + (opts?.limit ?? 50) - 1
    query = query.order('created_at', { ascending: false }).range(from, to)

    const { data, error, count } = await query
    if (error) throw error
    return { data: data || [], count: count || 0 }
  },

  async getLowStock(shopId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .order('stock_quantity')
    if (error) throw error
    return (data || []).filter(p => p.stock_quantity <= p.low_stock_limit)
  },

  async getByBarcode(shopId: string, barcode: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', shopId)
      .eq('barcode', barcode)
      .eq('is_active', true)
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  async getById(id: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  async create(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id: string, updates: Partial<Product>): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id)
    if (error) throw error
  },

  async adjustStock(productId: string, shopId: string, delta: number, movementType: string, refType: string, refId: string | null, refNumber: string | null, notes: string, billerName: string): Promise<Product> {
    // Get current stock
    const { data: product, error: fetchErr } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', productId)
      .single()
    if (fetchErr) throw fetchErr

    const before = product.stock_quantity
    const after = Math.max(0, before + delta)

    const { data: updated, error: updateErr } = await supabase
      .from('products')
      .update({ stock_quantity: after })
      .eq('id', productId)
      .select()
      .single()
    if (updateErr) throw updateErr

    // Log movement
    await supabase.from('inventory_movements').insert({
      shop_id: shopId,
      product_id: productId,
      movement_type: movementType,
      quantity: Math.abs(delta),
      quantity_before: before,
      quantity_after: after,
      reference_type: refType,
      reference_id: refId,
      reference_number: refNumber,
      notes,
      biller_name: billerName,
    })

    return updated
  },

  async getCategories(shopId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('products')
      .select('category')
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .not('category', 'is', null)
    if (error) throw error
    return [...new Set((data || []).map(p => p.category).filter(Boolean) as string[])]
  },

  async getInventoryMovements(productId: string): Promise<InventoryMovement[]> {
    const { data, error } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return data || []
  },
}

// ============================================================
// CUSTOMERS
// ============================================================
export const customers = {
  async list(shopId: string, search?: string): Promise<Customer[]> {
    let query = supabase
      .from('customers')
      .select('*')
      .eq('shop_id', shopId)
      .order('name')

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  async getById(id: string): Promise<Customer | null> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  async findByPhone(shopId: string, phone: string): Promise<Customer | null> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', shopId)
      .eq('phone', phone)
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  async create(customer: Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'total_purchase' | 'total_due' | 'last_purchase_date'>): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .insert(customer)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async upsertByPhone(shopId: string, customerData: Partial<Customer>): Promise<Customer> {
    const existing = customerData.phone ? await customers.findByPhone(shopId, customerData.phone) : null
    if (existing) {
      const { data, error } = await supabase
        .from('customers')
        .update({ ...customerData, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw error
      return data
    }
    return customers.create({ shop_id: shopId, name: 'Customer', ...customerData } as Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'total_purchase' | 'total_due' | 'last_purchase_date'>)
  },

  async update(id: string, updates: Partial<Customer>): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('customers').delete().eq('id', id)
    if (error) throw error
  },

  async updateTotals(id: string, purchaseAmount: number, dueAmount: number): Promise<void> {
    // Direct update with increments — safe and always works
    const { data: c } = await supabase
      .from('customers')
      .select('total_purchase, total_due')
      .eq('id', id)
      .single()
    if (c) {
      await supabase.from('customers').update({
        total_purchase: (c.total_purchase || 0) + purchaseAmount,
        total_due: Math.max(0, (c.total_due || 0) + dueAmount),
        last_purchase_date: new Date().toISOString(),
      }).eq('id', id)
    }
  },

  async getBills(customerId: string): Promise<Bill[]> {
    const { data, error } = await supabase
      .from('bills')
      .select('*, bill_items(*), payments(*)')
      .eq('customer_id', customerId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },
}

// ============================================================
// BILLS
// ============================================================
export const bills = {
  async list(shopId: string, opts?: {
    search?: string
    status?: string
    from?: string
    to?: string
    limit?: number
    offset?: number
  }): Promise<{ data: Bill[]; count: number }> {
    let query = supabase
      .from('bills')
      .select('*, bill_items(*), payments(*)', { count: 'exact' })
      .eq('shop_id', shopId)
      .eq('is_deleted', false)

    if (opts?.search) {
      query = query.or(`bill_number.ilike.%${opts.search}%,customer_name.ilike.%${opts.search}%,customer_phone.ilike.%${opts.search}%`)
    }
    if (opts?.status) query = query.eq('payment_status', opts.status)
    if (opts?.from) query = query.gte('created_at', opts.from)
    if (opts?.to) query = query.lte('created_at', opts.to)

    const from = opts?.offset ?? 0
    const to = from + (opts?.limit ?? 50) - 1
    query = query.order('created_at', { ascending: false }).range(from, to)

    const { data, error, count } = await query
    if (error) throw error
    return { data: data || [], count: count || 0 }
  },

  async getById(id: string): Promise<Bill | null> {
    const { data, error } = await supabase
      .from('bills')
      .select('*, bill_items(*), payments(*)')
      .eq('id', id)
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  async getByNumber(shopId: string, billNumber: string): Promise<Bill | null> {
    const { data, error } = await supabase
      .from('bills')
      .select('*, bill_items(*), payments(*)')
      .eq('shop_id', shopId)
      .eq('bill_number', billNumber)
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  async getDue(shopId: string): Promise<Bill[]> {
    const { data, error } = await supabase
      .from('bills')
      .select('*, bill_items(*), payments(*)')
      .eq('shop_id', shopId)
      .eq('is_deleted', false)
      .in('payment_status', ['DUE', 'PARTIAL'])
      .order('created_at', { ascending: true })
    if (error) throw error
    return data || []
  },

  async checkout(
    shopId: string,
    billData: Omit<Bill, 'id' | 'bill_number' | 'created_at' | 'updated_at'>,
    items: CartItem[],
    paymentMethod: string,
    paidAmount: number,
    billerName: string,
    splitPayments?: { method: string; amount: number }[]
  ): Promise<Bill> {
    // Get next bill number (atomic)
    const { data: billNumData, error: billNumErr } = await supabase.rpc('get_next_bill_number', { p_shop_id: shopId })
    if (billNumErr) throw billNumErr
    const billNumber = billNumData as string

    // Insert bill
    const { data: bill, error: billErr } = await supabase
      .from('bills')
      .insert({ ...billData, bill_number: billNumber, shop_id: shopId })
      .select()
      .single()
    if (billErr) throw billErr

    // Insert bill items
    const billItems = items.map(item => ({
      bill_id: bill.id,
      shop_id: shopId,
      product_id: item.product_id,
      barcode: item.barcode,
      product_name: item.product_name,
      category: item.category,
      size: item.size,
      color: item.color,
      hsn_code: item.hsn_code,
      quantity: item.quantity,
      unit_price: item.unit_price,
      mrp: item.mrp,
      discount_pct: item.discount_pct,
      discount_amount: item.discount_amount,
      gst_rate: item.gst_rate,
      gst_amount: item.gst_amount,
      total_amount: item.total_amount,
      is_custom_item: item.is_custom_item,
    }))

    const { error: itemsErr } = await supabase.from('bill_items').insert(billItems)
    if (itemsErr) throw itemsErr

    // Insert payment records — split or single
    const paymentRows = splitPayments && splitPayments.length > 0
      ? splitPayments.filter(p => p.amount > 0).map(p => ({
          bill_id: bill.id,
          shop_id: shopId,
          customer_id: billData.customer_id,
          amount: p.amount,
          payment_method: p.method,
          payment_type: 'SALE' as const,
        }))
      : paidAmount > 0
        ? [{
            bill_id: bill.id,
            shop_id: shopId,
            customer_id: billData.customer_id,
            amount: paidAmount,
            payment_method: paymentMethod,
            payment_type: 'SALE' as const,
          }]
        : []

    if (paymentRows.length > 0) {
      const { error: payErr } = await supabase.from('payments').insert(paymentRows)
      if (payErr) throw payErr
    }

    // Deduct stock for each item
    for (const item of items) {
      if (item.product_id && !item.is_custom_item) {
        await products.adjustStock(
          item.product_id, shopId, -item.quantity,
          'OUT', 'BILL', bill.id, billNumber, '', billerName
        )
      }
    }

    // Update customer totals
    if (billData.customer_id) {
      await customers.updateTotals(billData.customer_id, billData.grand_total, billData.due_amount)
    }

    return bill
  },

  async markPaid(billId: string, amount: number, paymentMethod: string, shopId: string, customerId: string | null): Promise<void> {
    const { data: bill } = await supabase.from('bills').select('due_amount, paid_amount, grand_total').eq('id', billId).single()
    if (!bill) throw new Error('Bill not found')

    const newPaid = bill.paid_amount + amount
    const newDue = Math.max(0, bill.due_amount - amount)
    const newStatus = newDue <= 0 ? 'PAID' : 'PARTIAL'

    const { error } = await supabase.from('bills').update({
      paid_amount: newPaid,
      due_amount: newDue,
      payment_status: newStatus,
    }).eq('id', billId)
    if (error) throw error

    // Insert payment record
    await supabase.from('payments').insert({
      bill_id: billId,
      shop_id: shopId,
      customer_id: customerId,
      amount,
      payment_method: paymentMethod,
      payment_type: 'DUE_COLLECTION',
    })

    // Update customer due
    if (customerId) {
      const { data: c } = await supabase.from('customers').select('total_due').eq('id', customerId).single()
      if (c) {
        await supabase.from('customers').update({ total_due: Math.max(0, c.total_due - amount) }).eq('id', customerId)
      }
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('bills').update({ is_deleted: true }).eq('id', id)
    if (error) throw error
  },
}

// ============================================================
// RETURNS
// ============================================================
export const returns = {
  async list(shopId: string): Promise<Return[]> {
    const { data, error } = await supabase
      .from('returns')
      .select('*, return_items(*)')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  async create(
    shopId: string,
    returnData: { originalBillId: string; originalBillNumber: string; customerId: string | null; customerName: string; reason: string; refundMethod: string; billerName: string; notes: string },
    items: Omit<ReturnItem, 'id' | 'return_id'>[]
  ): Promise<Return> {
    const refundAmount = items.reduce((sum, i) => sum + i.total_amount, 0)

    const { data: ret, error } = await supabase
      .from('returns')
      .insert({
        shop_id: shopId,
        return_number: `RET-${Date.now()}`,
        original_bill_id: returnData.originalBillId,
        original_bill_number: returnData.originalBillNumber,
        customer_id: returnData.customerId,
        customer_name: returnData.customerName,
        refund_amount: refundAmount,
        refund_method: returnData.refundMethod,
        reason: returnData.reason,
        notes: returnData.notes,
        biller_name: returnData.billerName,
        status: 'COMPLETED',
      })
      .select()
      .single()
    if (error) throw error

    // Insert return items
    const retItems = items.map(i => ({ ...i, return_id: ret.id }))
    const { error: itemsErr } = await supabase.from('return_items').insert(retItems)
    if (itemsErr) throw itemsErr

    // Restore stock
    for (const item of items) {
      if (item.product_id) {
        await products.adjustStock(
          item.product_id, shopId, item.quantity,
          'RETURN_IN', 'RETURN', ret.id, ret.return_number, returnData.reason, returnData.billerName
        )
      }
    }

    // Update original bill status
    const { data: origBill } = await supabase.from('bills').select('payment_status').eq('id', returnData.originalBillId).single()
    if (origBill) {
      await supabase.from('bills').update({ payment_status: 'REFUNDED' }).eq('id', returnData.originalBillId)
    }

    return ret
  },
}

// ============================================================
// EXCHANGES
// ============================================================
export const exchanges = {
  async list(shopId: string): Promise<Exchange[]> {
    const { data, error } = await supabase
      .from('exchanges')
      .select('*, exchange_items(*)')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  async create(
    shopId: string,
    exchangeData: { originalBillId: string; originalBillNumber: string; customerId: string | null; customerName: string; reason: string; paymentMethod: string; billerName: string },
    returnedItems: Omit<ExchangeItem, 'id' | 'exchange_id'>[],
    newItems: Omit<ExchangeItem, 'id' | 'exchange_id'>[]
  ): Promise<Exchange> {
    const returnedValue = returnedItems.reduce((s, i) => s + i.total_amount, 0)
    const newItemsValue = newItems.reduce((s, i) => s + i.total_amount, 0)
    const diff = newItemsValue - returnedValue

    const { data: exc, error } = await supabase
      .from('exchanges')
      .insert({
        shop_id: shopId,
        exchange_number: `EXC-${Date.now()}`,
        original_bill_id: exchangeData.originalBillId,
        original_bill_number: exchangeData.originalBillNumber,
        customer_id: exchangeData.customerId,
        customer_name: exchangeData.customerName,
        returned_value: returnedValue,
        new_items_value: newItemsValue,
        price_difference: diff,
        payment_method: exchangeData.paymentMethod,
        reason: exchangeData.reason,
        biller_name: exchangeData.billerName,
      })
      .select()
      .single()
    if (error) throw error

    const allItems = [
      ...returnedItems.map(i => ({ ...i, exchange_id: exc.id, item_type: 'RETURNED' as const })),
      ...newItems.map(i => ({ ...i, exchange_id: exc.id, item_type: 'NEW' as const })),
    ]
    await supabase.from('exchange_items').insert(allItems)

    // Restore returned stock
    for (const item of returnedItems) {
      if (item.product_id) {
        await products.adjustStock(item.product_id, shopId, item.quantity, 'EXCHANGE_IN', 'EXCHANGE', exc.id, exc.exchange_number, '', exchangeData.billerName)
      }
    }
    // Deduct new items stock
    for (const item of newItems) {
      if (item.product_id) {
        await products.adjustStock(item.product_id, shopId, -item.quantity, 'EXCHANGE_OUT', 'EXCHANGE', exc.id, exc.exchange_number, '', exchangeData.billerName)
      }
    }

    await supabase.from('bills').update({ payment_status: 'EXCHANGED' }).eq('id', exchangeData.originalBillId)
    return exc
  },
}

// ============================================================
// DASHBOARD / ANALYTICS
// ============================================================
export const analytics = {
  async getDashboardStats(shopId: string): Promise<DashboardStats> {
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

    const [todayBills, monthBills, dueBills, totalProducts, lowStockProducts, totalCustomers] = await Promise.all([
      supabase.from('bills').select('grand_total').eq('shop_id', shopId).eq('is_deleted', false).gte('created_at', todayStart),
      supabase.from('bills').select('grand_total').eq('shop_id', shopId).eq('is_deleted', false).gte('created_at', monthStart),
      supabase.from('bills').select('due_amount').eq('shop_id', shopId).eq('is_deleted', false).in('payment_status', ['DUE', 'PARTIAL']),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('shop_id', shopId).eq('is_active', true),
      supabase.from('products').select('id, stock_quantity, low_stock_limit').eq('shop_id', shopId).eq('is_active', true),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('shop_id', shopId),
    ])

    const today_sales = (todayBills.data || []).reduce((s, b) => s + b.grand_total, 0)
    const today_count = (todayBills.data || []).length
    const monthly_sales = (monthBills.data || []).reduce((s, b) => s + b.grand_total, 0)
    const monthly_count = (monthBills.data || []).length
    const total_due = (dueBills.data || []).reduce((s, b) => s + b.due_amount, 0)
    const lowStockCount = (lowStockProducts.data || []).filter(p => p.stock_quantity <= p.low_stock_limit).length

    return {
      today_sales,
      today_bills: today_count,
      monthly_sales,
      monthly_bills: monthly_count,
      total_revenue: monthly_sales,
      total_due,
      total_products: totalProducts.count || 0,
      low_stock_count: lowStockCount,
      total_customers: totalCustomers.count || 0,
    }
  },

  async getSalesTrend(shopId: string, days = 30): Promise<SalesTrend[]> {
    const from = new Date()
    from.setDate(from.getDate() - days)

    const { data, error } = await supabase
      .from('bills')
      .select('created_at, grand_total')
      .eq('shop_id', shopId)
      .eq('is_deleted', false)
      .gte('created_at', from.toISOString())
      .order('created_at')

    if (error) throw error

    const map = new Map<string, SalesTrend>()
    for (const bill of data || []) {
      const date = bill.created_at.slice(0, 10)
      const existing = map.get(date) || { date, amount: 0, bills: 0 }
      existing.amount += bill.grand_total
      existing.bills += 1
      map.set(date, existing)
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  },

  async getTopProducts(shopId: string, limit = 5): Promise<TopProduct[]> {
    const { data, error } = await supabase
      .from('bill_items')
      .select('product_id, product_name, barcode, quantity, total_amount')
      .eq('shop_id', shopId)

    if (error) throw error

    const map = new Map<string, TopProduct>()
    for (const item of data || []) {
      if (!item.product_id) continue
      const existing = map.get(item.product_id) || {
        product_id: item.product_id,
        product_name: item.product_name,
        barcode: item.barcode || '',
        total_qty: 0,
        total_amount: 0,
      }
      existing.total_qty += item.quantity
      existing.total_amount += item.total_amount
      map.set(item.product_id, existing)
    }

    return Array.from(map.values())
      .sort((a, b) => b.total_amount - a.total_amount)
      .slice(0, limit)
  },

  async getRecentBills(shopId: string, limit = 10): Promise<Bill[]> {
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('shop_id', shopId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data || []
  },

  async getPaymentMethodBreakdown(shopId: string, from?: string, to?: string): Promise<{ method: string; amount: number; count: number }[]> {
    let query = supabase.from('payments').select('payment_method, amount').eq('shop_id', shopId)
    if (from) query = query.gte('created_at', from)
    if (to) query = query.lte('created_at', to)

    const { data, error } = await query
    if (error) throw error

    const map = new Map<string, { amount: number; count: number }>()
    for (const p of data || []) {
      const e = map.get(p.payment_method) || { amount: 0, count: 0 }
      e.amount += p.amount
      e.count += 1
      map.set(p.payment_method, e)
    }

    return Array.from(map.entries()).map(([method, { amount, count }]) => ({ method, amount, count }))
  },
}

// ============================================================
// SUPPLIERS
// ============================================================
export const suppliersDb = {
  async list(shopId: string): Promise<Supplier[]> {
    const { data, error } = await supabase.from('suppliers').select('*').eq('shop_id', shopId).order('name')
    if (error) throw error
    return data || []
  },
  async getById(id: string): Promise<Supplier | null> {
    const { data, error } = await supabase.from('suppliers').select('*').eq('id', id).single()
    if (error && error.code !== 'PGRST116') throw error
    return data
  },
  async create(supplier: Omit<Supplier, 'id' | 'created_at'>): Promise<Supplier> {
    const { data, error } = await supabase.from('suppliers').insert(supplier).select().single()
    if (error) throw error
    return data
  },
  async update(id: string, updates: Partial<Omit<Supplier, 'id' | 'shop_id' | 'created_at'>>): Promise<Supplier> {
    const { data, error } = await supabase.from('suppliers').update(updates).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('suppliers').delete().eq('id', id)
    if (error) throw error
  },
}

// ============================================================
// PURCHASE INVOICES
// ============================================================
export const purchaseInvoicesDb = {
  async list(shopId: string): Promise<(PurchaseInvoice & { purchase_items: PurchaseItem[] })[]> {
    const { data, error } = await supabase
      .from('purchase_invoices')
      .select('*, purchase_items(*)')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []) as (PurchaseInvoice & { purchase_items: PurchaseItem[] })[]
  },

  async create(
    shopId: string,
    invoiceData: { supplierId: string | null; supplierName: string; invoiceNumber: string; invoiceDate: string; notes: string; billerName: string },
    items: { productId: string | null; barcode: string; productName: string; quantity: number; unitCost: number; sellingPrice: number; mrp: number }[]
  ): Promise<PurchaseInvoice> {
    const totalCost = items.reduce((s, i) => s + i.quantity * i.unitCost, 0)
    const totalQty = items.reduce((s, i) => s + i.quantity, 0)

    // Create invoice
    const { data: invoice, error: invErr } = await supabase
      .from('purchase_invoices')
      .insert({
        shop_id: shopId,
        supplier_id: invoiceData.supplierId,
        supplier_name: invoiceData.supplierName,
        invoice_number: invoiceData.invoiceNumber || null,
        invoice_date: invoiceData.invoiceDate,
        total_items: items.length,
        total_quantity: totalQty,
        total_cost: totalCost,
        notes: invoiceData.notes || null,
        biller_name: invoiceData.billerName || null,
      })
      .select()
      .single()
    if (invErr) throw invErr

    // Create purchase items
    const purchaseItems = items.map(i => ({
      purchase_invoice_id: invoice.id,
      shop_id: shopId,
      product_id: i.productId,
      barcode: i.barcode,
      product_name: i.productName,
      quantity: i.quantity,
      unit_cost: i.unitCost,
      selling_price: i.sellingPrice,
      mrp: i.mrp,
      total_cost: i.quantity * i.unitCost,
    }))
    const { error: itemsErr } = await supabase.from('purchase_items').insert(purchaseItems)
    if (itemsErr) throw itemsErr

    // Increase stock + log movements
    for (const item of items) {
      if (item.productId) {
        await products.adjustStock(
          item.productId, shopId, item.quantity,
          'IN', 'PURCHASE', invoice.id,  // 'IN' = original constraint, 'PURCHASE' = reference_type
          invoiceData.invoiceNumber || `PI-${invoice.id.slice(0, 8)}`,
          `Purchase from ${invoiceData.supplierName}`,
          invoiceData.billerName
        )
        // Update purchase_price on product if cost provided
        if (item.unitCost > 0) {
          await supabase.from('products')
            .update({ purchase_price: item.unitCost })
            .eq('id', item.productId)
        }
      }
    }

    return invoice
  },
}

// ============================================================
// STOCK TRANSFERS
// ============================================================
export const stockTransfersDb = {
  async list(shopId: string): Promise<(StockTransfer & { stock_transfer_items: StockTransferItem[] })[]> {
    const { data, error } = await supabase
      .from('stock_transfers')
      .select('*, stock_transfer_items(*)')
      .or(`from_shop_id.eq.${shopId},to_shop_id.eq.${shopId}`)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []) as (StockTransfer & { stock_transfer_items: StockTransferItem[] })[]
  },

  async create(
    fromShopId: string,
    toShopId: string,
    // toProductId removed — function looks up / auto-creates in dest shop internally
    items: { fromProductId: string; barcode: string; productName: string; quantity: number; unitCost: number }[],
    notes: string,
    billerName: string
  ): Promise<StockTransfer> {
    const transferNumber = `TRF-${Date.now()}`

    const { data: transfer, error: tErr } = await supabase
      .from('stock_transfers')
      .insert({
        transfer_number: transferNumber,
        from_shop_id: fromShopId,
        to_shop_id: toShopId,
        status: 'COMPLETED',
        notes: notes || null,
        biller_name: billerName || null,
      })
      .select()
      .single()
    if (tErr) throw tErr

    // Save transfer line items (reference source product)
    const transferItems = items.map(i => ({
      transfer_id: transfer.id,
      product_id: i.fromProductId,
      barcode: i.barcode,
      product_name: i.productName,
      quantity: i.quantity,
      unit_cost: i.unitCost,
    }))
    const { error: itemsErr } = await supabase.from('stock_transfer_items').insert(transferItems)
    if (itemsErr) throw itemsErr

    for (const item of items) {
      // ── 1. Deduct from source shop ──
      // Use 'OUT' (original constraint value), reference_type 'MANUAL' (in original constraint)
      await products.adjustStock(
        item.fromProductId, fromShopId, -item.quantity,
        'OUT', 'MANUAL', transfer.id, transferNumber,
        `Transfer OUT → ${transferNumber}`, billerName
      )

      // ── 2. Find or auto-create product in destination shop ──
      let destProductId: string | null = null

      // Try to find by barcode in dest shop
      const { data: destExisting } = await supabase
        .from('products')
        .select('id')
        .eq('shop_id', toShopId)
        .eq('barcode', item.barcode)
        .eq('is_active', true)
        .single()

      if (destExisting) {
        destProductId = destExisting.id
      } else {
        // Product doesn't exist in dest shop — fetch full source product and copy it
        const srcProduct = await products.getById(item.fromProductId)
        if (srcProduct) {
          const { data: newProd, error: createErr } = await supabase
            .from('products')
            .insert({
              shop_id: toShopId,
              barcode: srcProduct.barcode,
              name: srcProduct.name,
              category: srcProduct.category,
              sub_category: srcProduct.sub_category,
              brand: srcProduct.brand,
              size: srcProduct.size,
              color: srcProduct.color,
              gender: srcProduct.gender,
              fabric: srcProduct.fabric,
              purchase_price: srcProduct.purchase_price,
              selling_price: srcProduct.selling_price,
              mrp: srcProduct.mrp,
              discount_pct: srcProduct.discount_pct,
              gst_rate: srcProduct.gst_rate,
              hsn_code: srcProduct.hsn_code,
              stock_quantity: 0,
              low_stock_limit: srcProduct.low_stock_limit,
              supplier_id: null,
              supplier_name: srcProduct.supplier_name,
              image_url: srcProduct.image_url,
              notes: srcProduct.notes,
              is_active: true,
            })
            .select('id')
            .single()
          if (createErr) throw createErr
          destProductId = newProd.id
        }
      }

      // ── 3. Increase stock in destination shop ──
      if (destProductId) {
        // Use 'IN' (original constraint value), reference_type 'MANUAL'
        await products.adjustStock(
          destProductId, toShopId, item.quantity,
          'IN', 'MANUAL', transfer.id, transferNumber,
          `Transfer IN ← ${transferNumber}`, billerName
        )
      }
    }

    return transfer
  },
}

// ============================================================
// INVENTORY MOVEMENTS (audit log)
// ============================================================
export const inventoryMovementsDb = {
  async list(
    shopId: string,
    opts?: { search?: string; movementType?: string; from?: string; to?: string; limit?: number; offset?: number }
  ): Promise<{ data: (InventoryMovement & { product: Product | null })[]; count: number }> {
    let query = supabase
      .from('inventory_movements')
      .select('*, product:products(*)', { count: 'exact' })
      .eq('shop_id', shopId)

    if (opts?.movementType) query = query.eq('movement_type', opts.movementType)
    if (opts?.from) query = query.gte('created_at', opts.from)
    if (opts?.to) query = query.lte('created_at', opts.to)

    const from = opts?.offset ?? 0
    const to = from + (opts?.limit ?? 50) - 1
    query = query.order('created_at', { ascending: false }).range(from, to)

    const { data, error, count } = await query
    if (error) throw error

    // Client-side product name search if needed
    let result = (data || []) as (InventoryMovement & { product: Product | null })[]
    if (opts?.search) {
      const s = opts.search.toLowerCase()
      result = result.filter(m =>
        m.product?.name?.toLowerCase().includes(s) ||
        m.product?.barcode?.toLowerCase().includes(s) ||
        m.reference_number?.toLowerCase().includes(s)
      )
    }

    return { data: result, count: count || 0 }
  },
}


// ============================================================
// ACTIVITY LOGS
// ============================================================
export const activityLogs = {
  async log(entry: Omit<ActivityLog, 'id' | 'created_at'>): Promise<void> {
    await supabase.from('activity_logs').insert(entry)
  },
}


// ============================================================
// HELD BILLS (Phase 2 — Hold/Resume cart without billing)
// ============================================================
export const heldBillsDb = {
  async save(
    shopId: string,
    data: {
      label: string | null
      cart: CartItem[]
      customer: Record<string, unknown> | null
      customerForm: { name: string; phone: string; whatsapp: string; address: string; gst_number: string }
      billType: string
      checkoutType: string
      billDiscountPct: number
      billDiscountAmount: number
      paymentMethod: string
      paymentMode: string
      paidAmount: number
      billerName: string
      notes: string
    }
  ): Promise<HeldBill> {
    const { data: held, error } = await supabase
      .from('held_bills')
      .insert({
        shop_id: shopId,
        label: data.label,
        cart: data.cart as unknown as Record<string, unknown>[],
        customer: data.customer,
        customer_form: data.customerForm,
        bill_type: data.billType,
        checkout_type: data.checkoutType,
        bill_discount_pct: data.billDiscountPct,
        bill_discount_amount: data.billDiscountAmount,
        payment_method: data.paymentMethod,
        payment_mode: data.paymentMode,
        paid_amount: data.paidAmount,
        biller_name: data.billerName,
        notes: data.notes,
      })
      .select()
      .single()
    if (error) throw error
    return held as HeldBill
  },

  async list(shopId: string): Promise<HeldBill[]> {
    const { data, error } = await supabase
      .from('held_bills')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []) as HeldBill[]
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('held_bills').delete().eq('id', id)
    if (error) throw error
  },
}

// ============================================================
// QUOTATIONS (Phase 2 — Estimate / Quotation)
// ============================================================
export const quotationsDb = {
  async create(
    shopId: string,
    data: {
      customerName: string | null
      customerPhone: string | null
      customerWhatsapp: string | null
      customerAddress: string | null
      customerGst: string | null
      customerId: string | null
      billType: string
      billDiscountPct: number
      billDiscount: number
      validDays: number
      notes: string
      billerName: string
    },
    items: CartItem[]
  ): Promise<Quotation & { quotation_items: QuotationItem[] }> {
    // Atomic quotation number
    const { data: qNumData, error: qNumErr } = await supabase.rpc('get_next_quotation_number', { p_shop_id: shopId })
    if (qNumErr) throw qNumErr
    const quotationNumber = qNumData as string

    const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
    const itemDiscount = items.reduce((s, i) => s + i.discount_amount, 0)
    const gstAmount = items.reduce((s, i) => s + i.gst_amount, 0)
    const grandTotal = subtotal - itemDiscount - data.billDiscount + gstAmount

    const { data: q, error: qErr } = await supabase
      .from('quotations')
      .insert({
        shop_id: shopId,
        quotation_number: quotationNumber,
        status: 'DRAFT',
        customer_id: data.customerId,
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        customer_whatsapp: data.customerWhatsapp,
        customer_address: data.customerAddress,
        customer_gst: data.customerGst,
        bill_type: data.billType,
        subtotal,
        item_discount: itemDiscount,
        bill_discount: data.billDiscount,
        bill_discount_pct: data.billDiscountPct,
        gst_amount: gstAmount,
        grand_total: grandTotal,
        valid_days: data.validDays,
        notes: data.notes,
        biller_name: data.billerName,
      })
      .select()
      .single()
    if (qErr) throw qErr

    const qItems = items.map(item => ({
      quotation_id: q.id,
      shop_id: shopId,
      product_id: item.product_id,
      barcode: item.barcode,
      product_name: item.product_name,
      category: item.category,
      size: item.size,
      color: item.color,
      hsn_code: item.hsn_code,
      quantity: item.quantity,
      unit_price: item.unit_price,
      mrp: item.mrp,
      discount_pct: item.discount_pct,
      discount_amount: item.discount_amount,
      gst_rate: item.gst_rate,
      gst_amount: item.gst_amount,
      total_amount: item.total_amount,
      is_custom_item: item.is_custom_item,
    }))

    const { data: insertedItems, error: itemsErr } = await supabase
      .from('quotation_items')
      .insert(qItems)
      .select()
    if (itemsErr) throw itemsErr

    return { ...(q as Quotation), quotation_items: (insertedItems || []) as QuotationItem[] }
  },

  async list(shopId: string): Promise<(Quotation & { quotation_items: QuotationItem[] })[]> {
    const { data, error } = await supabase
      .from('quotations')
      .select('*, quotation_items(*)')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []) as (Quotation & { quotation_items: QuotationItem[] })[]
  },

  async updateStatus(id: string, status: string): Promise<void> {
    const { error } = await supabase.from('quotations').update({ status }).eq('id', id)
    if (error) throw error
  },

  async convertToBill(
    quotationId: string,
    shopId: string,
    paymentMethod: string,
    paymentMode: string,
    paidAmount: number,
    billerName: string,
    splitPayments?: { method: string; amount: number }[]
  ): Promise<Bill> {
    // Fetch quotation with items
    const { data: q, error: qErr } = await supabase
      .from('quotations')
      .select('*, quotation_items(*)')
      .eq('id', quotationId)
      .single()
    if (qErr) throw qErr
    if (!q) throw new Error('Quotation not found')
    if (q.status === 'CONVERTED') throw new Error('This quotation has already been converted to a bill')
    if (q.status === 'CANCELLED') throw new Error('Cannot convert a cancelled quotation')

    const items: CartItem[] = (q.quotation_items || []).map((qi: QuotationItem) => ({
      id: qi.id,
      product_id: qi.product_id,
      barcode: qi.barcode || '',
      product_name: qi.product_name,
      category: qi.category || '',
      size: qi.size || '',
      color: qi.color || '',
      hsn_code: qi.hsn_code || '',
      quantity: qi.quantity,
      unit_price: qi.unit_price,
      mrp: qi.mrp,
      discount_pct: qi.discount_pct,
      discount_amount: qi.discount_amount,
      gst_rate: qi.gst_rate,
      gst_amount: qi.gst_amount,
      total_amount: qi.total_amount,
      stock_quantity: 999,
      is_custom_item: qi.is_custom_item,
    }))

    const effectivePaid = paymentMode === 'FULL' ? q.grand_total
      : paymentMode === 'DUE' ? 0
      : paidAmount
    const dueAmount = Math.max(0, q.grand_total - effectivePaid)
    const paymentStatus = effectivePaid === 0 ? 'DUE' : dueAmount <= 0 ? 'PAID' : 'PARTIAL'

    const bill = await (await import('./database')).bills.checkout(
      shopId,
      {
        shop_id: shopId,
        bill_type: q.bill_type as 'NORMAL' | 'GST',
        customer_id: q.customer_id,
        customer_name: q.customer_name,
        customer_phone: q.customer_phone,
        customer_whatsapp: q.customer_whatsapp,
        customer_address: q.customer_address,
        customer_gst: q.customer_gst,
        subtotal: q.subtotal,
        item_discount: q.item_discount,
        bill_discount: q.bill_discount,
        bill_discount_pct: q.bill_discount_pct,
        gst_amount: q.gst_amount,
        cgst_amount: q.gst_amount / 2,
        sgst_amount: q.gst_amount / 2,
        igst_amount: 0,
        round_off: 0,
        grand_total: q.grand_total,
        paid_amount: effectivePaid,
        due_amount: dueAmount,
        payment_status: paymentStatus as 'PAID' | 'PARTIAL' | 'DUE' | 'REFUNDED' | 'EXCHANGED' | 'CANCELLED',
        checkout_type: 'OFFLINE',
        biller_name: billerName,
        notes: `Converted from Quotation ${q.quotation_number}`,
        is_deleted: false,
      },
      items,
      paymentMethod,
      effectivePaid,
      billerName,
      splitPayments
    )

    // Mark quotation as converted
    await supabase.from('quotations').update({
      status: 'CONVERTED',
      converted_bill_id: bill.id,
    }).eq('id', quotationId)

    return bill
  },
}
