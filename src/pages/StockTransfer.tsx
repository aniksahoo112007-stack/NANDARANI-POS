import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useShopStore } from '../store/shopStore'
import { stockTransfersDb, products as productsDb, getErrorMessage } from '../lib/database'
import { Button, Input, Card, Spinner, Badge, EmptyState, Modal } from '../components/ui'
import {
  Plus, Trash2, ArrowRight, Package, Search, Check, X,
  Info, ChevronDown, ChevronUp, Repeat2, Clock, CheckCircle,
  XCircle, Send, GitPullRequest, History
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Product, StockTransfer as StockTransferRecord, StockTransferItem as StockTransferItemRecord, Shop } from '../types'

interface TransferLine {
  id: string
  fromProduct: Product | null
  toProductExists: boolean
  barcode: string
  productName: string
  quantity: number
  unitCost: number
  stockAvailable: number
  toShopStock: number
}

const newLine = (): TransferLine => ({
  id: crypto.randomUUID(),
  fromProduct: null, toProductExists: false,
  barcode: '', productName: '', quantity: 1, unitCost: 0,
  stockAvailable: 0, toShopStock: 0,
})

const ProductSearchRow: React.FC<{
  line: TransferLine; fromShopId: string; toShopId: string
  onUpdate: (u: Partial<TransferLine>) => void; onRemove: () => void; index: number
}> = ({ line, fromShopId, toShopId, onUpdate, onRemove, index }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try { const { data } = await productsDb.list(fromShopId, { search: q, limit: 6 }); setResults(data) }
    finally { setLoading(false) }
  }, [fromShopId])

  useEffect(() => { const t = setTimeout(() => search(query), 250); return () => clearTimeout(t) }, [query, search])

  const selectProduct = async (p: Product) => {
    setQuery(''); setOpen(false)
    try {
      const destProduct = await productsDb.getByBarcode(toShopId, p.barcode)
      onUpdate({ fromProduct: p, toProductExists: !!destProduct, barcode: p.barcode, productName: p.name,
        unitCost: p.purchase_price, stockAvailable: p.stock_quantity, toShopStock: destProduct?.stock_quantity ?? 0 })
    } catch {
      onUpdate({ fromProduct: p, toProductExists: false, barcode: p.barcode, productName: p.name,
        unitCost: p.purchase_price, stockAvailable: p.stock_quantity, toShopStock: 0 })
    }
  }

  const clearProduct = () => onUpdate({ fromProduct: null, toProductExists: false, barcode: '', productName: '', quantity: 1, unitCost: 0, stockAvailable: 0, toShopStock: 0 })
  const overStock = line.fromProduct ? line.quantity > line.stockAvailable : false
  const noStock = line.fromProduct ? line.stockAvailable === 0 : false

  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-3">
      <div className="grid grid-cols-12 gap-2 items-start">
        <div className="col-span-1 pt-6 flex items-center">
          <span className="text-xs font-medium text-gray-400">{index + 1}.</span>
        </div>
        <div className="col-span-11 sm:col-span-5">
          <label className="block text-xs font-medium text-gray-500 mb-1">Product (source shop)</label>
          {line.fromProduct ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{line.productName}</p>
                <p className="text-xs text-gray-400 font-mono">{line.barcode} · Stock: {line.stockAvailable}</p>
              </div>
              <button onClick={clearProduct} className="text-gray-400 hover:text-red-500 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <div ref={ref} className="relative">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input value={query} onChange={e => { setQuery(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)}
                  placeholder="Search product…"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {loading && <Spinner size="sm" className="absolute right-2.5 top-1/2 -translate-y-1/2" />}
              </div>
              {open && results.length > 0 && (
                <div className="absolute z-20 top-full mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {results.map(p => (
                    <button key={p.id} onClick={() => selectProduct(p)}
                      className="w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700">
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
        <div className="col-span-4 sm:col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">Qty *</label>
          <input type="number" min="1" value={line.quantity}
            onChange={e => onUpdate({ quantity: Math.max(1, parseInt(e.target.value) || 1) })}
            className={`w-full px-2 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${overStock || noStock ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`} />
          {noStock && <p className="text-xs text-red-500 mt-0.5">No stock</p>}
          {!noStock && overStock && <p className="text-xs text-red-500 mt-0.5">Max: {line.stockAvailable}</p>}
        </div>
        <div className="col-span-4 sm:col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">Cost/Unit ₹</label>
          <input type="number" min="0" step="0.01" value={line.unitCost || ''} placeholder="0.00"
            onChange={e => onUpdate({ unitCost: parseFloat(e.target.value) || 0 })}
            className="w-full px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="col-span-2 sm:col-span-2 flex items-end pb-1.5 justify-end">
          <button onClick={onRemove} className="p-1.5 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      {line.fromProduct && !noStock && !overStock && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-600 dark:text-blue-400">
          <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
          {line.toProductExists
            ? <span>Destination stock: {line.toShopStock} → after transfer: {line.toShopStock + line.quantity}</span>
            : <span>Product not in destination — will be <strong>auto-created</strong> with all details copied</span>}
        </div>
      )}
      {(noStock || overStock) && line.fromProduct && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs text-red-600 dark:text-red-400">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{noStock ? 'Zero stock in source shop.' : `Only ${line.stockAvailable} units available.`}</span>
        </div>
      )}
    </div>
  )
}

