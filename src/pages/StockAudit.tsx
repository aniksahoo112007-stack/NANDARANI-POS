import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useShopStore } from '../store/shopStore'
import { products as productsDb, stockAuditsDb, getErrorMessage } from '../lib/database'
import { Button, Card, Badge, Input, EmptyState, Modal, Spinner } from '../components/ui'
import {
  ClipboardCheck, Plus, Search, Save, CheckCircle, Trash2,
  TrendingDown, TrendingUp, Minus, RefreshCw, AlertTriangle, FileText
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate, formatCurrency } from '../lib/utils'
import type { Product, StockAudit as StockAuditRecord, StockAuditItem } from '../types'

interface AuditLine {
  product: Product
  physical: number
  reason: string
}

export const StockAudit: React.FC = () => {
  const { activeShop } = useShopStore()
  const [tab, setTab] = useState<'new' | 'history'>('new')

  // ─── New audit state ──────────────────────────────────────────
  const [auditDate, setAuditDate] = useState(new Date().toISOString().split('T')[0])
  const [billerName, setBillerName] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<AuditLine[]>([])
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmAuditId, setConfirmAuditId] = useState<string | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  // ─── History state ────────────────────────────────────────────
  const [audits, setAudits] = useState<StockAuditRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // ─── Load all products for bulk load ─────────────────────────
  const [loadingAll, setLoadingAll] = useState(false)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      if (!activeShop) return
      const { data } = await productsDb.list(activeShop.id, { search, limit: 8 })
      setSearchResults(data.filter(p => !lines.find(l => l.product.id === p.id)))
      setSearchOpen(true)
    }, 250)
    return () => clearTimeout(t)
  }, [search, activeShop?.id])

  const loadHistory = useCallback(async () => {
    if (!activeShop) return
    setHistoryLoading(true)
    try {
      const data = await stockAuditsDb.list(activeShop.id)
      setAudits(data)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setHistoryLoading(false)
    }
  }, [activeShop?.id])

  useEffect(() => { if (tab === 'history') loadHistory() }, [tab, loadHistory])

  const addProduct = (p: Product) => {
    setLines(prev => [...prev, { product: p, physical: p.stock_quantity, reason: '' }])
    setSearch('')
    setSearchResults([])
    setSearchOpen(false)
  }

  const updateLine = (idx: number, physical: number, reason: string) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, physical, reason } : l))
  }

  const removeLine = (idx: number) => {
    setLines(prev => prev.filter((_, i) => i !== idx))
  }

  const loadAllProducts = async () => {
    if (!activeShop) return
    setLoadingAll(true)
    try {
      // Load all products (up to 500)
      const { data } = await productsDb.list(activeShop.id, { limit: 500 })
      const newLines = data
        .filter(p => !lines.find(l => l.product.id === p.id))
        .map(p => ({ product: p, physical: p.stock_quantity, reason: '' }))
      setLines(prev => [...prev, ...newLines])
      toast.success(`Loaded ${newLines.length} products`)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setLoadingAll(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!activeShop || lines.length === 0) { toast.error('Add at least one product to audit'); return }
    setSaving(true)
    try {
      const audit = await stockAuditsDb.create(activeShop.id, auditDate, notes || null, billerName || null)
      const items = lines.map(l => ({
        audit_id: audit.id,
        shop_id: activeShop.id,
        product_id: l.product.id,
        barcode: l.product.barcode,
        product_name: l.product.name,
        category: l.product.category,
        system_quantity: l.product.stock_quantity,
        physical_quantity: l.physical,
        variance: l.physical - l.product.stock_quantity,
        adjustment_reason: l.reason || null,
        is_adjusted: false,
      }))
      await stockAuditsDb.saveItems(audit.id, activeShop.id, items)
      toast.success('Audit draft saved')
      setConfirmAuditId(audit.id)
      setTab('history')
      loadHistory()
      setLines([])
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const handleConfirm = async (auditId: string) => {
    if (!activeShop) return
    setConfirming(true)
    try {
      await stockAuditsDb.confirm(auditId, activeShop.id, billerName || 'Staff')
      toast.success('Audit confirmed! Stock adjusted in inventory.')
      setConfirmAuditId(null)
      loadHistory()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setConfirming(false)
    }
  }

  const handleDelete = async (auditId: string) => {
    try {
      await stockAuditsDb.delete(auditId)
      toast.success('Audit deleted')
      setDeleteId(null)
      loadHistory()
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  // Summary
  const totalVariance = lines.reduce((s, l) => s + (l.physical - l.product.stock_quantity), 0)
  const overCount = lines.filter(l => l.physical > l.product.stock_quantity).length
  const underCount = lines.filter(l => l.physical < l.product.stock_quantity).length
  const exactCount = lines.filter(l => l.physical === l.product.stock_quantity).length

  if (!activeShop) return null

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-blue-600" /> Stock Audit
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Compare physical count with system stock and adjust</p>
        </div>
        <div className="flex gap-2">
          <Button variant={tab === 'new' ? 'primary' : 'outline'} size="sm" onClick={() => setTab('new')}>
            <Plus className="w-4 h-4" /> New Audit
          </Button>
          <Button variant={tab === 'history' ? 'primary' : 'outline'} size="sm" onClick={() => setTab('history')}>
            <FileText className="w-4 h-4" /> History
          </Button>
        </div>
      </div>

      {/* ─── New Audit Tab ─────────────────────────────────────── */}
      {tab === 'new' && (
        <div className="space-y-4">
          {/* Config */}
          <Card className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Audit Date" type="date" value={auditDate} onChange={e => setAuditDate(e.target.value)} />
              <Input label="Biller / Staff Name" value={billerName} onChange={e => setBillerName(e.target.value)} placeholder="Who is counting?" />
              <Input label="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. End of month audit" />
            </div>
          </Card>

          {/* Add products */}
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <div className="flex-1 min-w-64" ref={searchRef}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Add Product to Audit</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                    placeholder="Search by name or barcode…"
                    className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {searchOpen && searchResults.length > 0 && (
                    <div className="absolute z-20 top-full mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                      {searchResults.map(p => (
                        <button key={p.id} onClick={() => addProduct(p)}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{p.name}</p>
                            <p className="text-xs text-gray-400">{p.barcode} · Stock: {p.stock_quantity}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={loadAllProducts} loading={loadingAll}>
                <RefreshCw className="w-4 h-4" /> Load All Products
              </Button>
            </div>

            {/* Summary bar */}
            {lines.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
                <span className="text-gray-600 dark:text-gray-400 font-medium">{lines.length} items</span>
                <span className="text-red-600 flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5" /> {underCount} shortage</span>
                <span className="text-green-600 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> {overCount} excess</span>
                <span className="text-gray-500 flex items-center gap-1"><Minus className="w-3.5 h-3.5" /> {exactCount} exact</span>
                <span className={`font-semibold ${totalVariance < 0 ? 'text-red-600' : totalVariance > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                  Net variance: {totalVariance >= 0 ? '+' : ''}{totalVariance}
                </span>
              </div>
            )}

            {/* Lines table */}
            {lines.length === 0 ? (
              <EmptyState icon={<ClipboardCheck className="w-8 h-8 text-gray-400" />} title="No products added" description="Search or load all products to start counting" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 text-gray-600 dark:text-gray-400 font-medium">Product</th>
                      <th className="text-center py-2 text-gray-600 dark:text-gray-400 font-medium w-24">System</th>
                      <th className="text-center py-2 text-gray-600 dark:text-gray-400 font-medium w-28">Physical Count</th>
                      <th className="text-center py-2 text-gray-600 dark:text-gray-400 font-medium w-20">Variance</th>
                      <th className="text-left py-2 text-gray-600 dark:text-gray-400 font-medium">Reason (if variance)</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => {
                      const variance = line.physical - line.product.stock_quantity
                      return (
                        <tr key={line.product.id} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 pr-3">
                            <p className="font-medium text-gray-900 dark:text-gray-100 leading-tight">{line.product.name}</p>
                            <p className="text-xs text-gray-400">{line.product.barcode} {line.product.size && `· ${line.product.size}`} {line.product.color && `· ${line.product.color}`}</p>
                          </td>
                          <td className="py-2 text-center font-mono font-semibold text-gray-700 dark:text-gray-300">{line.product.stock_quantity}</td>
                          <td className="py-2 px-2">
                            <input
                              type="number" min="0"
                              value={line.physical}
                              onChange={e => updateLine(idx, parseInt(e.target.value) || 0, line.reason)}
                              className="w-full text-center border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-2 text-center">
                            <span className={`font-bold font-mono ${variance < 0 ? 'text-red-600' : variance > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                              {variance >= 0 ? '+' : ''}{variance}
                            </span>
                          </td>
                          <td className="py-2 px-2">
                            {variance !== 0 && (
                              <input
                                type="text"
                                value={line.reason}
                                onChange={e => updateLine(idx, line.physical, e.target.value)}
                                placeholder="Required for variance…"
                                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            )}
                          </td>
                          <td className="py-2">
                            <button onClick={() => removeLine(idx)} className="text-gray-400 hover:text-red-500 p-1">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {lines.length > 0 && (
            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setLines([])}>Clear All</Button>
              <Button variant="primary" size="md" onClick={handleSaveDraft} loading={saving} icon={<Save className="w-4 h-4" />}>
                Save Audit Draft
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ─── History Tab ─────────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="space-y-3">
          {historyLoading ? (
            <div className="flex justify-center py-12"><Spinner className="w-6 h-6" /></div>
          ) : audits.length === 0 ? (
            <EmptyState icon={<ClipboardCheck className="w-8 h-8 text-gray-400" />} title="No audits yet" description="Create a new audit to get started" />
          ) : (
            audits.map(audit => (
              <Card key={audit.id} className="p-4">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedId(expandedId === audit.id ? null : audit.id)}
                >
                  <div className="flex items-center gap-3">
                    <ClipboardCheck className={`w-5 h-5 ${audit.status === 'CONFIRMED' ? 'text-green-600' : 'text-amber-500'}`} />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{formatDate(audit.audit_date)}</p>
                      <p className="text-xs text-gray-500">{audit.total_items} items · Net variance: {audit.total_variance >= 0 ? '+' : ''}{audit.total_variance}</p>
                    </div>
                    <Badge variant={audit.status === 'CONFIRMED' ? 'success' : 'warning'}>{audit.status}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {audit.status === 'DRAFT' && (
                      <>
                        <Button variant="success" size="sm" onClick={e => { e.stopPropagation(); handleConfirm(audit.id) }} loading={confirming}>
                          <CheckCircle className="w-4 h-4" /> Confirm & Adjust Stock
                        </Button>
                        <Button variant="danger" size="sm" onClick={e => { e.stopPropagation(); setDeleteId(audit.id) }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {expandedId === audit.id && audit.stock_audit_items && (
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-500 text-xs">
                          <th className="text-left pb-2">Product</th>
                          <th className="text-center pb-2">System</th>
                          <th className="text-center pb-2">Physical</th>
                          <th className="text-center pb-2">Variance</th>
                          <th className="text-left pb-2">Reason</th>
                          <th className="text-center pb-2">Adjusted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {audit.stock_audit_items.map((item: StockAuditItem) => (
                          <tr key={item.id} className="border-t border-gray-100 dark:border-gray-800">
                            <td className="py-1.5">
                              <p className="font-medium">{item.product_name}</p>
                              <p className="text-xs text-gray-400">{item.barcode}</p>
                            </td>
                            <td className="text-center font-mono">{item.system_quantity}</td>
                            <td className="text-center font-mono">{item.physical_quantity}</td>
                            <td className="text-center">
                              <span className={`font-bold font-mono ${item.variance < 0 ? 'text-red-600' : item.variance > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                                {item.variance >= 0 ? '+' : ''}{item.variance}
                              </span>
                            </td>
                            <td className="text-gray-600 dark:text-gray-400 text-xs">{item.adjustment_reason || '—'}</td>
                            <td className="text-center">{item.is_adjusted ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> : <Minus className="w-4 h-4 text-gray-300 mx-auto" />}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}

      {/* Confirm Audit Modal */}
      <Modal
        isOpen={!!confirmAuditId}
        onClose={() => setConfirmAuditId(null)}
        title="Confirm Stock Audit"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Confirming this audit will automatically adjust inventory to match physical counts and create movement records. This cannot be undone.
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setConfirmAuditId(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => confirmAuditId && handleConfirm(confirmAuditId)} loading={confirming} icon={<CheckCircle className="w-4 h-4" />}>
              Confirm & Adjust Stock
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Audit?">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">This will permanently delete the audit draft. No stock changes will be made.</p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
          </div>
        </div>
      </Modal>

    </div>
  )
}
