import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useShopStore } from '../store/shopStore'
import { products as productsDb, customers as customersDb, quotationsDb, bills as billsDb, getErrorMessage } from '../lib/database'
import { Button, Input, Card, Spinner, Badge, EmptyState, Modal } from '../components/ui'
import {
  Plus, Trash2, Search, Package, User, CheckCircle, X,
  FileText, Share2, Download, Printer, ChevronDown, ChevronUp,
  ArrowRight, AlertTriangle, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency, generateWhatsAppURL, roundOff } from '../lib/utils'
import type { Product, Customer, Quotation, QuotationItem, BillItem, Bill } from '../types'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { useReactToPrint } from 'react-to-print'

// ─── Cart line for quotation builder ──────────────────────────────────────────
interface QLine {
  id: string
  product: Product | null
  product_name: string
  barcode: string
  quantity: number
  unit_price: number
  mrp: number
  discount_pct: number
  gst_rate: number
  is_custom: boolean
}

const newLine = (): QLine => ({
  id: crypto.randomUUID(),
  product: null, product_name: '', barcode: '', quantity: 1,
  unit_price: 0, mrp: 0, discount_pct: 0, gst_rate: 0, is_custom: false,
})

function calcLine(l: QLine) {
  const disc = (l.unit_price * l.quantity * l.discount_pct) / 100
  const afterDisc = l.unit_price * l.quantity - disc
  const gst = (afterDisc * l.gst_rate) / 100
  return {
    discount_amount: parseFloat(disc.toFixed(2)),
    gst_amount: parseFloat(gst.toFixed(2)),
    total_amount: parseFloat((afterDisc + gst).toFixed(2)),
  }
}

