import React, { useState, useEffect, useCallback } from 'react'
import { useShopStore } from '../store/shopStore'
import { inventoryMovementsDb } from '../lib/database'
import { Card, Spinner, Badge, EmptyState, Input } from '../components/ui'
import { Activity, ArrowDownCircle, ArrowUpCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import type { InventoryMovement, Product } from '../types'

const MOVEMENT_LABELS: Record<string, { label: string; color: 'success' | 'danger' | 'info' | 'warning' | 'default' }> = {
  IN:           { label: 'Stock In',       color: 'success' },
  OUT:          { label: 'Sale Out',        color: 'danger'  },
  PURCHASE:     { label: 'Purchase',        color: 'success' },
  RETURN_IN:    { label: 'Return In',       color: 'info'    },
  EXCHANGE_IN:  { label: 'Exchange In',     color: 'info'    },
  EXCHANGE_OUT: { label: 'Exchange Out',    color: 'warning' },
  TRANSFER_IN:  { label: 'Transfer In',     color: 'success' },
  TRANSFER_OUT: { label: 'Transfer Out',    color: 'warning' },
  ADJUSTMENT:   { label: 'Adjustment',      color: 'default' },
}

const REF_LABELS: Record<string, string> = {
  BILL: 'Bill', RETURN: 'Return', EXCHANGE: 'Exchange',
  MANUAL: 'Manual', PURCHASE: 'Purchase', TRANSFER: 'Transfer',
}

const PAGE_SIZE = 50

export const StockMovements: React.FC = () => {
  const { activeShop } = useShopStore()
  const [movements, setMovements] = useState<(InventoryMovement & { product: Product | null })[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)

  // Filters
  const [search, setSearch] = useState('')
  const [movType, setMovType] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const load = useCallback(async () => {
    if (!activeShop) return
    setLoading(true)
    try {
      const { data, count } = await inventoryMovementsDb.list(activeShop.id, {
        search: search || undefined,
        movementType: movType || undefined,
        from: fromDate ? `${fromDate}T00:00:00` : undefined,
        to: toDate ? `${toDate}T23:59:59` : undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      })
      setMovements(data)
      setTotal(count)
    } catch (e: unknown) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [activeShop?.id, search, movType, fromDate, toDate, page])

  useEffect(() => {
    setPage(0)
  }, [search, movType, fromDate, toDate, activeShop?.id])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const isOut = (type: string) =>
    ['OUT', 'EXCHANGE_OUT', 'TRANSFER_OUT'].includes(type)

  if (!activeShop) return null

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Stock Movements</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Complete inventory audit log · {activeShop.name}
            {total > 0 && <span className="ml-1">· {total} records</span>}
          </p>
        </div>
        <button
          onClick={() => load()}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Input
            placeholder="Search product or ref…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div>
            <select
              value={movType}
              onChange={e => setMovType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Movement Types</option>
              {Object.entries(MOVEMENT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <Input
            label=""
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            placeholder="From date"
          />
          <Input
            label=""
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            placeholder="To date"
          />
        </div>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48"><Spinner size="lg" /></div>
      ) : movements.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Activity className="w-10 h-10" />}
            title="No movements found"
            description="Stock movements will appear here as products are bought, sold, transferred, or adjusted."
          />
        </Card>
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date & Time</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Type</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Before → After</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reference</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m, i) => {
                  const movMeta = MOVEMENT_LABELS[m.movement_type] ?? { label: m.movement_type, color: 'default' as const }
                  const out = isOut(m.movement_type)
                  return (
                    <tr
                      key={m.id}
                      className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30 dark:bg-gray-800/20'}`}
                    >
                      {/* Date */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-gray-700 dark:text-gray-300 font-medium">
                          {new Date(m.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </td>
                      {/* Product */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[180px]">
                          {m.product?.name ?? '—'}
                        </p>
                        <p className="text-xs text-gray-400 font-mono">{m.product?.barcode}</p>
                      </td>
                      {/* Type */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {out
                            ? <ArrowUpCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                            : <ArrowDownCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                          }
                          <Badge variant={movMeta.color}>{movMeta.label}</Badge>
                        </div>
                      </td>
                      {/* Qty */}
                      <td className={`px-4 py-3 text-right font-bold ${out ? 'text-red-500' : 'text-green-600'}`}>
                        {out ? '−' : '+'}{m.quantity}
                      </td>
                      {/* Before / After */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="text-gray-500">{m.quantity_before}</span>
                        <span className="text-gray-300 mx-1.5">→</span>
                        <span className={`font-semibold ${m.quantity_after <= 0 ? 'text-red-500' : 'text-gray-900 dark:text-gray-100'}`}>
                          {m.quantity_after}
                        </span>
                      </td>
                      {/* Reference */}
                      <td className="px-4 py-3">
                        {m.reference_type && (
                          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                            {REF_LABELS[m.reference_type] ?? m.reference_type}
                          </span>
                        )}
                        {m.reference_number && (
                          <p className="text-xs text-gray-400 font-mono mt-0.5">{m.reference_number}</p>
                        )}
                      </td>
                      {/* Notes */}
                      <td className="px-4 py-3">
                        {m.notes && <p className="text-xs text-gray-400 truncate max-w-[120px]">{m.notes}</p>}
                        {m.biller_name && <p className="text-xs text-gray-400">{m.biller_name}</p>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500">
                Page {page + 1} of {totalPages} · {total} total
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
