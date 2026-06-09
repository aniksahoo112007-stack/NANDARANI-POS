import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useReactToPrint } from 'react-to-print'
import { useCartStore } from '../store/cartStore'
import { useShopStore } from '../store/shopStore'
import { products as productsDb, customers as customersDb, bills as billsDb } from '../lib/database'
import { Button, Input, Select, Modal, Badge, Alert, Toggle } from '../components/ui'
import { ThermalBill } from '../components/pos/ThermalBill'
import {
  Search, Plus, Trash2, ShoppingCart, User, Barcode,
  CreditCard, Printer, Download, Share2, CheckCircle,
  Camera, AlertTriangle, X, Package, Grid, ChevronDown,
  ChevronUp, Tag, Zap, QrCode
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  formatCurrency, generateWhatsAppURL, generateBillShareMessage,
  generateUPIString, generateUPIPaymentLink, generateUPIRequestMessage, roundOff
} from '../lib/utils'
import type { Product, Customer, Bill, BillItem } from '../types'
import type { PaymentMode } from '../store/cartStore'
import QRCode from 'qrcode'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export const POS: React.FC = () => {
  const { activeShop, activeSettings } = useShopStore()
  const cart = useCartStore()
  const billRef = useRef<HTMLDivElement>(null)

  // ─── Core state ────────────────────────────────────────────────────────────
  const [productSearch, setProductSearch] = useState('')
  const [barcodeInput, setBarcodeInput] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [showCustomerResults, setShowCustomerResults] = useState(false)
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', whatsapp: '', address: '', gst_number: '' })
  const [checkoutModal, setCheckoutModal] = useState(false)
  const [billCompleted, setBillCompleted] = useState<Bill | null>(null)
  const [completedItems, setCompletedItems] = useState<BillItem[]>([])
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [customItem, setCustomItem] = useState({ name: '', price: '', qty: '1', gst: '0' })
  const [showCustomItem, setShowCustomItem] = useState(false)

  // ─── UPI QR state ──────────────────────────────────────────────────────────
  const [upiQR, setUpiQR] = useState<string | null>(null)          // live QR (before checkout)
  const [completedBillQR, setCompletedBillQR] = useState<string | null>(null) // post-checkout QR

  // ─── Product grid state ────────────────────────────────────────────────────
  const [showGrid, setShowGrid] = useState(false)
  const [gridProducts, setGridProducts] = useState<Product[]>([])
  const [gridCategories, setGridCategories] = useState<string[]>([])
  const [gridCategory, setGridCategory] = useState('')
  const [gridSearch, setGridSearch] = useState('')
  const [gridLoading, setGridLoading] = useState(false)

  // ─── Initialise cart shop ──────────────────────────────────────────────────
  useEffect(() => {
    if (activeShop) cart.setShop(activeShop.id)
  }, [activeShop?.id])

  // ─── Load grid categories once ────────────────────────────────────────────
  useEffect(() => {
    if (activeShop) productsDb.getCategories(activeShop.id).then(setGridCategories)
  }, [activeShop?.id])

  // ─── Load product grid when panel is open ─────────────────────────────────
  const loadGridProducts = useCallback(async () => {
    if (!activeShop) return
    setGridLoading(true)
    try {
      const { data } = await productsDb.list(activeShop.id, {
        category: gridCategory || undefined,
        search: gridSearch || undefined,
        limit: 80,
      })
      setGridProducts(data)
    } finally {
      setGridLoading(false)
    }
  }, [activeShop?.id, gridCategory, gridSearch])

  useEffect(() => {
    if (showGrid) loadGridProducts()
  }, [showGrid, loadGridProducts])

  // ─── Generate UPI QR whenever payment method is UPI or ONLINE ─────────────
  useEffect(() => {
    const isUPI = cart.paymentMethod === 'UPI' || cart.checkoutType === 'ONLINE'
    const amt = cart.paymentMode === 'PARTIAL' && cart.paidAmount > 0
      ? cart.paidAmount
      : cart.getGrandTotal()

    if (isUPI && activeShop?.upi_id && amt > 0) {
      const upiStr = generateUPIString(
        activeShop.upi_id,
        activeShop.name,
        amt,
        `Payment - ${activeShop.name}`
      )
      QRCode.toDataURL(upiStr, { width: 200, margin: 1 }).then(setUpiQR)
    } else {
      setUpiQR(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.paymentMethod, cart.checkoutType, cart.paidAmount, cart.paymentMode,
      activeShop?.upi_id, cart.cart, cart.billDiscountPct])

  // ─── Print handler ─────────────────────────────────────────────────────────
  const handlePrint = useReactToPrint({
    content: () => billRef.current,
    documentTitle: `Bill-${billCompleted?.bill_number || 'Draft'}`,
  })

  // ─── Barcode scan ──────────────────────────────────────────────────────────
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    if (!activeShop || !barcode.trim()) return
    setBarcodeInput('')
    const product = await productsDb.getByBarcode(activeShop.id, barcode.trim())
    if (!product) { toast.error(`Product not found: ${barcode}`); return }
    if (product.stock_quantity <= 0) { toast.error(`${product.name} is out of stock!`); return }
    addProductToCart(product)
    toast.success(`${product.name} added`)
  }, [activeShop?.id])

  // ─── Product search (search-as-you-type) ──────────────────────────────────
  const searchProducts = useCallback(async (q: string) => {
    if (!activeShop || !q.trim()) { setSearchResults([]); return }
    const { data } = await productsDb.list(activeShop.id, { search: q, limit: 10 })
    setSearchResults(data)
  }, [activeShop?.id])

  useEffect(() => {
    const t = setTimeout(() => searchProducts(productSearch), 300)
    return () => clearTimeout(t)
  }, [productSearch])

  // ─── Customer search ───────────────────────────────────────────────────────
  const searchCustomers = useCallback(async (q: string) => {
    if (!activeShop || !q.trim()) { setCustomerResults([]); return }
    const data = await customersDb.list(activeShop.id, q)
    setCustomerResults(data)
    setShowCustomerResults(true)
  }, [activeShop?.id])

  useEffect(() => {
    const t = setTimeout(() => searchCustomers(customerSearch), 300)
    return () => clearTimeout(t)
  }, [customerSearch])

  // ─── Add product to cart ───────────────────────────────────────────────────
  function addProductToCart(product: Product) {
    if (product.stock_quantity <= 0) {
      toast.error(`${product.name} is out of stock!`)
      return
    }
    const qty = 1
    const discAmt = parseFloat(((product.selling_price * qty * product.discount_pct) / 100).toFixed(2))
    const afterDisc = product.selling_price * qty - discAmt
    const gstRate = cart.billType === 'GST' ? product.gst_rate : 0
    const gstAmt = parseFloat(((afterDisc * gstRate) / 100).toFixed(2))
    const totalAmt = parseFloat((afterDisc + gstAmt).toFixed(2))

    cart.addItem({
      product_id: product.id,
      barcode: product.barcode,
      product_name: product.name,
      category: product.category || '',
      size: product.size || '',
      color: product.color || '',
      hsn_code: product.hsn_code || '',
      quantity: qty,
      unit_price: product.selling_price,
      mrp: product.mrp,
      discount_pct: product.discount_pct,
      discount_amount: discAmt,
      gst_rate: gstRate,
      gst_amount: gstAmt,
      total_amount: totalAmt,
      stock_quantity: product.stock_quantity,
      is_custom_item: false,
      image_url: product.image_url || undefined,
    })
    setProductSearch('')
    setSearchResults([])
  }

  function addCustomItem() {
    if (!customItem.name || !customItem.price) return
    const price = parseFloat(customItem.price)
    const qty = parseInt(customItem.qty) || 1
    const gstRate = parseFloat(customItem.gst) || 0
    const gstAmt = (price * qty * gstRate) / 100
    cart.addItem({
      product_id: null,
      barcode: 'CUSTOM',
      product_name: customItem.name,
      category: 'Custom',
      size: '', color: '', hsn_code: '',
      quantity: qty,
      unit_price: price,
      mrp: price,
      discount_pct: 0, discount_amount: 0,
      gst_rate: gstRate,
      gst_amount: parseFloat(gstAmt.toFixed(2)),
      total_amount: parseFloat((price * qty + gstAmt).toFixed(2)),
      stock_quantity: 999,
      is_custom_item: true,
    })
    setCustomItem({ name: '', price: '', qty: '1', gst: '0' })
    setShowCustomItem(false)
    toast.success('Custom item added')
  }

  function selectCustomer(c: Customer) {
    cart.setCustomer(c)
    setCustomerForm({ name: c.name, phone: c.phone || '', whatsapp: c.whatsapp || '', address: c.address || '', gst_number: c.gst_number || '' })
    setCustomerSearch(c.name)
    setShowCustomerResults(false)
  }

  // ─── Checkout ──────────────────────────────────────────────────────────────
  const handleCheckout = async () => {
    if (!activeShop || cart.cart.length === 0) { toast.error('Cart is empty!'); return }

    // Validate payment mode
    if (cart.paymentMode === 'PARTIAL' && cart.paidAmount <= 0) {
      toast.error('Enter the partial amount paid')
      return
    }
    if (cart.paymentMode === 'PARTIAL' && cart.paidAmount >= grandTotal) {
      toast.error('Partial amount cannot equal or exceed grand total — use Full Payment')
      return
    }

    setCheckoutLoading(true)
    try {
      const subtotal = cart.getSubtotal()
      const itemDiscount = cart.getItemDiscount()
      const billDiscount = cart.getBillDiscount()
      const gstAmount = cart.getGSTAmount()
      const paidAmount = cart.paymentMode === 'FULL' ? grandTotal
        : cart.paymentMode === 'DUE' ? 0
        : Math.min(cart.paidAmount, grandTotal)
      const dueAmount = Math.max(0, grandTotal - paidAmount)
      const paymentStatus = paidAmount === 0 ? 'DUE' : dueAmount <= 0 ? 'PAID' : 'PARTIAL'

      // Upsert customer
      let customerId: string | null = null
      if (customerForm.name || customerForm.phone) {
        const c = await customersDb.upsertByPhone(activeShop.id, {
          shop_id: activeShop.id,
          name: customerForm.name || 'Walk-in',
          phone: customerForm.phone || null,
          whatsapp: customerForm.whatsapp || null,
          address: customerForm.address || null,
          gst_number: customerForm.gst_number || null,
        })
        customerId = c.id
      }

      const { rounded: rt, diff: roundOffAmt } = roundOff(subtotal - itemDiscount - billDiscount + gstAmount)

      const bill = await billsDb.checkout(
        activeShop.id,
        {
          shop_id: activeShop.id,
          bill_type: cart.billType,
          customer_id: customerId,
          customer_name: customerForm.name || null,
          customer_phone: customerForm.phone || null,
          customer_whatsapp: customerForm.whatsapp || null,
          customer_address: customerForm.address || null,
          customer_gst: cart.billType === 'GST' ? (customerForm.gst_number || null) : null,
          subtotal,
          item_discount: itemDiscount,
          bill_discount: billDiscount,
          bill_discount_pct: cart.billDiscountPct,
          gst_amount: gstAmount,
          cgst_amount: gstAmount / 2,
          sgst_amount: gstAmount / 2,
          igst_amount: 0,
          round_off: roundOffAmt,
          grand_total: grandTotal,
          paid_amount: paidAmount,
          due_amount: dueAmount,
          payment_status: paymentStatus,
          checkout_type: cart.checkoutType,
          biller_name: cart.billerName,
          notes: cart.notes,
          is_deleted: false,
        },
        cart.cart,
        cart.paymentMethod,
        paidAmount,
        cart.billerName
      )

      // Generate post-checkout UPI QR with actual bill number
      if (activeShop.upi_id && dueAmount > 0) {
        const upiStr = generateUPIPaymentLink(activeShop.upi_id, activeShop.name, dueAmount, bill.bill_number)
        const qr = await QRCode.toDataURL(upiStr, { width: 200, margin: 1 })
        setCompletedBillQR(qr)
      } else if (activeShop.upi_id && paidAmount > 0 && (cart.paymentMethod === 'UPI' || cart.checkoutType === 'ONLINE')) {
        const upiStr = generateUPIPaymentLink(activeShop.upi_id, activeShop.name, paidAmount, bill.bill_number)
        const qr = await QRCode.toDataURL(upiStr, { width: 200, margin: 1 })
        setCompletedBillQR(qr)
      } else {
        setCompletedBillQR(null)
      }

      const fullBill = await billsDb.getById(bill.id)
      if (fullBill) {
        setBillCompleted(fullBill)
        setCompletedItems(fullBill.bill_items || [])
      }

      setCheckoutModal(false)
      cart.clearCart()
      setUpiQR(null)
      toast.success(`Bill #${bill.bill_number} created!`, { duration: 4000 })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Checkout failed')
    } finally {
      setCheckoutLoading(false)
    }
  }

  // ─── Download PDF ──────────────────────────────────────────────────────────
  const handleDownloadPDF = async () => {
    if (!billRef.current) return
    const canvas = await html2canvas(billRef.current, { scale: 2, useCORS: true })
    const pdf = new jsPDF('p', 'mm', [80, canvas.height / (canvas.width / 80)])
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 80, canvas.height / (canvas.width / 80))
    pdf.save(`Bill-${billCompleted?.bill_number}.pdf`)
  }

  // ─── Download QR as PNG ────────────────────────────────────────────────────
  const handleDownloadQR = () => {
    const qr = completedBillQR || upiQR
    if (!qr) return
    const a = document.createElement('a')
    a.href = qr
    a.download = `UPI-QR-${activeShop?.bill_prefix || 'payment'}.png`
    a.click()
    toast.success('QR code downloaded')
  }

  // ─── Share UPI payment link on WhatsApp (pre-checkout) ────────────────────
  const handleShareUPIRequest = () => {
    if (!activeShop?.upi_id) { toast.error('No UPI ID configured in shop settings'); return }
    const amt = cart.paymentMode === 'PARTIAL' && cart.paidAmount > 0 ? cart.paidAmount : grandTotal
    const link = generateUPIString(activeShop.upi_id, activeShop.name, amt, `Payment - ${activeShop.name}`)
    const msg = generateUPIRequestMessage(
      activeShop.name,
      customerForm.name || 'Customer',
      amt,
      link
    )
    const phone = customerForm.whatsapp || customerForm.phone || '916296240320'
    window.open(generateWhatsAppURL(phone, msg), '_blank')
  }

  // ─── WhatsApp share after bill is done ────────────────────────────────────
  const handleWhatsAppShare = () => {
    if (!billCompleted) return
    let upiPayLink: string | undefined
    if (activeShop?.upi_id && billCompleted.due_amount > 0) {
      upiPayLink = generateUPIPaymentLink(activeShop.upi_id, activeShop.name, billCompleted.due_amount, billCompleted.bill_number)
    }
    const msg = generateBillShareMessage(
      activeShop?.name || '',
      billCompleted.bill_number,
      billCompleted.customer_name || 'Customer',
      billCompleted.grand_total,
      billCompleted.paid_amount,
      billCompleted.due_amount,
      new Date(billCompleted.created_at).toLocaleDateString('en-IN'),
      upiPayLink
    )
    const phone = billCompleted.customer_whatsapp || billCompleted.customer_phone || '916296240320'
    window.open(generateWhatsAppURL(phone, msg), '_blank')
  }

  // ─── Derived totals ────────────────────────────────────────────────────────
  const subtotal = cart.getSubtotal()
  const itemDiscount = cart.getItemDiscount()
  const billDiscount = cart.getBillDiscount()
  const gstAmount = cart.getGSTAmount()
  const grandTotal = cart.getGrandTotal()
  const effectivePaid = cart.paymentMode === 'FULL' ? grandTotal
    : cart.paymentMode === 'DUE' ? 0
    : cart.paidAmount
  const dueAmount = Math.max(0, grandTotal - effectivePaid)

  // UPI link shown below QR for scanning
  const liveUPILink = activeShop?.upi_id
    ? generateUPIString(activeShop.upi_id, activeShop.name, effectivePaid || grandTotal, `Payment - ${activeShop.name}`)
    : undefined

  if (!activeShop) return null

  return (
    <div className="h-full flex flex-col lg:flex-row bg-gray-50 dark:bg-gray-900">

      {/* ═══════════════════ LEFT PANEL ═══════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top Controls */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 space-y-3">
          {/* Bill Type + Checkout Type */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
              {(['NORMAL', 'GST'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => cart.setBillType(t)}
                  className={`px-4 py-1.5 text-xs font-medium transition-colors ${cart.billType === t ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                >
                  {t} Bill
                </button>
              ))}
            </div>
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
              {(['OFFLINE', 'ONLINE'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => cart.setCheckoutType(t)}
                  className={`px-4 py-1.5 text-xs font-medium transition-colors ${cart.checkoutType === t ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            {activeSettings?.biller_names && activeSettings.biller_names.length > 0 && (
              <select
                value={cart.billerName}
                onChange={e => cart.setBillerName(e.target.value)}
                className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              >
                <option value="">Select Biller</option>
                {activeSettings.biller_names.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            )}

            {/* Product Grid Toggle */}
            <button
              onClick={() => setShowGrid(g => !g)}
              className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${showGrid ? 'bg-blue-50 border-blue-400 text-blue-700 dark:bg-blue-900/20 dark:border-blue-500 dark:text-blue-300' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              <Grid className="w-3.5 h-3.5" />
              Products
              {showGrid ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {/* Barcode Input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleBarcodeScan(barcodeInput)}
                placeholder="Scan barcode or press Enter..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
          </div>

          {/* Product Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              placeholder="Search product by name..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl mt-1 z-30 max-h-64 overflow-y-auto">
                {searchResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addProductToCart(p)}
                    disabled={p.stock_quantity <= 0}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0 disabled:opacity-50"
                  >
                    <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover rounded-lg" /> : <Package className="w-4 h-4 text-gray-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.barcode} • {p.category} • Stock: {p.stock_quantity}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-blue-600">₹{p.selling_price}</p>
                      {p.stock_quantity <= 0 ? (
                        <span className="text-xs text-red-600">Out of stock</span>
                      ) : p.stock_quantity <= (p.low_stock_limit || 5) ? (
                        <span className="text-xs text-amber-600">Low stock</span>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Product Grid Panel ── */}
        {showGrid && (
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex flex-col" style={{ maxHeight: '340px' }}>
            {/* Category Tabs */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100 dark:border-gray-700 overflow-x-auto">
              <button
                onClick={() => setGridCategory('')}
                className={`flex-shrink-0 px-3 py-1 text-xs rounded-full font-medium transition-colors ${gridCategory === '' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
              >
                All
              </button>
              {gridCategories.map(c => (
                <button
                  key={c}
                  onClick={() => setGridCategory(c)}
                  className={`flex-shrink-0 px-3 py-1 text-xs rounded-full font-medium transition-colors ${gridCategory === c ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                >
                  {c}
                </button>
              ))}
              {/* Grid search */}
              <div className="relative ml-auto flex-shrink-0">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input
                  type="text"
                  value={gridSearch}
                  onChange={e => setGridSearch(e.target.value)}
                  placeholder="Filter..."
                  className="pl-6 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-28 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Grid Cards */}
            <div className="overflow-y-auto p-2">
              {gridLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-400 text-sm">Loading products...</div>
              ) : gridProducts.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-gray-400 text-sm">No products found</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
                  {gridProducts.map(p => {
                    const outOfStock = p.stock_quantity <= 0
                    const lowStock = !outOfStock && p.stock_quantity <= (p.low_stock_limit || 5)
                    return (
                      <button
                        key={p.id}
                        onClick={() => addProductToCart(p)}
                        disabled={outOfStock}
                        className={`relative flex flex-col items-center p-2 rounded-xl border text-left transition-all ${
                          outOfStock
                            ? 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800'
                            : 'border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:shadow-md hover:bg-blue-50 dark:hover:bg-blue-900/20 bg-white dark:bg-gray-800 active:scale-95'
                        }`}
                      >
                        {/* Low stock badge */}
                        {lowStock && (
                          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500" title="Low stock" />
                        )}
                        {outOfStock && (
                          <span className="absolute top-1 right-1 text-[9px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-1 rounded">OUT</span>
                        )}

                        {/* Image */}
                        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center mb-1.5 flex-shrink-0">
                          {p.image_url
                            ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover rounded-lg" />
                            : <Package className="w-5 h-5 text-gray-400" />}
                        </div>

                        {/* Name */}
                        <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 text-center leading-tight line-clamp-2 w-full">{p.name}</p>

                        {/* Size / Color chips */}
                        {(p.size || p.color) && (
                          <p className="text-[10px] text-gray-500 mt-0.5 truncate w-full text-center">
                            {[p.size, p.color].filter(Boolean).join(' / ')}
                          </p>
                        )}

                        {/* Price + Stock */}
                        <div className="flex items-center justify-between w-full mt-1.5">
                          <span className="text-xs font-bold text-blue-600">₹{p.selling_price}</span>
                          <span className={`text-[10px] font-medium ${outOfStock ? 'text-red-500' : lowStock ? 'text-amber-600' : 'text-green-600'}`}>
                            {outOfStock ? '0' : p.stock_quantity}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs mt-1">Scan a barcode, search, or click a product above</p>
            </div>
          ) : (
            cart.cart.map(item => (
              <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                    {item.image_url ? <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover rounded-lg" /> : <Package className="w-5 h-5 text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{item.product_name}</p>
                    <p className="text-xs text-gray-500">{item.barcode} {item.size && `• ${item.size}`} {item.color && `• ${item.color}`}</p>
                    {item.stock_quantity <= 5 && !item.is_custom_item && (
                      <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="w-3 h-3" /> Only {item.stock_quantity} left
                      </p>
                    )}
                  </div>
                  <button onClick={() => cart.removeItem(item.id)} className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {/* Quantity */}
                  <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                    <button
                      onClick={() => item.quantity > 1 && cart.updateItem(item.id, { quantity: item.quantity - 1 })}
                      className="px-2 py-1 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-bold"
                    >-</button>
                    <input
                      type="number"
                      min="1"
                      max={item.stock_quantity || 999}
                      value={item.quantity}
                      onChange={e => cart.updateItem(item.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-12 text-center text-sm py-1 bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none"
                    />
                    <button
                      onClick={() => cart.updateItem(item.id, { quantity: item.quantity + 1 })}
                      className="px-2 py-1 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-bold"
                    >+</button>
                  </div>
                  {/* Price */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={item.unit_price}
                      onChange={e => cart.updateItem(item.id, { unit_price: parseFloat(e.target.value) || 0 })}
                      className="w-20 text-sm py-1 px-2 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  {/* Discount */}
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={item.discount_pct}
                      onChange={e => cart.updateItem(item.id, { discount_pct: parseFloat(e.target.value) || 0 })}
                      className="w-14 text-sm py-1 px-2 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-400">%</span>
                  </div>
                  {/* Total */}
                  <div className="ml-auto text-sm font-bold text-blue-600">{formatCurrency(item.total_amount)}</div>
                </div>
              </div>
            ))
          )}

          {/* Custom Item Form */}
          {showCustomItem && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-amber-800 dark:text-amber-200">Custom Item</span>
                <button onClick={() => setShowCustomItem(false)}><X className="w-4 h-4 text-gray-400" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Item name *" value={customItem.name} onChange={e => setCustomItem(s => ({ ...s, name: e.target.value }))} className="col-span-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <input type="number" placeholder="Price *" value={customItem.price} onChange={e => setCustomItem(s => ({ ...s, price: e.target.value }))} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <input type="number" placeholder="Qty" value={customItem.qty} onChange={e => setCustomItem(s => ({ ...s, qty: e.target.value }))} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <Button onClick={addCustomItem} size="sm" className="mt-2 w-full">Add to Cart</Button>
            </div>
          )}
        </div>

        {/* Add Custom Item */}
        <div className="px-4 pb-2">
          <button onClick={() => setShowCustomItem(true)} className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-400 hover:text-blue-500 transition-colors">
            <Plus className="w-4 h-4" /> Add Custom Item
          </button>
        </div>
      </div>

      {/* ═══════════════════ RIGHT PANEL ═══════════════════ */}
      <div className="lg:w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-y-auto">

        {/* Customer Section */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <User className="w-4 h-4" /> Customer Details
          </h3>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={customerSearch}
              onChange={e => { setCustomerSearch(e.target.value); setCustomerForm(f => ({ ...f, name: e.target.value })) }}
              placeholder="Search customer by name/phone..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {showCustomerResults && customerResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl mt-1 z-30 max-h-40 overflow-y-auto">
                {customerResults.map(c => (
                  <button key={c.id} onClick={() => selectCustomer(c)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.phone} {c.total_due > 0 ? `• Due: ₹${c.total_due}` : ''}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Name" value={customerForm.name} onChange={e => setCustomerForm(f => ({ ...f, name: e.target.value }))} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <input type="text" placeholder="Phone" value={customerForm.phone} onChange={e => setCustomerForm(f => ({ ...f, phone: e.target.value }))} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <input type="text" placeholder="WhatsApp" value={customerForm.whatsapp} onChange={e => setCustomerForm(f => ({ ...f, whatsapp: e.target.value }))} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <input type="text" placeholder="Address" value={customerForm.address} onChange={e => setCustomerForm(f => ({ ...f, address: e.target.value }))} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            {cart.billType === 'GST' && (
              <input type="text" placeholder="GST Number" value={customerForm.gst_number} onChange={e => setCustomerForm(f => ({ ...f, gst_number: e.target.value }))} className="col-span-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            )}
          </div>
        </div>

        {/* Bill Summary */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 space-y-2">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Subtotal ({cart.cart.reduce((s, i) => s + i.quantity, 0)} items)</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {itemDiscount > 0 && (
            <div className="flex justify-between text-sm text-red-500">
              <span>Item Discount</span>
              <span>-{formatCurrency(itemDiscount)}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400 flex-1">Bill Discount</span>
            <div className="flex items-center gap-1">
              <input
                type="number" min="0" max="100"
                value={cart.billDiscountPct}
                onChange={e => cart.setBillDiscount(parseFloat(e.target.value) || 0)}
                className="w-14 text-sm px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-400">%</span>
              <span className="text-sm text-red-500 w-20 text-right">-{formatCurrency(billDiscount)}</span>
            </div>
          </div>
          {gstAmount > 0 && (
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>GST</span>
              <span>+{formatCurrency(gstAmount)}</span>
            </div>
          )}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between font-bold text-base">
            <span className="text-gray-900 dark:text-gray-100">Grand Total</span>
            <span className="text-blue-600">{formatCurrency(grandTotal)}</span>
          </div>
        </div>

        {/* ─── Payment Section ─── */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Payment
          </h3>

          {/* Payment Mode — Full / Partial / Due */}
          <div className="flex gap-1.5">
            {([
              { mode: 'FULL' as PaymentMode, label: 'Full Payment', color: 'bg-green-600 text-white', border: 'border-green-600' },
              { mode: 'PARTIAL' as PaymentMode, label: 'Partial', color: 'bg-yellow-500 text-white', border: 'border-yellow-500' },
              { mode: 'DUE' as PaymentMode, label: 'Full Due', color: 'bg-red-600 text-white', border: 'border-red-600' },
            ]).map(({ mode, label, color, border }) => (
              <button
                key={mode}
                onClick={() => cart.setPaymentMode(mode)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                  cart.paymentMode === mode
                    ? `${color} ${border}`
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Payment Method */}
          <div className="flex flex-wrap gap-1.5">
            {(activeSettings?.payment_methods || ['Cash', 'UPI', 'Card']).map(m => (
              <button
                key={m}
                onClick={() => cart.setPaymentMethod(m)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${cart.paymentMethod === m ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Amount Paid — only visible in PARTIAL mode */}
          {cart.paymentMode === 'PARTIAL' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400 w-24">Amount Paid</span>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                <input
                  type="number"
                  min="0"
                  max={grandTotal - 0.01}
                  value={cart.paidAmount || ''}
                  onChange={e => cart.setPaidAmount(parseFloat(e.target.value) || 0)}
                  placeholder="Enter amount paid"
                  className="w-full pl-7 pr-3 py-2 text-sm border border-yellow-300 dark:border-yellow-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Due / Status Summary */}
          <div className={`flex justify-between items-center text-sm px-3 py-2 rounded-lg ${
            cart.paymentMode === 'FULL' ? 'bg-green-50 dark:bg-green-900/20'
            : cart.paymentMode === 'DUE' ? 'bg-red-50 dark:bg-red-900/20'
            : 'bg-yellow-50 dark:bg-yellow-900/20'
          }`}>
            {cart.paymentMode === 'FULL' && (
              <><span className="text-green-700 dark:text-green-400 font-medium flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Paid in Full</span><span className="font-bold text-green-700 dark:text-green-400">{formatCurrency(grandTotal)}</span></>
            )}
            {cart.paymentMode === 'DUE' && (
              <><span className="text-red-600 font-medium">Full Due</span><span className="font-bold text-red-600">{formatCurrency(grandTotal)}</span></>
            )}
            {cart.paymentMode === 'PARTIAL' && (
              <><span className="text-yellow-700 dark:text-yellow-400 font-medium">Due Amount</span><span className="font-bold text-yellow-700 dark:text-yellow-400">{formatCurrency(Math.max(0, grandTotal - (cart.paidAmount || 0)))}</span></>
            )}
          </div>

          {/* UPI QR — shown when payment method = UPI or checkout = ONLINE */}
          {(cart.paymentMethod === 'UPI' || cart.checkoutType === 'ONLINE') && activeShop?.upi_id && (
            <div className="border border-indigo-200 dark:border-indigo-800 rounded-xl p-3 bg-indigo-50 dark:bg-indigo-900/20 space-y-2">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                <QrCode className="w-4 h-4" />
                <span className="text-xs font-semibold">UPI Payment QR</span>
                <span className="text-xs ml-auto opacity-70">{activeShop.upi_id}</span>
              </div>

              {upiQR ? (
                <div className="flex items-center gap-3">
                  <img src={upiQR} alt="UPI QR" className="w-24 h-24 border-2 border-white dark:border-gray-700 rounded-lg shadow" />
                  <div className="space-y-2 flex-1">
                    <p className="text-xs text-indigo-700 dark:text-indigo-300">
                      Scan to pay<br />
                      <strong className="text-sm">{formatCurrency(effectivePaid || grandTotal)}</strong>
                    </p>
                    <button
                      onClick={handleDownloadQR}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Download QR
                    </button>
                    <button
                      onClick={handleShareUPIRequest}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" /> Share on WhatsApp
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-indigo-600 dark:text-indigo-400">
                  {grandTotal <= 0 ? 'Add items to generate QR' : 'Generating QR...'}
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          <input
            type="text"
            placeholder="Bill notes (optional)"
            value={cart.notes}
            onChange={e => cart.setNotes(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Checkout Button */}
        <div className="p-4 mt-auto">
          <Button
            fullWidth
            size="xl"
            onClick={() => cart.cart.length > 0 ? setCheckoutModal(true) : toast.error('Cart is empty')}
            icon={<CheckCircle className="w-5 h-5" />}
            className="text-base font-bold"
          >
            Checkout — {formatCurrency(grandTotal)}
          </Button>
          {cart.cart.length > 0 && (
            <button onClick={cart.clearCart} className="w-full mt-2 py-1.5 text-xs text-gray-500 hover:text-red-500 transition-colors">
              Clear Cart
            </button>
          )}
        </div>
      </div>

      {/* ─── Checkout Confirmation Modal ─── */}
      <Modal isOpen={checkoutModal} onClose={() => setCheckoutModal(false)} title="Confirm Checkout" size="md">
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm"><span>Items</span><span>{cart.cart.reduce((s, i) => s + i.quantity, 0)} pcs</span></div>
            <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            {(itemDiscount + billDiscount) > 0 && <div className="flex justify-between text-sm text-red-500"><span>Discounts</span><span>-{formatCurrency(itemDiscount + billDiscount)}</span></div>}
            {gstAmount > 0 && <div className="flex justify-between text-sm"><span>GST</span><span>{formatCurrency(gstAmount)}</span></div>}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200 dark:border-gray-600">
              <span>Grand Total</span><span className="text-blue-600">{formatCurrency(grandTotal)}</span>
            </div>
            {/* Payment status summary */}
            <div className={`flex justify-between text-sm font-medium rounded-lg px-3 py-2 mt-1 ${
              cart.paymentMode === 'FULL' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : cart.paymentMode === 'DUE' ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
            }`}>
              <span>
                {cart.paymentMode === 'FULL' ? '✓ Full Payment' : cart.paymentMode === 'DUE' ? '⚠ Full Due' : '◑ Partial'}
                {' '}({cart.paymentMethod})
              </span>
              <span>
                {cart.paymentMode === 'FULL' ? formatCurrency(grandTotal)
                  : cart.paymentMode === 'DUE' ? 'Due: ' + formatCurrency(grandTotal)
                  : `Paid: ${formatCurrency(cart.paidAmount)} / Due: ${formatCurrency(dueAmount)}`}
              </span>
            </div>
          </div>

          {/* UPI QR in confirm modal */}
          {(cart.paymentMethod === 'UPI' || cart.checkoutType === 'ONLINE') && activeShop?.upi_id && upiQR && (
            <div className="flex flex-col items-center gap-2">
              <img src={upiQR} alt="UPI QR" className="w-36 h-36 border-2 border-gray-200 rounded-xl" />
              <p className="text-xs text-gray-500">Scan to pay {formatCurrency(effectivePaid || grandTotal)}</p>
            </div>
          )}

          {customerForm.name && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Customer: <strong>{customerForm.name}</strong> {customerForm.phone && `• ${customerForm.phone}`}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" fullWidth onClick={() => setCheckoutModal(false)}>Cancel</Button>
            <Button fullWidth loading={checkoutLoading} icon={<CheckCircle className="w-4 h-4" />} onClick={handleCheckout}>
              Confirm & Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Bill Completed Modal ─── */}
      <Modal isOpen={!!billCompleted} onClose={() => { setBillCompleted(null); setCompletedBillQR(null) }} title="Bill Created!" size="lg">
        <div className="p-6 space-y-4">
          {/* Status banner */}
          <div className={`flex items-center gap-3 rounded-xl p-4 ${
            billCompleted?.payment_status === 'PAID' ? 'bg-green-50 dark:bg-green-900/20'
            : billCompleted?.payment_status === 'DUE' ? 'bg-red-50 dark:bg-red-900/20'
            : 'bg-yellow-50 dark:bg-yellow-900/20'
          }`}>
            <CheckCircle className={`w-8 h-8 flex-shrink-0 ${
              billCompleted?.payment_status === 'PAID' ? 'text-green-600'
              : billCompleted?.payment_status === 'DUE' ? 'text-red-600'
              : 'text-yellow-600'
            }`} />
            <div>
              <p className="font-bold text-gray-900 dark:text-gray-100">
                Bill #{billCompleted?.bill_number}
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-bold ${
                  billCompleted?.payment_status === 'PAID' ? 'bg-green-200 text-green-800'
                  : billCompleted?.payment_status === 'DUE' ? 'bg-red-200 text-red-800'
                  : 'bg-yellow-200 text-yellow-800'
                }`}>{billCompleted?.payment_status}</span>
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total: {formatCurrency(billCompleted?.grand_total || 0)}
                {billCompleted && billCompleted.due_amount > 0 && (
                  <span className="text-red-600 ml-2">• Due: {formatCurrency(billCompleted.due_amount)}</span>
                )}
              </p>
            </div>
          </div>

          {/* Post-checkout UPI QR (with bill number) */}
          {completedBillQR && billCompleted && (
            <div className="border border-indigo-200 dark:border-indigo-800 rounded-xl p-3 bg-indigo-50 dark:bg-indigo-900/20">
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2 flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5" />
                {billCompleted.due_amount > 0 ? `UPI QR — Due Amount ₹${billCompleted.due_amount.toFixed(2)}` : `UPI QR — Bill #${billCompleted.bill_number}`}
              </p>
              <div className="flex items-center gap-3">
                <img src={completedBillQR} alt="UPI QR" className="w-28 h-28 border-2 border-white rounded-lg shadow flex-shrink-0" />
                <div className="space-y-2 flex-1">
                  <p className="text-xs text-gray-500">{activeShop?.upi_id}</p>
                  <button onClick={handleDownloadQR} className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                    <Download className="w-3.5 h-3.5" /> Download QR
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Thermal Bill Preview */}
          {billCompleted && activeShop && activeSettings && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <ThermalBill
                ref={billRef}
                bill={billCompleted}
                items={completedItems}
                shop={activeShop}
                settings={activeSettings}
                upiQR={completedBillQR || undefined}
                upiPayLink={activeShop?.upi_id && billCompleted.due_amount > 0
                  ? generateUPIPaymentLink(activeShop.upi_id, activeShop.name, billCompleted.due_amount, billCompleted.bill_number)
                  : undefined}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button icon={<Printer className="w-4 h-4" />} variant="primary" onClick={handlePrint}>
              Print Bill
            </Button>
            <Button icon={<Download className="w-4 h-4" />} variant="secondary" onClick={handleDownloadPDF}>
              Download PDF
            </Button>
            <Button icon={<Share2 className="w-4 h-4" />} variant="outline" onClick={handleWhatsAppShare}>
              WhatsApp
            </Button>
            <Button variant="ghost" onClick={() => { setBillCompleted(null); setCompletedBillQR(null) }}>
              New Bill
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
