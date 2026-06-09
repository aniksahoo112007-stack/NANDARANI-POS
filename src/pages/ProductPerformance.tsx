import React, { useState, useEffect, useCallback } from 'react'
import { useShopStore } from '../store/shopStore'
import { stockReportsDb, getErrorMessage } from '../lib/database'
import { Button, Card, Input, EmptyState, Spinner } from '../components/ui'
import {
  TrendingUp, Package, Filter, RefreshCw, Download, Search
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency, formatDate, exportToCSV } from '../lib/utils'
import type { ProductPerformance as ProductPerformanceType } from '../types'

const today = () => new Date().toISOString().split('T')[0]
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0] }

type SortKey = 'revenue' | 'profit' | 'stock_sold' | 'returns_qty' | 'current_stock'

export const ProductPerformance: React.FC = () => {
  const { activeShop } = useShopStore()
  const [from, setFrom] = useState(daysAgo(30))
  const [to, setTo] = useState(today())
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'custom'>('month')
  const [data, setData] = useState<ProductPerformanceType[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('revenue')
  const [categories, setCategories] = useState<string[]>([])

  useEffect(() => {
    if (period === 'week') { setFrom(daysAgo(7)); setTo(today()) }
    else if (period === 'month') { setFrom(daysAgo(30)); setTo(today()) }
    else if (period === 'quarter') { setFrom(daysAgo(90)); setTo(today()) }
  }, [period])

  const load = useCallback(async () => {
    if (!activeShop) return
    setLoading(true)
    try {
      const result = await stockReportsDb.getProductPerformance(activeShop.id, from, to)
      setData(result)
      const cats = [...new Set(result.map(r => r.category).filter(Boolean) as string[])].sort()
      setCategories(cats)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [activeShop?.id, from, to])

  useEffect(() => { load() }, [load])

  const filtered = data
    .filter(r =>
      (!search || r.product_name.toLowerCase().includes(search.toLowerCase()) || r.barcode.includes(search)) &&
      (!categoryFilter || r.category === categoryFilter)
    )
    .sort((a, b) => b[sortKey] - a[sortKey])

  const totalRevenue = filtered.reduce((s, r) => s + r.revenue, 0)
  const totalProfit = filtered.reduce((s, r) => s + r.profit, 0)
  const totalSold = filtered.reduce((s, r) => s + r.stock_sold, 0)

  const exportData = () => {
    exportToCSV(filtered.map(r => ({
      'Product': r.product_name, 'Barcode': r.barcode, 'Category': r.category || '',
      'Size': r.size || '', 'Color': r.color || '',
      'Current Stock': r.current_stock, 'Stock Added': r.stock_added, 'Stock Sold': r.stock_sold,
      'Revenue': r.revenue, 'Cost': r.cost, 'Profit': r.profit,
      'Margin %': r.revenue > 0 ? ((r.profit / r.revenue) * 100).toFixed(1) + '%' : '0%',
      'Returns': r.returns_qty, 'Last Sale': r.last_sale_date ? formatDate(r.last_sale_date) : 'Never',
    })), `product-performance-${from}-${to}`)
  }

  if (!activeShop) return null

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" /> Product Performance
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Per-product sales, profit, and inventory analysis</p>
        </div>
        {filtered.length > 0 && (
          <Button variant="outline" size="sm" onClick={exportData} icon={<Download className="w-4 h-4" />}>Export CSV</Button>
        )}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Period</p>
            <div className="flex gap-1 flex-wrap">
              {(['week', 'month', 'quarter', 'custom'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-3 py-1 rounded-full text-sm font-medium capitalize transition-all ${
                    period === p ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          {period === 'custom' && (
            <>
              <Input label="From" type="date" value={from} onChange={e => setFrom(e.target.value)} />
              <Input label="To" type="date" value={to} onChange={e => setTo(e.target.value)} />
            </>
          )}
          <Button variant="primary" size="sm" onClick={load} loading={loading} icon={<RefreshCw className="w-3.5 h-3.5" />}>Load</Button>
        </div>

        <div className="flex flex-wrap gap-3 mt-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product / barcode…"
              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="revenue">Sort: Revenue</option>
            <option value="profit">Sort: Profit</option>
            <option value="stock_sold">Sort: Qty Sold</option>
            <option value="returns_qty">Sort: Returns</option>
            <option value="current_stock">Sort: Current Stock</option>
          </select>
        </div>
      </Card>

      {/* Summary */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Total Revenue</p>
            <p className="text-lg font-bold text-blue-600">{formatCurrency(totalRevenue)}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Gross Profit</p>
            <p className={`text-lg font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totalProfit)}</p>
            {totalRevenue > 0 && <p className="text-xs text-gray-400">{((totalProfit / totalRevenue) * 100).toFixed(1)}% margin</p>}
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Total Units Sold</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{totalSold}</p>
          </Card>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-6 h-6" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Package className="w-8 h-8 text-gray-400" />} title="No data" description="Adjust filters or select a wider date range" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="text-left p-3 text-gray-600 dark:text-gray-400 font-medium">Product</th>
                <th className="text-center p-3 text-gray-600 dark:text-gray-400 font-medium">Stock</th>
                <th className="text-center p-3 text-gray-600 dark:text-gray-400 font-medium">Added</th>
                <th className="text-center p-3 text-gray-600 dark:text-gray-400 font-medium">Sold</th>
                <th className="text-right p-3 text-gray-600 dark:text-gray-400 font-medium">Revenue</th>
                <th className="text-right p-3 text-gray-600 dark:text-gray-400 font-medium">Profit</th>
                <th className="text-center p-3 text-gray-600 dark:text-gray-400 font-medium">Margin</th>
                <th className="text-center p-3 text-gray-600 dark:text-gray-400 font-medium">Returns</th>
                <th className="text-left p-3 text-gray-600 dark:text-gray-400 font-medium">Last Sale</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0
                return (
                  <tr key={p.product_id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="p-3">
                      <p className="font-medium text-gray-900 dark:text-gray-100 leading-tight">{p.product_name}</p>
                      <p className="text-xs text-gray-400">{p.barcode} {p.category && `· ${p.category}`} {p.size && `· ${p.size}`} {p.color && `· ${p.color}`}</p>
                    </td>
                    <td className="p-3 text-center font-mono text-gray-700 dark:text-gray-300">{p.current_stock}</td>
                    <td className="p-3 text-center text-green-600 font-mono">{p.stock_added > 0 ? `+${p.stock_added}` : '—'}</td>
                    <td className="p-3 text-center font-mono font-semibold text-blue-600">{p.stock_sold}</td>
                    <td className="p-3 text-right font-medium text-gray-900 dark:text-gray-100">{p.revenue > 0 ? formatCurrency(p.revenue) : '—'}</td>
                    <td className="p-3 text-right">
                      {p.profit !== 0 ? (
                        <span className={p.profit >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                          {formatCurrency(p.profit)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="p-3 text-center">
                      {margin !== 0 ? (
                        <span className={`text-xs font-medium ${margin >= 20 ? 'text-green-600' : margin >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                          {margin.toFixed(1)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="p-3 text-center">
                      {p.returns_qty > 0 ? <span className="text-red-500 font-medium">{p.returns_qty}</span> : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="p-3 text-sm text-gray-600 dark:text-gray-400">
                      {p.last_sale_date ? formatDate(p.last_sale_date) : <span className="text-gray-400">Never</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
