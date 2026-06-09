// ============================================================
// NANDARANI POS — Database Helpers (Supabase)
// ============================================================
import { supabase } from './supabase'
import type {
  Product, Customer, Bill, BillItem, Payment, Return, ReturnItem,
  Exchange, ExchangeItem, InventoryMovement, CartItem, DashboardStats,
  SalesTrend, TopProduct, Shop, ShopSettings, Supplier, ActivityLog
} from '../types'

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
    billerName: string
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

    // Insert payment
    if (paidAmount > 0) {
      const { error: payErr } = await supabase.from('payments').insert({
        bill_id: bill.id,
        shop_id: shopId,
        customer_id: billData.customer_id,
        amount: paidAmount,
        payment_method: paymentMethod,
        payment_type: 'SALE',
      })
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
  async create(supplier: Omit<Supplier, 'id' | 'created_at'>): Promise<Supplier> {
    const { data, error } = await supabase.from('suppliers').insert(supplier).select().single()
    if (error) throw error
    return data
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