// Status badge helper
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
    APPROVED:  { label: 'Approved',  cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    REJECTED:  { label: 'Rejected',  cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
    COMPLETED: { label: 'Completed', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
    CANCELLED: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
  }
  const s = map[status] || { label: status, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>
}

export const StockTransfer: React.FC = () => {
  const { shops, activeShop } = useShopStore()
  const [mainTab, setMainTab] = useState<'direct' | 'request' | 'history'>('direct')
  const [reqTab, setReqTab] = useState<'outgoing' | 'incoming'>('incoming')

  // ── Direct transfer state ──
  const [toShopId, setToShopId] = useState('')
  const [lines, setLines] = useState<TransferLine[]>([newLine()])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Request state ──
  const [reqToShopId, setReqToShopId] = useState('')
  const [reqLines, setReqLines] = useState<TransferLine[]>([newLine()])
  const [reqNotes, setReqNotes] = useState('')
  const [reqRequestedBy, setReqRequestedBy] = useState('')
  const [reqSaving, setReqSaving] = useState(false)
  const [requests, setRequests] = useState<(StockTransferRecord & { stock_transfer_items: StockTransferItemRecord[] })[]>([])
  const [reqLoading, setReqLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Reject modal
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectLoading, setRejectLoading] = useState(false)

  // Approve loading
  const [approveLoadingId, setApproveLoadingId] = useState<string | null>(null)

  // ── History state ──
  const [history, setHistory] = useState<(StockTransferRecord & { stock_transfer_items: StockTransferItemRecord[] })[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [histExpandedId, setHistExpandedId] = useState<string | null>(null)

  const otherShops = shops.filter(s => s.id !== activeShop?.id)

  useEffect(() => {
    if (otherShops.length > 0) {
      if (!toShopId) setToShopId(otherShops[0].id)
      if (!reqToShopId) setReqToShopId(otherShops[0].id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeShop?.id, shops.length])

  const loadRequests = useCallback(async () => {
    if (!activeShop) return
    setReqLoading(true)
    try { setRequests(await stockTransfersDb.listRequests(activeShop.id)) }
    catch (e) { toast.error(getErrorMessage(e)) }
    finally { setReqLoading(false) }
  }, [activeShop?.id])

  const loadHistory = useCallback(async () => {
    if (!activeShop) return
    setHistoryLoading(true)
    try { setHistory(await stockTransfersDb.list(activeShop.id)) }
    catch (e) { toast.error(getErrorMessage(e)) }
    finally { setHistoryLoading(false) }
  }, [activeShop?.id])

  useEffect(() => { if (mainTab === 'request') loadRequests() }, [mainTab, loadRequests])
  useEffect(() => { if (mainTab === 'history') loadHistory() }, [mainTab, loadHistory])

  const addLine = (setter: React.Dispatch<React.SetStateAction<TransferLine[]>>) =>
    setter(prev => [...prev, newLine()])
  const removeLine = (setter: React.Dispatch<React.SetStateAction<TransferLine[]>>, id: string) =>
    setter(prev => prev.length > 1 ? prev.filter(l => l.id !== id) : prev)
  const updateLine = (setter: React.Dispatch<React.SetStateAction<TransferLine[]>>, id: string, updates: Partial<TransferLine>) =>
    setter(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))

  const validLines = (ls: TransferLine[]) => ls.filter(
    l => l.fromProduct !== null && l.quantity > 0 && l.stockAvailable > 0 && l.quantity <= l.stockAvailable
  )

  const handleDirectTransfer = async () => {
    if (!activeShop || !toShopId) return
    if (activeShop.id === toShopId) { toast.error('Source and destination must differ'); return }
    const vl = validLines(lines)
    if (vl.length === 0) { toast.error('Add at least one product with valid stock'); return }
    setSaving(true)
    try {
      await stockTransfersDb.create(activeShop.id, toShopId,
        vl.map(l => ({ fromProductId: l.fromProduct!.id, barcode: l.barcode, productName: l.productName, quantity: l.quantity, unitCost: l.unitCost })),
        notes, '')
      toast.success(`Transfer complete · ${vl.reduce((s, l) => s + l.quantity, 0)} units moved`)
      setLines([newLine()]); setNotes('')
    } catch (e) { toast.error(getErrorMessage(e)) }
    finally { setSaving(false) }
  }

  const handleCreateRequest = async () => {
    if (!activeShop || !reqToShopId) return
    const vl = validLines(reqLines)
    if (vl.length === 0) { toast.error('Add at least one valid product'); return }
    if (!reqRequestedBy.trim()) { toast.error('Enter requester name'); return }
    setReqSaving(true)
    try {
      await stockTransfersDb.createRequest(activeShop.id, reqToShopId,
        vl.map(l => ({ fromProductId: l.fromProduct!.id, barcode: l.barcode, productName: l.productName, quantity: l.quantity, unitCost: l.unitCost })),
        reqNotes, reqRequestedBy)
      toast.success('Transfer request sent — awaiting approval')
      setReqLines([newLine()]); setReqNotes(''); setReqRequestedBy('')
      loadRequests()
    } catch (e) { toast.error(getErrorMessage(e)) }
    finally { setReqSaving(false) }
  }

  const handleApprove = async (transferId: string) => {
    setApproveLoadingId(transferId)
    try {
      await stockTransfersDb.approveAndExecute(transferId, activeShop?.name || 'Manager')
      toast.success('Request approved — stock transferred')
      loadRequests()
    } catch (e) { toast.error(getErrorMessage(e)) }
    finally { setApproveLoadingId(null) }
  }

  const handleReject = async () => {
    if (!rejectId) return
    setRejectLoading(true)
    try {
      await stockTransfersDb.rejectRequest(rejectId, activeShop?.name || 'Manager', rejectReason)
      toast.success('Request rejected')
      setRejectId(null); setRejectReason('')
      loadRequests()
    } catch (e) { toast.error(getErrorMessage(e)) }
    finally { setRejectLoading(false) }
  }

  const getShopName = (shopId: string) => shops.find(s => s.id === shopId)?.name ?? shopId

  const outgoingReqs = requests.filter(r => r.from_shop_id === activeShop?.id)
  const incomingReqs = requests.filter(r => r.to_shop_id === activeShop?.id && r.status === 'PENDING')

  if (!activeShop) return null

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Stock Transfer</h2>
        <p className="text-sm text-gray-500 mt-0.5">Direct transfer or request-based approval workflow</p>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {([
          { key: 'direct' as const, label: 'Direct Transfer', icon: <Repeat2 className="w-3.5 h-3.5" />, badge: 0 },
          { key: 'request' as const, label: 'Requests', icon: <GitPullRequest className="w-3.5 h-3.5" />, badge: incomingReqs.length },
          { key: 'history' as const, label: 'History', icon: <History className="w-3.5 h-3.5" />, badge: 0 },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setMainTab(t.key)}
            className={`relative flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              mainTab === t.key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            {t.icon} {t.label}
            {t.badge ? (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{t.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ══ DIRECT TRANSFER ══ */}
      {mainTab === 'direct' && (
        <div className="space-y-5">
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
              <ArrowRight className="w-6 h-6 text-gray-400 flex-shrink-0" />
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">To (Destination) *</label>
                {otherShops.length === 0 ? (
                  <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600">No other shops available</p>
                  </div>
                ) : (
                  <select value={toShopId} onChange={e => { setToShopId(e.target.value); setLines([newLine()]) }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {otherShops.map((s: Shop) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
              </div>
            </div>
          </Card>

          {otherShops.length > 0 && toShopId && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  Products <span className="text-gray-400 font-normal text-sm">→ {getShopName(toShopId)}</span>
                </h3>
                <Button variant="outline" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => addLine(setLines)}>Add Row</Button>
              </div>
              <div className="space-y-3">
                {lines.map((line, idx) => (
                  <ProductSearchRow key={line.id} line={line} fromShopId={activeShop.id} toShopId={toShopId}
                    onUpdate={u => updateLine(setLines, line.id, u)} onRemove={() => removeLine(setLines, line.id)} index={idx} />
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Input label="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reason for transfer…" />
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <p className="text-sm text-gray-500">{validLines(lines).length} valid of {lines.length} rows</p>
                <Button onClick={handleDirectTransfer} loading={saving} icon={<Repeat2 className="w-4 h-4" />} disabled={validLines(lines).length === 0}>
                  Execute Transfer
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ══ REQUEST WORKFLOW ══ */}
      {mainTab === 'request' && (
        <div className="space-y-5">
          {/* Sub-tabs */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
            {([
              { key: 'incoming' as const, label: 'Incoming Requests', badge: incomingReqs.length },
              { key: 'outgoing' as const, label: 'Send Request', badge: 0 },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setReqTab(t.key)}
                className={`relative flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  reqTab === t.key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}>
                {t.label}
                {t.badge ? <span className="ml-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{t.badge}</span> : null}
              </button>
            ))}
          </div>

          {/* Incoming requests */}
          {reqTab === 'incoming' && (
            reqLoading ? (
              <div className="flex justify-center py-12"><Spinner className="w-6 h-6" /></div>
            ) : incomingReqs.length === 0 ? (
              <Card>
                <EmptyState icon={<Clock className="w-10 h-10" />} title="No pending requests"
                  description="Requests from other shops will appear here for approval." />
              </Card>
            ) : (
              <div className="space-y-3">
                {incomingReqs.map(t => (
                  <Card key={t.id}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <GitPullRequest className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                            {getShopName(t.from_shop_id)} <ArrowRight className="w-3.5 h-3.5 inline mx-1 text-gray-400" /> {getShopName(t.to_shop_id)}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {t.transfer_number} · {new Date(t.created_at).toLocaleDateString('en-IN')}
                            {t.requested_by && ` · Requested by: ${t.requested_by}`}
                          </p>
                          {t.notes && <p className="text-xs text-gray-400 mt-0.5">Note: {t.notes}</p>}
                        </div>
                      </div>
                      <StatusBadge status={t.status} />
                    </div>

                    {/* Items */}
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <div className="space-y-1 mb-4">
                        {(t.stock_transfer_items || []).map(si => (
                          <div key={si.id} className="flex items-center justify-between text-sm">
                            <div>
                              <span className="font-medium text-gray-900 dark:text-gray-100">{si.product_name}</span>
                              <span className="text-xs text-gray-400 ml-2 font-mono">{si.barcode}</span>
                            </div>
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{si.quantity} units</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="primary" size="sm" icon={<CheckCircle className="w-3.5 h-3.5" />}
                          loading={approveLoadingId === t.id} onClick={() => handleApprove(t.id)}>
                          Approve & Transfer
                        </Button>
                        <Button variant="outline" size="sm" icon={<XCircle className="w-3.5 h-3.5" />}
                          onClick={() => { setRejectId(t.id); setRejectReason('') }}>
                          Reject
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )
          )}

          {/* Send new request */}
          {reqTab === 'outgoing' && (
            <div className="space-y-5">
              <Card>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Request Route</h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">From (This Shop)</label>
                    <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">{activeShop.name}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-6 h-6 text-gray-400 flex-shrink-0" />
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">To (Receiving Shop) *</label>
                    {otherShops.length === 0 ? (
                      <p className="text-sm text-red-600">No other shops available</p>
                    ) : (
                      <select value={reqToShopId} onChange={e => { setReqToShopId(e.target.value); setReqLines([newLine()]) }}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {otherShops.map((s: Shop) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              </Card>

              {otherShops.length > 0 && reqToShopId && (
                <Card>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      Products to Request <span className="text-gray-400 font-normal text-sm">→ {getShopName(reqToShopId)}</span>
                    </h3>
                    <Button variant="outline" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => addLine(setReqLines)}>Add Row</Button>
                  </div>
                  <div className="space-y-3">
                    {reqLines.map((line, idx) => (
                      <ProductSearchRow key={line.id} line={line} fromShopId={activeShop.id} toShopId={reqToShopId}
                        onUpdate={u => updateLine(setReqLines, line.id, u)} onRemove={() => removeLine(setReqLines, line.id)} index={idx} />
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                    <Input label="Requested By *" value={reqRequestedBy} onChange={e => setReqRequestedBy(e.target.value)} placeholder="Your name" />
                    <Input label="Notes (optional)" value={reqNotes} onChange={e => setReqNotes(e.target.value)} placeholder="Reason for request…" />
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500">{validLines(reqLines).length} valid products</p>
                    <Button onClick={handleCreateRequest} loading={reqSaving} icon={<Send className="w-4 h-4" />} disabled={validLines(reqLines).length === 0}>
                      Send Request
                    </Button>
                  </div>
                </Card>
              )}

              {/* Outgoing request history */}
              {outgoingReqs.length > 0 && (
                <Card>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">My Sent Requests</h3>
                  <div className="space-y-2">
                    {outgoingReqs.map(t => (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.transfer_number}</p>
                          <p className="text-xs text-gray-500">→ {getShopName(t.to_shop_id)} · {(t.stock_transfer_items || []).length} items</p>
                          {t.rejection_reason && <p className="text-xs text-red-500 mt-0.5">Reason: {t.rejection_reason}</p>}
                        </div>
                        <StatusBadge status={t.status} />
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ HISTORY ══ */}
      {mainTab === 'history' && (
        historyLoading ? (
          <div className="flex items-center justify-center h-40"><Spinner size="lg" /></div>
        ) : history.filter(t => t.status === 'COMPLETED').length === 0 ? (
          <Card>
            <EmptyState icon={<Repeat2 className="w-10 h-10" />} title="No transfer history" description="Completed transfers will appear here." />
          </Card>
        ) : (
          <div className="space-y-3">
            {history.filter(t => t.status === 'COMPLETED').map(t => (
              <Card key={t.id}>
                <div className="flex items-center justify-between cursor-pointer"
                  onClick={() => setHistExpandedId(histExpandedId === t.id ? null : t.id)}>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Repeat2 className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                        {getShopName(t.from_shop_id)} <ArrowRight className="w-3.5 h-3.5 inline mx-1.5 text-gray-400" /> {getShopName(t.to_shop_id)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        &nbsp;·&nbsp;{(t.stock_transfer_items || []).length} product{(t.stock_transfer_items || []).length !== 1 ? 's' : ''}
                        &nbsp;·&nbsp;{t.transfer_number}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="success">Completed</Badge>
                    {histExpandedId === t.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>
                {histExpandedId === t.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <table className="w-full text-sm">
                      <thead><tr className="text-xs text-gray-500 uppercase"><th className="text-left pb-2">Product</th><th className="text-right pb-2">Qty</th></tr></thead>
                      <tbody>
                        {(t.stock_transfer_items || []).map(si => (
                          <tr key={si.id} className="border-t border-gray-100 dark:border-gray-700/50">
                            <td className="py-2"><p className="font-medium text-gray-900 dark:text-gray-100">{si.product_name}</p><p className="text-xs text-gray-400 font-mono">{si.barcode}</p></td>
                            <td className="text-right py-2 font-semibold text-gray-900 dark:text-gray-100">{si.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {t.notes && <p className="text-xs text-gray-400 mt-2">Note: {t.notes}</p>}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )
      )}

      {/* Reject modal */}
      <Modal isOpen={!!rejectId} onClose={() => setRejectId(null)} title="Reject Transfer Request" size="sm">
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Provide a reason for rejection (optional but recommended).</p>
          <Input label="Rejection Reason" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. Insufficient stock at source…" />
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setRejectId(null)}>Cancel</Button>
            <Button variant="danger" loading={rejectLoading} onClick={handleReject} icon={<XCircle className="w-4 h-4" />}>Reject Request</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
