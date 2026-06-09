import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useShopStore } from '../store/shopStore'
import { suppliersDb, purchaseInvoicesDb, products as productsDb, getErrorMessage } from '../lib/database'
import { Button, Input, Card, Spinner, Modal, Badge, EmptyState } from '../components/ui'
import {
  Plus, Trash2, ShoppingBag, ChevronDown, ChevronUp,
  Package, Search, Check, X, FileText
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Supplier, PurchaseInvoice, PurchaseItem, Product } from '../types'

interface LineItem {
  id: string
  product: Product | null
  productId: string | null
  barcode: string
  productName: string
  sellingPrice: number
  mrp: number
  quantity: number
  unitCost: number
}

const newLineItem = (): LineItem => ({
  id: crypto.randomUUID(),
  product: null, productId: null, barcode: '', productName: '',
  sellingPrice: 0, mrp: 0, quantity: 1, unitCost: 0,
})

// Product search dropdown
const ProductSearch: React.FC<{
  shopId: string
  onSelect: (p: Product) => void
  onClear: () => void
  selected: Product | null
}> = ({ shopId, onSelect, onClear, selected }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const { data } = await productsDb.list(shopId, { search: q, limit: 8 })
      setResults(data)
    } finally {
      setLoading(false)
    }
  }, [shopId])

  useEffect(() => {
    const t = setTimeout(() => search(query), 250)
    return () => clearTimeout(t)
  }, [query, search])

  if (selected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate flex-1">
          {selected.name}
          {selected.size ? ` · ${selected.size}` : ''}
          {selected.color ? ` · ${selected.color}` : ''}
        </span>
        <span className="text-xs text-gray-400 font-mono">{selected.barcode}</span>
        <button onClick={onClear} className="text-gray-400 hover:text-red-500 ml-1">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search product…"
          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {loading && <Spinner size="sm" className="absolute right-2.5 top-1/2 -translate-y-1/2" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-20 top-full mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {results.map(p => (
            <button
              key={p.id}
              onClick={() => { onSelect(p); setQuery(''); setOpen(false) }}
              className="w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Package className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{p.name}</p>
                <p className="text-xs text-gray-400">{p.barcode}{p.size ? ` · ${p.size}` : ''} · Stock: {p.stock_quantity}</p>
              </div>
              <span className="text-xs font-semibold text-blue-600 flex-shrink-0">₹{p.selling_price}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export const PurchaseEntry: React.FC = () => {
  const { activeShop } = useShopStore()
  const [tab, setTab] = useState<'new' | 'history'>('new')

  // New purchase form state
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<LineItem[]>([newLineItem()])
  const [saving, setSaving] = useState(false)

  // History state
  const [history, setHistory] = useState<(PurchaseInvoice & { purchase_items: PurchaseItem[] })[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!activeShop) return
    suppliersDb.list(activeShop.id).then(setSuppliers).catch(() => {})
  }, [activeShop?.id])

  const loadHistory = useCallback(async () => {
    if (!activeShop) return
    setHistoryLoading(true)
    try {
      setHistory(await purchaseInvoicesDb.list(activeShop.id))
    } catch (e: unknown) {
      toast.error(getErrorMessage(e))
    } finally {
      setHistoryLoading(false)
    }
  }, [activeShop?.id])

  useEffect(() => {
    if (tab === 'history') loadHistory()
  }, [tab, loadHistory])

  const addItem = () => setItems(prev => [...prev, newLineItem()])

  const removeItem = (id: string) => {
    if (items.length === 1) return
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const updateItem = (id: string, updates: Partial<LineItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
  }

  const selectProduct = (lineId: string, p: Product) => {
    updateItem(lineId, {
      product: p,
      productId: p.id,
      barcode: p.barcode,
      productName: p.name,
      sellingPrice: p.selling_price,
      mrp: p.mrp,
      unitCost: p.purchase_price > 0 ? p.purchase_price : 0,
    })
  }

  const clearProduct = (lineId: string) => {
    updateItem(lineId, {
      product: null, productId: null, barcode: '',
      productName: '', sellingPrice: 0, mrp: 0, unitCost: 0,
    })
  }

  const handleSupplierChange = (id: string) => {
    setSupplierId(id)
    const s = suppliers.find(s => s.id === id)
    setSupplierName(s ? s.name : '')
  }

  const totalCost = items.reduce((s, i) => s + i.quantity * i.unitCost, 0)
  const totalQty = items.reduce((s, i) => s + i.quantity, 0)
  const validItems = items.filter(i => i.productId && i.quantity > 0)

  const handleSave = async () => {
    if (!activeShop) return
    if (!supplierName.trim()) { toast.error('Select or enter a supplier'); return }
    if (validItems.length === 0) { toast.error('Add at least one product'); return }

    setSaving(true)
    try {
      await purchaseInvoicesDb.create(
        activeShop.id,
        { supplierId: supplierId || null, supplierName, invoiceNumber, invoiceDate, notes, billerName: '' },
        validItems.map(i => ({
          productId: i.productId,
          barcode: i.barcode,
          productName: i.productName,
          quantity: i.quantity,
          unitCost: i.unitCost,
          sellingPrice: i.sellingPrice,
          mrp: i.mrp,
        }))
      )
      toast.success(`Purchase saved · ${validItems.length} product${validItems.length > 1 ? 's' : ''} · ₹${totalCost.toFixed(2)}`)
      // Reset form
      setSupplierId('')
      setSupplierName('')
      setInvoiceNumber('')
      setInvoiceDate(new Date().toISOString().slice(0, 10))
      setNotes('')
      setItems([newLineItem()])
    } catch (e: unknown) {
      toast.error(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (!activeShop) return null

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Purchase Entry</h2>
        <p className="text-sm text-gray-500 mt-0.5">Record stock received from suppliers · {activeShop.name}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {(['new', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === t
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t === 'new' ? 'New Purchase' : 'Purchase History'}
          </button>
        ))}
      </div>

      {/* ── NEW PURCHASE TAB ── */}
      {tab === 'new' && (
        <div className="space-y-5">
          {/* Invoice Details */}
          <Card>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Invoice Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Supplier *</label>
                <select
                  value={supplierId}
                  onChange={e => handleSupplierChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select supplier…</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {!supplierId && (
                  <input
                    value={supplierName}
                    onChange={e => setSupplierName(e.target.value)}
                    placeholder="Or type supplier name"
                    className="mt-1.5 w-full px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                )}
              </div>
              <Input
                label="Invoice Number"
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                placeholder="INV-001 (optional)"
              />
              <Input
                label="Invoice Date"
                type="date"
                value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)}
              />
              <Input
                label="Notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes…"
              />
            </div>
          </Card>

          {/* Line Items */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Products Received</h3>
              <Button variant="outline" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={addItem}>
                Add Row
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-start p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  {/* Index */}
                  <div className="col-span-12 sm:col-span-1 flex items-center">
                    <span className="text-xs font-medium text-gray-400 w-5">{idx + 1}.</span>
                  </div>
                  {/* Product search */}
                  <div className="col-span-12 sm:col-span-5">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Product</label>
                    <ProductSearch
                      shopId={activeShop.id}
                      selected={item.product}
                      onSelect={p => selectProduct(item.id, p)}
                      onClear={() => clearProduct(item.id)}
                    />
                  </div>
                  {/* Quantity */}
                  <div className="col-span-4 sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Qty *</label>
                    <input
                      type="number" min="1"
                      value={item.quantity}
                      onChange={e => updateItem(item.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-full px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {/* Unit cost */}
                  <div className="col-span-4 sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Cost/Unit ₹</label>
                    <input
                      type="number" min="0" step="0.01"
                      value={item.unitCost || ''}
                      onChange={e => updateItem(item.id, { unitCost: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                  {/* Total */}
                  <div className="col-span-3 sm:col-span-1 flex flex-col justify-end">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Total</label>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 py-2">
                      ₹{(item.quantity * item.unitCost).toFixed(2)}
                    </p>
                  </div>
                  {/* Remove */}
                  <div className="col-span-1 flex items-end pb-1.5">
                    <button
                      onClick={() => removeItem(item.id)}
                      disabled={items.length === 1}
                      className="p-1.5 text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary row */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {validItems.length} of {items.length} rows valid · {totalQty} units total
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Total Purchase Cost</p>
                <p className="text-2xl font-bold text-blue-600">₹{totalCost.toFixed(2)}</p>
              </div>
            </div>
          </Card>

          <div className="flex justify-end gap-3">
            <Button
              onClick={handleSave}
              loading={saving}
              size="lg"
              icon={<ShoppingBag className="w-4 h-4" />}
              disabled={validItems.length === 0}
            >
              Save Purchase Entry
            </Button>
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === 'history' && (
        historyLoading ? (
          <div className="flex items-center justify-center h-40"><Spinner size="lg" /></div>
        ) : history.length === 0 ? (
          <Card>
            <EmptyState
              icon={<FileText className="w-10 h-10" />}
              title="No purchase history"
              description="Saved purchases will appear here."
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {history.map(inv => (
              <Card key={inv.id}>
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <ShoppingBag className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {inv.supplier_name}
                        {inv.invoice_number && <span className="text-gray-400 font-normal ml-2">#{inv.invoice_number}</span>}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(inv.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        &nbsp;·&nbsp;{inv.total_quantity} units &nbsp;·&nbsp; {inv.total_items} products
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-gray-900 dark:text-gray-100">₹{Number(inv.total_cost).toFixed(2)}</p>
                      <Badge variant="success" className="text-xs">Received</Badge>
                    </div>
                    {expandedId === inv.id
                      ? <ChevronUp className="w-4 h-4 text-gray-400" />
                      : <ChevronDown className="w-4 h-4 text-gray-400" />
                    }
                  </div>
                </div>

                {expandedId === inv.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 uppercase">
                          <th className="text-left pb-2">Product</th>
                          <th className="text-right pb-2">Qty</th>
                          <th className="text-right pb-2">Cost/Unit</th>
                          <th className="text-right pb-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(inv.purchase_items || []).map(pi => (
                          <tr key={pi.id} className="border-t border-gray-100 dark:border-gray-700/50">
                            <td className="py-2">
                              <p className="font-medium text-gray-900 dark:text-gray-100">{pi.product_name}</p>
                              <p className="text-xs text-gray-400 font-mono">{pi.barcode}</p>
                            </td>
                            <td className="text-right py-2 text-gray-700 dark:text-gray-300">{pi.quantity}</td>
                            <td className="text-right py-2 text-gray-700 dark:text-gray-300">₹{Number(pi.unit_cost).toFixed(2)}</td>
                            <td className="text-right py-2 font-semibold text-gray-900 dark:text-gray-100">₹{Number(pi.total_cost).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {inv.notes && <p className="text-xs text-gray-400 mt-2">Note: {inv.notes}</p>}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  )
}