// ─── Product search inline ────────────────────────────────────────────────────
const ProductSearch: React.FC<{
  shopId: string
  onSelect: (p: Product) => void
}> = ({ shopId, onSelect }) => {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (!q.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await productsDb.list(shopId, { search: q, limit: 8 })
      setResults(data)
      setOpen(true)
    }, 250)
    return () => clearTimeout(t)
  }, [q, shopId])

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input value={q} onChange={e => setQ(e.target.value)} onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search product…"
          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-20 top-full mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {results.map(p => (
            <button key={p.id} onClick={() => { onSelect(p); setQ(''); setOpen(false) }}
              className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700">
              <Package className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{p.name}</p>
                <p className="text-xs text-gray-400">{p.barcode} · ₹{p.selling_price} · Stock: {p.stock_quantity}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Quotation Slip (printable) ───────────────────────────────────────────────
const QuotationSlip = React.forwardRef<HTMLDivElement, {
  quotation: Quotation
  items: QuotationItem[]
  shopName: string
  shopPhone: string | null
  shopAddress: string | null
}>(({ quotation, items, shopName, shopPhone, shopAddress }, ref) => {
  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const itemDisc = items.reduce((s, i) => s + i.discount_amount, 0)
  return (
    <div ref={ref} className="thermal-bill" id="quotation-slip-print">
      <div className="center bold" style={{ fontSize: '14px' }}>{shopName}</div>
      {shopAddress && <div className="center" style={{ fontSize: '10px' }}>{shopAddress}</div>}
      {shopPhone && <div className="center" style={{ fontSize: '10px' }}>Ph: {shopPhone}</div>}
      <div className="divider" />
      <div className="center bold" style={{ fontSize: '12px' }}>ESTIMATE / QUOTATION</div>
      <div className="divider" />
      <table><tbody>
        <tr><td className="bold">Quotation #</td><td style={{ textAlign: 'right' }}>{quotation.quotation_number}</td></tr>
        <tr><td>Date</td><td style={{ textAlign: 'right' }}>{new Date(quotation.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td></tr>
        <tr><td>Valid for</td><td style={{ textAlign: 'right' }}>{quotation.valid_days} days</td></tr>
        {quotation.customer_name && <tr><td>Customer</td><td style={{ textAlign: 'right' }}>{quotation.customer_name}</td></tr>}
        {quotation.customer_phone && <tr><td>Phone</td><td style={{ textAlign: 'right' }}>{quotation.customer_phone}</td></tr>}
      </tbody></table>
      <div className="divider" />
      <table>
        <thead><tr>
          <th style={{ textAlign: 'left', width: '45%' }}>Item</th>
          <th style={{ textAlign: 'center', width: '10%' }}>Qty</th>
          <th style={{ textAlign: 'right', width: '20%' }}>Rate</th>
          <th style={{ textAlign: 'right', width: '25%' }}>Amt</th>
        </tr></thead>
      </table>
      <div className="divider" />
      <table><tbody>
        {items.map((item, i) => (
          <React.Fragment key={i}>
            <tr><td colSpan={4} style={{ fontWeight: 'bold', paddingTop: '2px' }}>{item.product_name}</td></tr>
            <tr>
              <td style={{ fontSize: '9px', color: '#666' }}>{[item.barcode, item.size, item.color].filter(Boolean).join(' | ')}</td>
              <td style={{ textAlign: 'center' }}>{item.quantity}</td>
              <td style={{ textAlign: 'right' }}>₹{item.unit_price.toFixed(2)}</td>
              <td style={{ textAlign: 'right' }}>₹{item.total_amount.toFixed(2)}</td>
            </tr>
          </React.Fragment>
        ))}
      </tbody></table>
      <div className="divider" />
      <table><tbody>
        <tr><td>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</td><td style={{ textAlign: 'right' }}>₹{subtotal.toFixed(2)}</td></tr>
        {itemDisc > 0 && <tr><td>Item Discount</td><td style={{ textAlign: 'right', color: '#e53e3e' }}>-₹{itemDisc.toFixed(2)}</td></tr>}
        {quotation.bill_discount > 0 && <tr><td>Bill Discount</td><td style={{ textAlign: 'right', color: '#e53e3e' }}>-₹{quotation.bill_discount.toFixed(2)}</td></tr>}
        {quotation.gst_amount > 0 && <tr><td>GST</td><td style={{ textAlign: 'right' }}>₹{quotation.gst_amount.toFixed(2)}</td></tr>}
      </tbody></table>
      <div className="divider" />
      <table><tbody>
        <tr>
          <td className="bold" style={{ fontSize: '13px' }}>GRAND TOTAL</td>
          <td className="bold" style={{ textAlign: 'right', fontSize: '13px' }}>₹{quotation.grand_total.toFixed(2)}</td>
        </tr>
      </tbody></table>
      <div className="divider" />
      <div className="center" style={{ fontSize: '9px' }}>This is an estimate. Prices subject to change.</div>
      <div className="center" style={{ fontSize: '9px' }}>Valid for {quotation.valid_days} days from date of issue.</div>
      {quotation.notes && <div className="center" style={{ fontSize: '9px', marginTop: '4px' }}>Note: {quotation.notes}</div>}
      <div className="divider" />
      <div className="center bold" style={{ fontSize: '11px' }}>Thank you for your interest!</div>
      <div style={{ height: '8mm' }} />
    </div>
  )
})
QuotationSlip.displayName = 'QuotationSlip'

// ─── STATUS BADGE ──────────────────────────────────────────────────────────────
const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  DRAFT: 'default', SENT: 'warning', CONVERTED: 'success', CANCELLED: 'danger',
}

// ─── CONVERT MODAL ─────────────────────────────────────────────────────────────
const ConvertModal: React.FC<{
  quotation: Quotation
  shopId: string
  paymentMethods: string[]
  onConverted: (bill: Bill) => void
  onClose: () => void
}> = ({ quotation, shopId, paymentMethods, onConverted, onClose }) => {
  const [mode, setMode] = useState<'FULL' | 'PARTIAL' | 'DUE'>('FULL')
  const [method, setMethod] = useState(paymentMethods[0] || 'Cash')
  const [paidAmount, setPaidAmount] = useState(0)
  const [loading, setLoading] = useState(false)

  const handleConvert = async () => {
    setLoading(true)
    try {
      const effectivePaid = mode === 'FULL' ? quotation.grand_total : mode === 'DUE' ? 0 : paidAmount
      const bill = await quotationsDb.convertToBill(quotation.id, shopId, method, mode, effectivePaid, '')
      toast.success(`Converted to Bill #${bill.bill_number}`)
      onConverted(bill)
    } catch (e: unknown) {
      toast.error(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
        <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Quotation: {quotation.quotation_number}</p>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{quotation.customer_name || 'Walk-in'} · Grand Total: {formatCurrency(quotation.grand_total)}</p>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Payment Mode</p>
        <div className="flex gap-2">
          {(['FULL', 'PARTIAL', 'DUE'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${mode === m ? (m === 'FULL' ? 'bg-green-600 text-white border-green-600' : m === 'DUE' ? 'bg-red-600 text-white border-red-600' : 'bg-yellow-500 text-white border-yellow-500') : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}>
              {m === 'FULL' ? 'Full Payment' : m === 'PARTIAL' ? 'Partial' : 'Full Due'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Payment Method</p>
        <div className="flex flex-wrap gap-1.5">
          {paymentMethods.map(m => (
            <button key={m} onClick={() => setMethod(m)}
              className={`px-3 py-1 text-xs rounded-full ${method === m ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
              {m}
            </button>
          ))}
        </div>
      </div>
      {mode === 'PARTIAL' && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400 w-24">Amount Paid</span>
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
            <input type="number" min="0" max={quotation.grand_total - 0.01} value={paidAmount || ''}
              onChange={e => setPaidAmount(parseFloat(e.target.value) || 0)}
              className="w-full pl-7 pr-3 py-2 text-sm border border-yellow-300 dark:border-yellow-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-500" autoFocus />
          </div>
        </div>
      )}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-300">Stock will be deducted once. This action cannot be undone.</p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" fullWidth onClick={onClose}>Cancel</Button>
        <Button fullWidth loading={loading} icon={<CheckCircle className="w-4 h-4" />} onClick={handleConvert}>Convert to Bill</Button>
      </div>
    </div>
  )
}

// ─── MAIN QUOTATIONS PAGE ──────────────────────────────────────────────────────
export const Quotations: React.FC = () => {
  const { activeShop, activeSettings } = useShopStore()
  const [tab, setTab] = useState<'new' | 'list'>('list')

  // Builder state
  const [lines, setLines] = useState<QLine[]>([newLine()])
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [showCustResults, setShowCustResults] = useState(false)
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', whatsapp: '', address: '', gst_number: '' })
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [billType, setBillType] = useState<'NORMAL' | 'GST'>('NORMAL')
  const [billDiscPct, setBillDiscPct] = useState(0)
  const [validDays, setValidDays] = useState(7)
  const [notes, setNotes] = useState('')
  const [billerName, setBillerName] = useState('')
  const [saving, setSaving] = useState(false)

  // List state
  const [quotations, setQuotations] = useState<(Quotation & { quotation_items: QuotationItem[] })[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [convertModal, setConvertModal] = useState<Quotation | null>(null)
  const [convertedBill, setConvertedBill] = useState<Bill | null>(null)

  // Print
  const slipRef = useRef<HTMLDivElement>(null)
  const [printingQuotation, setPrintingQuotation] = useState<(Quotation & { quotation_items: QuotationItem[] }) | null>(null)

  const handlePrint = useReactToPrint({
    content: () => slipRef.current,
    documentTitle: `Quotation-${printingQuotation?.quotation_number || 'Draft'}`,
    onAfterPrint: () => setPrintingQuotation(null),
  })

  const loadQuotations = useCallback(async () => {
    if (!activeShop) return
    setListLoading(true)
    try { setQuotations(await quotationsDb.list(activeShop.id)) }
    catch (e: unknown) { toast.error(getErrorMessage(e)) }
    finally { setListLoading(false) }
  }, [activeShop?.id])

  useEffect(() => { if (tab === 'list') loadQuotations() }, [tab, loadQuotations])
  useEffect(() => { if (activeShop && activeSettings?.biller_names?.[0]) setBillerName(activeSettings.biller_names[0]) }, [activeShop?.id])

  // Customer search
  const searchCustomers = useCallback(async (q: string) => {
    if (!activeShop || !q.trim()) { setCustomerResults([]); return }
    const data = await customersDb.list(activeShop.id, q)
    setCustomerResults(data)
    setShowCustResults(true)
  }, [activeShop?.id])

  useEffect(() => {
    const t = setTimeout(() => searchCustomers(customerSearch), 300)
    return () => clearTimeout(t)
  }, [customerSearch, searchCustomers])

  // Line operations
  const addLine = () => setLines(prev => [...prev, newLine()])
  const removeLine = (id: string) => { if (lines.length > 1) setLines(prev => prev.filter(l => l.id !== id)) }
  const updateLine = (id: string, updates: Partial<QLine>) => setLines(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))

  const selectProduct = (id: string, p: Product) => {
    updateLine(id, {
      product: p, product_name: p.name, barcode: p.barcode,
      unit_price: p.selling_price, mrp: p.mrp,
      discount_pct: p.discount_pct, gst_rate: billType === 'GST' ? p.gst_rate : 0,
      is_custom: false,
    })
  }

  // Computed totals
  const lineCalcs = lines.map(l => calcLine(l))
  const subtotal = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0)
  const itemDiscount = lineCalcs.reduce((s, c) => s + c.discount_amount, 0)
  const billDiscount = ((subtotal - itemDiscount) * billDiscPct) / 100
  const gstAmount = lineCalcs.reduce((s, c) => s + c.gst_amount, 0)
  const grandTotal = subtotal - itemDiscount - billDiscount + gstAmount

  // Save quotation
  const handleSave = async () => {
    if (!activeShop) return
    const validLines = lines.filter(l => l.product_name && l.quantity > 0 && l.unit_price >= 0)
    if (validLines.length === 0) { toast.error('Add at least one product'); return }

    setSaving(true)
    try {
      const cartItems = validLines.map(l => {
        const calc = calcLine(l)
        return {
          id: l.id,
          product_id: l.product?.id || null,
          barcode: l.barcode || 'CUSTOM',
          product_name: l.product_name,
          category: l.product?.category || '',
          size: l.product?.size || '',
          color: l.product?.color || '',
          hsn_code: l.product?.hsn_code || '',
          quantity: l.quantity,
          unit_price: l.unit_price,
          mrp: l.mrp,
          discount_pct: l.discount_pct,
          discount_amount: calc.discount_amount,
          gst_rate: l.gst_rate,
          gst_amount: calc.gst_amount,
          total_amount: calc.total_amount,
          stock_quantity: l.product?.stock_quantity || 0,
          is_custom_item: l.is_custom,
        }
      })

      const q = await quotationsDb.create(
        activeShop.id,
        {
          customerName: customerForm.name || null,
          customerPhone: customerForm.phone || null,
          customerWhatsapp: customerForm.whatsapp || null,
          customerAddress: customerForm.address || null,
          customerGst: customerForm.gst_number || null,
          customerId: selectedCustomerId,
          billType,
          billDiscountPct: billDiscPct,
          billDiscount,
          validDays,
          notes,
          billerName,
        },
        cartItems
      )
      toast.success(`Quotation ${q.quotation_number} saved`)
      // Reset
      setLines([newLine()])
      setCustomerForm({ name: '', phone: '', whatsapp: '', address: '', gst_number: '' })
      setSelectedCustomerId(null)
      setCustomerSearch('')
      setBillDiscPct(0)
      setNotes('')
      setTab('list')
      loadQuotations()
    } catch (e: unknown) {
      toast.error(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const handleWhatsAppShare = (q: Quotation) => {
    const phone = q.customer_whatsapp || q.customer_phone || '916296240320'
    const msg = `*Estimate / Quotation*\n\n` +
      `Shop: ${activeShop?.name}\n` +
      `Quotation #: *${q.quotation_number}*\n` +
      `Date: ${new Date(q.created_at).toLocaleDateString('en-IN')}\n` +
      `Valid for: ${q.valid_days} days\n\n` +
      `Customer: ${q.customer_name || 'Customer'}\n` +
      `*Grand Total: ₹${q.grand_total.toFixed(2)}*\n\n` +
      (q.notes ? `Note: ${q.notes}\n\n` : '') +
      `_This is an estimate. To confirm your order, please contact us._\n` +
      `📞 ${activeShop?.phone || ''}`
    window.open(generateWhatsAppURL(phone, msg), '_blank')
  }

  const handlePrintQuotation = async (q: Quotation & { quotation_items: QuotationItem[] }) => {
    setPrintingQuotation(q)
    // Give React time to render the slip
    await new Promise(r => setTimeout(r, 100))
    handlePrint()
  }

  const handleDownloadPDF = async (q: Quotation & { quotation_items: QuotationItem[] }) => {
    setPrintingQuotation(q)
    await new Promise(r => setTimeout(r, 150))
    if (!slipRef.current) return
    const canvas = await html2canvas(slipRef.current, { scale: 2, useCORS: true })
    const pdf = new jsPDF('p', 'mm', [80, canvas.height / (canvas.width / 80)])
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 80, canvas.height / (canvas.width / 80))
    pdf.save(`Quotation-${q.quotation_number}.pdf`)
    setPrintingQuotation(null)
  }

  const handleCancelQuotation = async (id: string) => {
    if (!window.confirm('Cancel this quotation?')) return
    try {
      await quotationsDb.updateStatus(id, 'CANCELLED')
      setQuotations(prev => prev.map(q => q.id === id ? { ...q, status: 'CANCELLED' } : q))
      toast.success('Quotation cancelled')
    } catch (e: unknown) {
      toast.error(getErrorMessage(e))
    }
  }

  if (!activeShop) return null

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Quotations / Estimates</h2>
          <p className="text-sm text-gray-500 mt-0.5">Create estimates · No stock deducted · Convert to bill when ready</p>
        </div>
        <Button onClick={() => setTab('new')} icon={<Plus className="w-4 h-4" />} variant={tab === 'new' ? 'primary' : 'outline'}>
          New Quotation
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {(['list', 'new'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === t ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            {t === 'list' ? 'All Quotations' : 'New Quotation'}
          </button>
        ))}
      </div>

      {/* ── NEW QUOTATION ── */}
      {tab === 'new' && (
        <div className="space-y-4">
          {/* Customer */}
          <Card>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2"><User className="w-4 h-4" /> Customer Details</h3>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input type="text" value={customerSearch}
                onChange={e => { setCustomerSearch(e.target.value); setCustomerForm(f => ({ ...f, name: e.target.value })) }}
                placeholder="Search existing customer…"
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {showCustResults && customerResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl mt-1 z-30 max-h-36 overflow-y-auto">
                  {customerResults.map(c => (
                    <button key={c.id} onClick={() => {
                      setCustomerForm({ name: c.name, phone: c.phone || '', whatsapp: c.whatsapp || '', address: c.address || '', gst_number: c.gst_number || '' })
                      setSelectedCustomerId(c.id); setCustomerSearch(c.name); setShowCustResults(false)
                    }} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm border-b last:border-0 border-gray-100 dark:border-gray-700">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{c.name}</p>
                        <p className="text-xs text-gray-500">{c.phone}</p>
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
            </div>
          </Card>

          {/* Options */}
          <Card>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Bill Type</label>
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                  {(['NORMAL', 'GST'] as const).map(t => (
                    <button key={t} onClick={() => setBillType(t)}
                      className={`px-4 py-1.5 text-xs font-medium ${billType === t ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Valid Days</label>
                <input type="number" min="1" value={validDays} onChange={e => setValidDays(parseInt(e.target.value) || 7)}
                  className="w-20 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              {activeSettings?.biller_names && activeSettings.biller_names.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Biller</label>
                  <select value={billerName} onChange={e => setBillerName(e.target.value)}
                    className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="">Select Biller</option>
                    {activeSettings.biller_names.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              )}
            </div>
          </Card>

          {/* Line Items */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Items</h3>
              <Button variant="outline" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={addLine}>Add Row</Button>
            </div>
            <div className="space-y-3">
              {lines.map((line, idx) => {
                const calc = calcLine(line)
                return (
                  <div key={line.id} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-5 flex-shrink-0">{idx + 1}.</span>
                      {line.product ? (
                        <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                          <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{line.product_name}</p>
                            <p className="text-xs text-gray-400">{line.barcode}</p>
                          </div>
                          <button onClick={() => updateLine(line.id, { product: null, product_name: '', barcode: '' })} className="text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <div className="flex-1">
                          <ProductSearch shopId={activeShop.id} onSelect={p => selectProduct(line.id, p)} />
                        </div>
                      )}
                      {lines.length > 1 && (
                        <button onClick={() => removeLine(line.id)} className="text-red-400 hover:text-red-600 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                    {/* Custom name fallback */}
                    {!line.product && (
                      <input type="text" placeholder="Or type custom item name" value={line.product_name}
                        onChange={e => updateLine(line.id, { product_name: e.target.value, is_custom: true })}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    )}
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-xs text-gray-500">Qty</label>
                        <input type="number" min="1" value={line.quantity} onChange={e => updateLine(line.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Price ₹</label>
                        <input type="number" min="0" value={line.unit_price} onChange={e => updateLine(line.id, { unit_price: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Disc %</label>
                        <input type="number" min="0" max="100" value={line.discount_pct} onChange={e => updateLine(line.id, { discount_pct: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Total</label>
                        <p className="text-sm font-bold text-blue-600 py-1">{formatCurrency(calc.total_amount)}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Totals */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
              </div>
              {itemDiscount > 0 && (
                <div className="flex justify-between text-sm text-red-500"><span>Item Discount</span><span>-{formatCurrency(itemDiscount)}</span></div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400 flex-1">Bill Discount</span>
                <input type="number" min="0" max="100" value={billDiscPct} onChange={e => setBillDiscPct(parseFloat(e.target.value) || 0)}
                  className="w-14 text-sm px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none" />
                <span className="text-xs text-gray-400">%</span>
                <span className="text-sm text-red-500 w-20 text-right">-{formatCurrency(billDiscount)}</span>
              </div>
              {gstAmount > 0 && (
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400"><span>GST</span><span>+{formatCurrency(gstAmount)}</span></div>
              )}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-900 dark:text-gray-100">Grand Total</span>
                <span className="text-blue-600">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </Card>

          {/* Notes + Save */}
          <Card>
            <Input label="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any special notes for this quotation…" />
            <div className="flex gap-3 mt-4">
              <Button variant="outline" fullWidth onClick={() => setTab('list')}>Cancel</Button>
              <Button fullWidth loading={saving} icon={<FileText className="w-4 h-4" />} onClick={handleSave}>Save Quotation</Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── QUOTATION LIST ── */}
      {tab === 'list' && (
        listLoading ? (
          <div className="flex items-center justify-center h-40"><Spinner size="lg" /></div>
        ) : quotations.length === 0 ? (
          <Card>
            <EmptyState icon={<FileText className="w-10 h-10" />} title="No quotations yet"
              description="Create estimates for customers. Convert to a bill when they confirm." />
          </Card>
        ) : (
          <div className="space-y-3">
            {quotations.map(q => (
              <Card key={q.id}>
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{q.quotation_number}</p>
                      <p className="text-xs text-gray-500">
                        {q.customer_name || 'Walk-in'} &nbsp;·&nbsp;
                        {new Date(q.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        &nbsp;·&nbsp; {q.quotation_items?.length ?? 0} items
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatCurrency(q.grand_total)}</span>
                    <Badge variant={statusVariant[q.status] || 'default'}>{q.status}</Badge>
                    {expandedId === q.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>

                {expandedId === q.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    {/* Items table */}
                    <table className="w-full text-sm mb-3">
                      <thead><tr className="text-xs text-gray-500 uppercase">
                        <th className="text-left pb-2">Product</th>
                        <th className="text-right pb-2">Qty</th>
                        <th className="text-right pb-2">Rate</th>
                        <th className="text-right pb-2">Total</th>
                      </tr></thead>
                      <tbody>
                        {(q.quotation_items || []).map((qi: QuotationItem) => (
                          <tr key={qi.id} className="border-t border-gray-100 dark:border-gray-700/50">
                            <td className="py-1.5">
                              <p className="font-medium text-gray-900 dark:text-gray-100">{qi.product_name}</p>
                              <p className="text-xs text-gray-400">{qi.barcode}</p>
                            </td>
                            <td className="text-right py-1.5 text-gray-600 dark:text-gray-400">{qi.quantity}</td>
                            <td className="text-right py-1.5 text-gray-600 dark:text-gray-400">₹{qi.unit_price.toFixed(2)}</td>
                            <td className="text-right py-1.5 font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(qi.total_amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Notes */}
                    {q.notes && <p className="text-xs text-gray-400 mb-3">Note: {q.notes}</p>}

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => handleWhatsAppShare(q)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700">
                        <Share2 className="w-3.5 h-3.5" /> WhatsApp
                      </button>
                      <button onClick={() => handlePrintQuotation(q)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        <Printer className="w-3.5 h-3.5" /> Print
                      </button>
                      <button onClick={() => handleDownloadPDF(q)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                        <Download className="w-3.5 h-3.5" /> PDF
                      </button>
                      {q.status === 'DRAFT' || q.status === 'SENT' ? (
                        <>
                          <button onClick={() => quotationsDb.updateStatus(q.id, 'SENT').then(() => {
                            setQuotations(prev => prev.map(x => x.id === q.id ? { ...x, status: 'SENT' } : x))
                            toast.success('Marked as Sent')
                          })}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-amber-500 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20">
                            <RefreshCw className="w-3.5 h-3.5" /> Mark Sent
                          </button>
                          <button onClick={() => setConvertModal(q)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                            <ArrowRight className="w-3.5 h-3.5" /> Convert to Bill
                          </button>
                          <button onClick={() => handleCancelQuotation(q.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-400 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                            <X className="w-3.5 h-3.5" /> Cancel
                          </button>
                        </>
                      ) : null}
                      {q.status === 'CONVERTED' && q.converted_bill_id && (
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                          <CheckCircle className="w-3.5 h-3.5" /> Converted to bill
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )
      )}

      {/* ── Convert to Bill Modal ── */}
      <Modal isOpen={!!convertModal} onClose={() => setConvertModal(null)} title="Convert Quotation to Bill" size="sm">
        {convertModal && !convertedBill && (
          <ConvertModal
            quotation={convertModal}
            shopId={activeShop.id}
            paymentMethods={activeSettings?.payment_methods || ['Cash', 'UPI', 'Card']}
            onConverted={bill => { setConvertedBill(bill); loadQuotations() }}
            onClose={() => setConvertModal(null)}
          />
        )}
        {convertedBill && (
          <div className="p-6 text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <p className="font-bold text-gray-900 dark:text-gray-100">Bill #{convertedBill.bill_number} Created!</p>
            <p className="text-sm text-gray-500">Quotation converted and stock deducted.</p>
            <Button fullWidth onClick={() => { setConvertModal(null); setConvertedBill(null) }}>Done</Button>
          </div>
        )}
      </Modal>

      {/* Hidden quotation slip for print/PDF */}
      {printingQuotation && activeShop && (
        <div className="hidden print:block" style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <QuotationSlip
            ref={slipRef}
            quotation={printingQuotation}
            items={printingQuotation.quotation_items || []}
            shopName={activeShop.name}
            shopPhone={activeShop.phone}
            shopAddress={activeShop.address}
          />
        </div>
      )}
    </div>
  )
}
