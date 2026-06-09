import React, { useState, useEffect, useCallback } from 'react'
import { useShopStore } from '../store/shopStore'
import { stockReportsDb, getErrorMessage } from '../lib/database'
import { Button, Card, Badge, Input, EmptyState, Spinner } from '../components/ui'
import {
  Archive, Zap, TrendingUp, Calendar, Filter,
  Package, DollarSign, RefreshCw, AlertTriangle, BarChart2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency, formatDate, exportToCSV } from '../lib/utils'
import type { StockAgeItem, FastMovingProduct, FastMovingCategory } from '../types'

type ReportTab = 'age' | 'dead' | 'fast'
type AgeBucket = 30 | 60 | 90 | 180

const today = () => new Date().toISOString().split('T')[0]
const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

export const StockReports: React.FC = () => {
  const { activeShop } = useShopStore()
  const [tab, setTab] = useState<ReportTab>('age')

  // ─── Age / Dead stock ─────────────────────────────────────────
  const [ageBucket, setAgeBucket] = useState<AgeBucket>(30)
  const [ageData, setAgeData] = useState<StockAgeItem[]>([])
  const [ageLoading, setAgeLoading] = useState(false)

  // ─── Fast moving ──────────────────────────────────────────────
  const [fastPeriod, setFastPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('month')
  const [fastFrom, setFastFrom] = useState(daysAgo(30))
  const [fastTo, setFastTo] = useState(today())
  const [fastProducts, setFastProducts] = useState<FastMovingProduct[]>([])
  const [fastCategories, setFastCategories] = useState<FastMovingCategory[]>([])
  const [fastLoading, setFastLoading] = useState(false)
  const [fastSubTab, setFastSubTab] = useState<'products' | 'categories'>('products')

  const loadAge = useCallback(async () => {
    if (!activeShop) return
    setAgeLoading(true)
    try {
      const data = await stockReportsDb.getStockAge(activeShop.id, ageBucket)
      setAgeData(data)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setAgeLoading(false)
    }
  }, [activeShop?.id, ageBucket])

  const loadFast = useCallback(async () => {
    if (!activeShop) return
    setFastLoading(true)
    try {
      const [prods, cats] = await Promise.all([
        stockReportsDb.getFastMoving(activeShop.id, fastFrom, fastTo),
        stockReportsDb.getFastMovingCategories(activeShop.id, fastFrom, fastTo),
      ])
      setFastProducts(prods)
      setFastCategories(cats)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setFastLoading(false)
    }
  }, [activeShop?.id, fastFrom, fastTo])

  useEffect(() => {
    if (tab === 'age' || tab === 'dead') loadAge()
  }, [tab, loadAge])

  useEffect(() => {
    if (tab === 'fast') loadFast()
  }, [tab, loadFast])

  // Sync preset periods
  useEffect(() => {
    if (fastPeriod === 'today') { setFastFrom(today()); setFastTo(today()) }
    else if (fastPeriod === 'week') { setFastFrom(daysAgo(7)); setFastTo(today()) }
    else if (fastPeriod === 'month') { setFastFrom(daysAgo(30)); setFastTo(today()) }
  }, [fastPeriod])

  const exportAge = () => {
    exportToCSV(ageData.map(r => ({
      'Product': r.product_name, 'Barcode': r.barcode, 'Category': r.category || '',
      'Size': r.size || '', 'Color': r.color || '', 'Stock': r.current_stock,
      'Last Sold': r.last_sold_date ? formatDate(r.last_sold_date) : 'Never',
      'Days Since Sold': r.days_since_sold === 9999 ? 'Never' : r.days_since_sold,
      'Purchase Price': r.purchase_price, 'Selling Price': r.selling_price,
      'Inventory Value': r.inventory_value,
    })), `stock-age-${ageBucket}days`)
  }

  const exportFast = () => {
    exportToCSV(fastProducts.map(r => ({
      'Product': r.product_name, 'Barcode': r.barcode, 'Category': r.category || '',
      'Qty Sold': r.total_qty, 'Revenue': r.total_revenue, 'Profit': r.total_profit,
    })), `fast-moving-${fastFrom}-${fastTo}`)
  }

  // Dead stock = age >= threshold with stock > 0
  const deadStock = ageData // already filtered by ageBucket in backend

  const totalDeadValue = deadStock.reduce((s, r) => s + r.inventory_value, 0)
  const totalDeadQty = deadStock.reduce((s, r) => s + r.current_stock, 0)

  if (!activeShop) return null

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-blue-600" /> Inventory Reports
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Stock aging, dead stock, and fast-moving analysis</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit">
        {([
          { key: 'age', label: 'Stock Aging', icon: Archive },
          { key: 'dead', label: 'Dead Stock', icon: AlertTriangle },
          { key: 'fast', label: 'Fast Moving', icon: Zap },
        ] as { key: ReportTab; label: string; icon: React.ComponentType<{className?: string}> }[]).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              tab === key ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* ─── Stock Aging ────────────────────────────────────────── */}
      {(tab === 'age' || tab === 'dead') && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Not sold in:</span>
            {([30, 60, 90, 180] as AgeBucket[]).map(d => (
              <button key={d} onClick={() => setAgeBucket(d)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  ageBucket === d ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                }`}>
                {d}+ days
              </button>
            ))}
            <button onClick={loadAge} className="ml-auto flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            {ageData.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportAge}>Export CSV</Button>
            )}
          </div>

          {/* Summary cards */}
          {ageData.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{ageData.length}</p>
                <p className="text-xs text-gray-500 mt-1">{tab === 'dead' ? 'Dead' : 'Aging'} Products</p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-2xl font-bold text-orange-600">{totalDeadQty}</p>
                <p className="text-xs text-gray-500 mt-1">Total Units</p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(totalDeadValue)}</p>
                <p className="text-xs text-gray-500 mt-1">Value Locked</p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{ageData.filter(r => r.last_sold_date === null).length}</p>
                <p className="text-xs text-gray-500 mt-1">Never Sold</p>
              </Card>
            </div>
          )}

          {ageLoading ? (
            <div className="flex justify-center py-12"><Spinner className="w-6 h-6" /></div>
          ) : ageData.length === 0 ? (
            <EmptyState icon={<Archive className="w-8 h-8 text-gray-400" />} title={`No products idle ${ageBucket}+ days`} description="All products have been sold recently" />
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="text-left p-3 text-gray-600 dark:text-gray-400 font-medium">Product</th>
                    <th className="text-center p-3 text-gray-600 dark:text-gray-400 font-medium">Stock</th>
                    <th className="text-left p-3 text-gray-600 dark:text-gray-400 font-medium">Last Sold</th>
                    <th className="text-center p-3 text-gray-600 dark:text-gray-400 font-medium">Idle Days</th>
                    <th className="text-right p-3 text-gray-600 dark:text-gray-400 font-medium">Value (Cost)</th>
                  </tr>
                </thead>
                <tbody>
                  {ageData.map(item => (
                    <tr key={item.product_id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="p-3">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{item.product_name}</p>
                        <p className="text-xs text-gray-400">{item.barcode} {item.category && `· ${item.category}`} {item.size && `· ${item.size}`} {item.color && `· ${item.color}`}</p>
                      </td>
                      <td className="p-3 text-center font-semibold text-gray-700 dark:text-gray-300">{item.current_stock}</td>
                      <td className="p-3 text-gray-600 dark:text-gray-400">
                        {item.last_sold_date ? formatDate(item.last_sold_date) : <span className="text-red-500 font-medium">Never sold</span>}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`font-bold ${item.days_since_sold >= 180 ? 'text-red-600' : item.days_since_sold >= 90 ? 'text-orange-600' : item.days_since_sold >= 60 ? 'text-amber-600' : 'text-yellow-600'}`}>
                          {item.days_since_sold === 9999 ? '∞' : item.days_since_sold}
                        </span>
                      </td>
                      <td className="p-3 text-right font-medium text-gray-900 dark:text-gray-100">{formatCurrency(item.inventory_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* ─── Fast Moving ────────────────────────────────────────── */}
      {tab === 'fast' && (
        <div className="space-y-4">
          {/* Period selector */}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium">Period</p>
              <div className="flex gap-1">
                {(['today', 'week', 'month', 'custom'] as const).map(p => (
                  <button key={p} onClick={() => setFastPeriod(p)}
                    className={`px-3 py-1 rounded-full text-sm font-medium capitalize transition-all ${
                      fastPeriod === p ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            {fastPeriod === 'custom' && (
              <>
                <Input label="From" type="date" value={fastFrom} onChange={e => setFastFrom(e.target.value)} />
                <Input label="To" type="date" value={fastTo} onChange={e => setFastTo(e.target.value)} />
              </>
            )}
            <Button variant="primary" size="sm" onClick={loadFast} loading={fastLoading} icon={<RefreshCw className="w-3.5 h-3.5" />}>Load</Button>
            {fastProducts.length > 0 && <Button variant="outline" size="sm" onClick={exportFast}>Export CSV</Button>}
          </div>

          {/* Sub-tabs: Products vs Categories */}
          <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
            <button onClick={() => setFastSubTab('products')}
              className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${fastSubTab === 'products' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
              Best Selling Products
            </button>
            <button onClick={() => setFastSubTab('categories')}
              className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${fastSubTab === 'categories' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
              Best Selling Categories
            </button>
          </div>

          {fastLoading ? (
            <div className="flex justify-center py-12"><Spinner className="w-6 h-6" /></div>
          ) : fastSubTab === 'products' ? (
            fastProducts.length === 0 ? (
              <EmptyState icon={<Zap className="w-8 h-8 text-gray-400" />} title="No sales in selected period" description="Try a different date range" />
            ) : (
              <Card className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="text-left p-3 text-gray-600 dark:text-gray-400 font-medium">#</th>
                      <th className="text-left p-3 text-gray-600 dark:text-gray-400 font-medium">Product</th>
                      <th className="text-center p-3 text-gray-600 dark:text-gray-400 font-medium">Qty Sold</th>
                      <th className="text-right p-3 text-gray-600 dark:text-gray-400 font-medium">Revenue</th>
                      <th className="text-right p-3 text-gray-600 dark:text-gray-400 font-medium">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fastProducts.map((p, i) => (
                      <tr key={p.product_id || i} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="p-3 text-gray-400 font-mono text-xs">{i + 1}</td>
                        <td className="p-3">
                          <p className="font-medium text-gray-900 dark:text-gray-100">{p.product_name}</p>
                          <p className="text-xs text-gray-400">{p.barcode} {p.category && `· ${p.category}`} {p.size && `· ${p.size}`} {p.color && `· ${p.color}`}</p>
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-bold text-blue-600">{p.total_qty}</span>
                        </td>
                        <td className="p-3 text-right font-medium text-gray-900 dark:text-gray-100">{formatCurrency(p.total_revenue)}</td>
                        <td className="p-3 text-right">
                          <span className={p.total_profit >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                            {formatCurrency(p.total_profit)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )
          ) : (
            fastCategories.length === 0 ? (
              <EmptyState icon={<BarChart2 className="w-8 h-8 text-gray-400" />} title="No sales data" description="Try a different date range" />
            ) : (
              <Card className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="text-left p-3 text-gray-600 dark:text-gray-400 font-medium">#</th>
                      <th className="text-left p-3 text-gray-600 dark:text-gray-400 font-medium">Category</th>
                      <th className="text-center p-3 text-gray-600 dark:text-gray-400 font-medium">Qty Sold</th>
                      <th className="text-right p-3 text-gray-600 dark:text-gray-400 font-medium">Revenue</th>
                      <th className="text-center p-3 text-gray-600 dark:text-gray-400 font-medium">Bills</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fastCategories.map((c, i) => (
                      <tr key={c.category} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="p-3 text-gray-400 font-mono text-xs">{i + 1}</td>
                        <td className="p-3 font-medium text-gray-900 dark:text-gray-100">{c.category}</td>
                        <td className="p-3 text-center font-bold text-blue-600">{c.total_qty}</td>
                        <td className="p-3 text-right font-medium text-gray-900 dark:text-gray-100">{formatCurrency(c.total_revenue)}</td>
                        <td className="p-3 text-center text-gray-600 dark:text-gray-400">{c.bill_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )
          )}
        </div>
      )}
    </div>
  )
}
