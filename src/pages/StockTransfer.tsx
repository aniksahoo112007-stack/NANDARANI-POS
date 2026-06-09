import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useShopStore } from '../store/shopStore'
import { stockTransfersDb, products as productsDb, getErrorMessage } from '../lib/database'
import { Button, Input, Card, Spinner, Badge, EmptyState } from '../components/ui'
import {
  Plus, Trash2, ArrowRight, Package, Search, Check, X,
  Info, ChevronDown, ChevronUp, Repeat2
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Product, StockTransfer as StockTransferRecord, StockTransferItem as StockTransferItemRecord, Shop } from '../types'

interface TransferLine {
  id: string
  fromProduct: Product | null
  toProductExists: boolean    // true = found in dest shop, false = will be auto-created
  barcode: string
  productName: string
  quantity: number
  unitCost: number
  stockAvailable: number      // current stock in source shop
  toShopStock: number         // current stock in dest shop (0 if not found)
}

const newLine = (): TransferLine => ({
  id: crypto.randomUUID(),
  fromProduct: null, toProductExists: false,
  barcode: '', productName: '', quantity: 1, unitCost: 0,
  stockAvailable: 0, toShopStock: 0,
})

// Single product search row
const ProductSearchRow: React.FC<{
  line: TransferLine
  fromShopId: string
  toShopId: string
  onUpdate: (updates: Partial<TransferLine>) => void
  onRemove: () => void
  index: number
}> = ({ line, fromShopId, toShopId, onUpdate, onRemove, index }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const { data } = await productsDb.list(fromShopId, { search: q, limit: 6 })
      setResults(data)
    } finally { setLoading(false) }
  }, [fromShopId])

  useEffect(() => {
    const t = setTimeout(() => search(query), 250)
    return () => clearTimeout(t)
  }, [query, search])

  const selectProduct = async (p: Product) => {
    setQuery(''); setOpen(false)
    // Check if product exists in destination shop
    try {
      const destProduct = await productsDb.getByBarcode(toShopId, p.barcode)
      onUpdate({
        fromProduct: p,
        toProductExists: !!destProduct,
        barcode: p.barcode,
        productName: p.name,
        unitCost: p.purchase_price,
        stockAvailable: p.stock_quantity,
        toShopStock: destProduct?.stock_quantity ?? 0,
      })
    } catch {
      // If lookup fails, still allow transfer — auto-create will handle it
      onUpdate({
        fromProduct: p,
        toProductExists: false,
        barcode: p.barcode,
        productName: p.name,
        unitCost: p.purchase_price,
        stockAvailable: p.stock_quantity,
        toShopStock: 0,
      })
    }
  }

  const clearProduct = () => {
    onUpdate({
      fromProduct: null, toProductExists: false, barcode: '',
      productName: '', quantity: 1, unitCost: 0, stockAvailable: 0, toShopStock: 0,
    })
  }

  const overStock = line.fromProduct ? line.quantity > line.stockAvailable : false
  const noStock = line.fromProduct ? line.stockAvailable === 0 : false

  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-3">
      <div className="grid grid-cols-12 gap-2 items-start">
        {/* Index */}
        <div className="col-span-1 pt-6 flex items-center">
          <span className="text-xs font-medium text-gray-400">{index + 1}.</span>
        </div>

        {/* Product search */}
        <div className="col-span-11 sm:col-span-5">
          <label className="block text-xs font-medium text-gray-500 mb-1">Product (source shop)</label>
          {line.fromProduct ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{line.productName}</p>
                <p className="text-xs text-gray-400 font-mono">{line.barcode} · Stock: {line.stockAvailable}</p>
              </div>
              <button onClick={clearProduct} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
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
                <div className="absolute z-20 top-full mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {results.map(p => (
                    <button
                      key={p.id}
                      onClick={() => selectProduct(p)}
                      className="w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <Package className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.barcode} · Stock: {p.stock_quantity}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quantity */}
        <div className="col-span-4 sm:col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">Qty *</label>
          <input
            type="number" min="1"
            value={line.quantity}
            onChange={e => onUpdate({ quantity: Math.max(1, parseInt(e.target.value) || 1) })}
            className={`w-full px-2 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              overStock || noStock ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {noStock && <p className="text-xs text-red-500 mt-0.5">No stock available</p>}
          {!noStock && overStock && <p className="text-xs text-red-500 mt-0.5">Max: {line.stockAvailable}</p>}
        </div>

        {/* Cost */}
        <div className="col-span-4 sm:col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">Cost/Unit ₹</label>
          <input
            type="number" min="0" step="0.01"
            value={line.unitCost || ''}
            onChange={e => onUpdate({ unitCost: parseFloat(e.target.value) || 0 })}
            className="w-full px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0.00"
          />
        </div>

        {/* Remove */}
        <div className="col-span-2 sm:col-span-2 flex items-end pb-1.5 justify-end">
          <button onClick={onRemove} className="p-1.5 text-red-400 hover:text-red-600">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Destination stock status */}
      {line.fromProduct && !noStock && !overStock && (
        line.toProductExists ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-600 dark:text-blue-400">
            <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Destination stock: {line.toShopStock} → after transfer: {line.toShopStock + line.quantity}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-600 dark:text-blue-400">
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Product not found in destination shop — it will be <strong>automatically created</strong> with all details copied, then stocked in.</span>
          </div>
        )
      )}

      {(noStock || overStock) && line.fromProduct && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs text-red-600 dark:text-red-400">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{noStock ? 'This product has zero stock in the source shop.' : `Only ${line.stockAvailable} units available. Reduce quantity.`}</span>
        </div>
      )}
    </div>
  )
}

export const StockTransfer: React.FC = () => {
  const { shops, activeShop } = useShopStore()
  const [tab, setTab] = useState<'new' | 'history'>('new')

  // New transfer form
  const [toShopId, setToShopId] = useState('')
  const [lines, setLines] = useState<TransferLine[]>([newLine()])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // History
  const [history, setHistory] = useState<(StockTransferRecord & { stock_transfer_items: StockTransferItemRecord[] })[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const otherShops = shops.filter(s => s.id !== activeShop?.id)

  useEffect(() => {
    if (otherShops.length > 0 && !toShopId) setToShopId(otherShops[0].id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeShop?.id, shops.length])

  const loadHistory = useCallback(async () => {
    if (!activeShop) return
    setHistoryLoading(true)
    try {
      setHistory(await stockTransfersDb.list(activeShop.id))
    } catch (e: unknown) {
      toast.error(getErrorMessage(e))
    } finally {
      setHistoryLoading(false)
    }
  }, [activeShop?.id])

  useEffect(() => {
    if (tab === 'history') loadHistory()
  }, [tab, loadHistory])

  const addLine = () => setLines(prev => [...prev, newLine()])

  const removeLine = (id: string) => {
    if (lines.length === 1) return
    setLines(prev => prev.filter(l => l.id !== id))
  }

  const updateLine = (id: string, updates: Partial<TransferLine>) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))
  }

  // Valid = has a source product AND quantity is within available stock
  // Auto-create handles missing dest product — don't block on toProductExists
  const validLines = lines.filter(
    l => l.fromProduct !== null && l.quantity > 0 && l.stockAvailable > 0 && l.quantity <= l.stockAvailable
  )

  const handleSave = async () => {
    if (!activeShop || !toShopId) return
    if (activeShop.id === toShopId) { toast.error('Source and destination must be different shops'); return }
    if (validLines.length === 0) {
      toast.error('Add at least one product with valid quantity and sufficient source stock')
      return
    }

    setSaving(true)
    try {
      await stockTransfersDb.create(
        activeShop.id,
        toShopId,
        validLines.map(l => ({
          fromProductId: l.fromProduct!.id,
          barcode: l.barcode,
          productName: l.productName,
          quantity: l.quantity,
          unitCost: l.unitCost,
        })),
        notes,
        ''
      )
      toast.success(
        `Transfer complete · ${validLines.length} product${validLines.length > 1 ? 's' : ''} · ` +
        `${validLines.reduce((s, l) => s + l.quantity, 0)} units`
      )
      setLines([newLine()])
      setNotes('')
    } catch (e: unknown) {
      toast.error(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const toShop = shops.find(s => s.id === toShopId)
  const getShopName = (shopId: string) => shops.find(s => s.id === shopId)?.name ?? shopId

  if (!activeShop) return null

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Stock Transfer</h2>
        <p className="text-sm text-gray-500 mt-0.5">Move stock between shops · Products missing in dest shop are auto-created</p>
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
            {t === 'new' ? 'New Transfer' : 'Transfer History'}
          </button>
        ))}
      </div>

      {/* ── NEW TRANSFER ── */}
      {tab === 'new' && (
        <div className="space-y-5">
          {/* Shop selection */}
          <Card>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Transfer Route</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">From (Source)</label>
                <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">{activeShop.name}</p>
                  <p className="text-xs text-blue-400">Active shop</p>
                </div>
              </div>
              <div className="flex-shrink-0">
                <ArrowRight className="w-6 h-6 text-gray-400" />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">To (Destination) *</label>
                {otherShops.length === 0 ? (
                  <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600">No other shops available</p>
                  </div>
                ) : (
                  <select
                    value={toShopId}
                    onChange={e => { setToShopId(e.target.value); setLines([newLine()]) }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {otherShops.map((s: Shop) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </Card>

          {/* Line items */}
          {otherShops.length > 0 && toShopId && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  Products to Transfer
                  {toShop && <span className="text-gray-400 font-normal ml-2">→ {toShop.name}</span>}
                </h3>
                <Button variant="outline" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={addLine}>
                  Add Row
                </Button>
              </div>

              <div className="space-y-3">
                {lines.map((line, idx) => (
                  <ProductSearchRow
                    key={line.id}
                    line={line}
                    fromShopId={activeShop.id}
                    toShopId={toShopId}
                    onUpdate={updates => updateLine(line.id, updates)}
                    onRemove={() => removeLine(line.id)}
                    index={idx}
                  />
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Input
                  label="Notes (optional)"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Reason for transfer…"
                />
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <p className="text-sm text-gray-500">
                  {validLines.length} valid row{validLines.length !== 1 ? 's' : ''} of {lines.length}
                </p>
                <Button
                  onClick={handleSave}
                  loading={saving}
                  icon={<Repeat2 className="w-4 h-4" />}
                  disabled={validLines.length === 0}
                >
                  Execute Transfer
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── HISTORY ── */}
      {tab === 'history' && (
        historyLoading ? (
          <div className="flex items-center justify-center h-40"><Spinner size="lg" /></div>
        ) : history.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Repeat2 className="w-10 h-10" />}
              title="No transfer history"
              description="Completed transfers will appear here."
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {(history as StockTransferRecord[]).map(t => {
              const fullT = t as StockTransferRecord & { stock_transfer_items: StockTransferItemRecord[] }
              return (
                <Card key={t.id}>
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Repeat2 className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                          {getShopName(t.from_shop_id)}
                          <ArrowRight className="w-3.5 h-3.5 inline mx-1.5 text-gray-400" />
                          {getShopName(t.to_shop_id)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          &nbsp;·&nbsp;{fullT.stock_transfer_items?.length ?? 0} product{(fullT.stock_transfer_items?.length ?? 0) !== 1 ? 's' : ''}
                          &nbsp;·&nbsp;{t.transfer_number}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="success">Completed</Badge>
                      {expandedId === t.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>

                  {expandedId === t.id && (
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-500 uppercase">
                            <th className="text-left pb-2">Product</th>
                            <th className="text-right pb-2">Qty Transferred</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(fullT.stock_transfer_items || []).map((si: StockTransferItemRecord) => (
                            <tr key={si.id} className="border-t border-gray-100 dark:border-gray-700/50">
                              <td className="py-2">
                                <p className="font-medium text-gray-900 dark:text-gray-100">{si.product_name}</p>
                                <p className="text-xs text-gray-400 font-mono">{si.barcode}</p>
                              </td>
                              <td className="text-right py-2 font-semibold text-gray-900 dark:text-gray-100">{si.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {t.notes && <p className="text-xs text-gray-400 mt-2">Note: {t.notes}</p>}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
