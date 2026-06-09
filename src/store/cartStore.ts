import { create } from 'zustand'
import { generateId, roundOff } from '../lib/utils'
import type { CartItem, Customer, BillType, CheckoutType } from '../types'

export type PaymentMode = 'FULL' | 'PARTIAL' | 'DUE'

interface CartState {
  shopId: string
  billType: BillType
  checkoutType: CheckoutType
  customer: Partial<Customer> | null
  cart: CartItem[]
  billDiscountPct: number
  billDiscountAmount: number
  paymentMethod: string
  paymentMode: PaymentMode
  additionalPayments: { method: string; amount: number }[]
  paidAmount: number
  billerName: string
  notes: string

  // Actions
  setShop: (shopId: string) => void
  setBillType: (type: BillType) => void
  setCheckoutType: (type: CheckoutType) => void
  setCustomer: (customer: Partial<Customer> | null) => void
  addItem: (item: Omit<CartItem, 'id'>) => void
  removeItem: (id: string) => void
  updateItem: (id: string, updates: Partial<CartItem>) => void
  clearCart: () => void
  setBillDiscount: (pct: number, amount?: number) => void
  setPaymentMethod: (method: string) => void
  setPaymentMode: (mode: PaymentMode) => void
  addAdditionalPayment: (method: string, amount: number) => void
  removeAdditionalPayment: (index: number) => void
  setPaidAmount: (amount: number) => void
  setBillerName: (name: string) => void
  setNotes: (notes: string) => void
  setAdditionalPayments: (payments: { method: string; amount: number }[]) => void
  restoreFromHeld: (held: {
    cart: CartItem[]
    customer: Partial<Customer> | null
    customerForm: { name: string; phone: string; whatsapp: string; address: string; gst_number: string } | null
    billType: BillType
    checkoutType: CheckoutType
    billDiscountPct: number
    billDiscountAmount: number
    paymentMethod: string
    paymentMode: string
    paidAmount: number
    billerName: string
    notes: string
  }) => void

  // Computed
  getSubtotal: () => number
  getItemDiscount: () => number
  getBillDiscount: () => number
  getGSTAmount: () => number
  getGrandTotal: () => number
  getDueAmount: () => number
  getTotalPaid: () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  shopId: '',
  billType: 'NORMAL',
  checkoutType: 'OFFLINE',
  customer: null,
  cart: [],
  billDiscountPct: 0,
  billDiscountAmount: 0,
  paymentMethod: 'Cash',
  paymentMode: 'FULL',
  additionalPayments: [],
  paidAmount: 0,
  billerName: '',
  notes: '',

  setShop: (shopId) => set({ shopId }),
  setBillType: (billType) => set({ billType }),
  setCheckoutType: (checkoutType) => set({ checkoutType }),
  setCustomer: (customer) => set({ customer }),

  addItem: (item) => {
    const existing = get().cart.find(
      i => i.product_id === item.product_id && i.size === item.size && i.color === item.color
    )
    if (existing && !item.is_custom_item) {
      get().updateItem(existing.id, { quantity: existing.quantity + item.quantity })
    } else {
      set(state => ({ cart: [...state.cart, { ...item, id: generateId() }] }))
    }
  },

  removeItem: (id) => set(state => ({ cart: state.cart.filter(i => i.id !== id) })),

  updateItem: (id, updates) => {
    set(state => ({
      cart: state.cart.map(item => {
        if (item.id !== id) return item
        const updated = { ...item, ...updates }
        // Recalculate item total
        const discAmt = (updated.unit_price * updated.quantity * updated.discount_pct) / 100
        const afterDisc = updated.unit_price * updated.quantity - discAmt
        const gstAmt = (afterDisc * updated.gst_rate) / 100
        return {
          ...updated,
          discount_amount: parseFloat(discAmt.toFixed(2)),
          gst_amount: parseFloat(gstAmt.toFixed(2)),
          total_amount: parseFloat((afterDisc + gstAmt).toFixed(2)),
        }
      }),
    }))
  },

  clearCart: () => set({
    cart: [],
    customer: null,
    billDiscountPct: 0,
    billDiscountAmount: 0,
    paidAmount: 0,
    paymentMode: 'FULL',
    additionalPayments: [],
    notes: '',
    billType: 'NORMAL',
    checkoutType: 'OFFLINE',
  }),

  setBillDiscount: (pct, amount) => {
    const subtotal = get().getSubtotal() - get().getItemDiscount()
    const discAmount = amount !== undefined ? amount : (subtotal * pct) / 100
    set({ billDiscountPct: pct, billDiscountAmount: parseFloat(discAmount.toFixed(2)) })
  },

  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),

  setPaymentMode: (mode) => {
    if (mode === 'FULL') {
      const total = get().getGrandTotal()
      set({ paymentMode: mode, paidAmount: total })
    } else if (mode === 'DUE') {
      set({ paymentMode: mode, paidAmount: 0 })
    } else {
      // PARTIAL — keep current paidAmount, user will edit
      set({ paymentMode: mode })
    }
  },

  addAdditionalPayment: (method, amount) =>
    set(state => ({ additionalPayments: [...state.additionalPayments, { method, amount }] })),

  removeAdditionalPayment: (index) =>
    set(state => ({ additionalPayments: state.additionalPayments.filter((_, i) => i !== index) })),

  setPaidAmount: (paidAmount) => set({ paidAmount }),
  setBillerName: (billerName) => set({ billerName }),
  setNotes: (notes) => set({ notes }),

  setAdditionalPayments: (payments) => set({ additionalPayments: payments }),

  restoreFromHeld: (held) => {
    set({
      cart: held.cart.map(item => ({ ...item, id: generateId() })),
      customer: held.customer,
      billType: held.billType,
      checkoutType: held.checkoutType,
      billDiscountPct: held.billDiscountPct,
      billDiscountAmount: held.billDiscountAmount,
      paymentMethod: held.paymentMethod,
      paymentMode: held.paymentMode as 'FULL' | 'PARTIAL' | 'DUE',
      paidAmount: held.paidAmount,
      billerName: held.billerName,
      notes: held.notes,
      additionalPayments: [],
    })
  },

  getSubtotal: () => get().cart.reduce((s, i) => s + i.unit_price * i.quantity, 0),
  getItemDiscount: () => get().cart.reduce((s, i) => s + i.discount_amount, 0),
  getBillDiscount: () => get().billDiscountAmount,
  getGSTAmount: () => get().cart.reduce((s, i) => s + i.gst_amount, 0),

  getGrandTotal: () => {
    const subtotal = get().getSubtotal()
    const itemDisc = get().getItemDiscount()
    const billDisc = get().getBillDiscount()
    const gst = get().getGSTAmount()
    const raw = subtotal - itemDisc - billDisc + gst
    const { rounded } = roundOff(raw)
    return rounded
  },

  getTotalPaid: () => {
    const { paidAmount, additionalPayments } = get()
    return paidAmount + additionalPayments.reduce((s, p) => s + p.amount, 0)
  },

  getDueAmount: () => {
    const total = get().getGrandTotal()
    const paid = get().getTotalPaid()
    return Math.max(0, total - paid)
  },
}))
