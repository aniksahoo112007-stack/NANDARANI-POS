import React, { useState, useEffect, useCallback } from 'react'
import { useShopStore } from '../store/shopStore'
import { shopComparisonDb, getErrorMessage } from '../lib/database'
import { Button, Card, Input, Spinner, EmptyState } from '../components/ui'
import {
  GitCompare, TrendingUp, TrendingDown, DollarSign,
  ShoppingCart, ArrowLeftRight, AlertCircle, Package, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency } from '../lib/utils'

const today = () => new Date().toISOString().split('T')[0]
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0] }

interface ShopMetrics {
  shop_id: string
  revenue: number
  profit: number
  bills_count: number
  returns_amount: number
  due_amount: number
  inventory_value: number
}

const MetricCard: React.FC<{
  label: string
  icon: React.ReactNode
  a: number
  b: number
  isCurrency?: boolean
  isCount?: boolean
  lowerIsBetter?: boolean
}> = ({ label, icon, a, b, isCurrency, isCount, lowerIsBetter }) => {
  const diff = a - b
  const pct = b !== 0 ? ((diff / b) * 100).toFixed(1) : a > 0 ? '∞' : '0'
  const aWins = lowerIsBetter ? a < b : a > b
  const bWins = lowerIsBetter ? b < a : b > a

  const fmt = (v: number) => isCurrency ? formatCurrency(v) : isCount ? v.toLocaleString() : formatCurrency(v)

  return (
    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex items-center gap-2 mb-3 text-gray-500">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className={`text-center flex-1 ${aWins ? 'opacity-100' : 'opacity-60'}`}>
          <p className={`text-lg font-bold ${aWins ? 'text-blue-600' : 'text-gray-700 dark:text-gray-300'}`}>{fmt(a)}</p>
          {aWins && <TrendingUp className="w-3 h-3 text-green-500 mx-auto mt-0.5" />}
        </div>
        <div className="text-center text-xs text-gray-400 font-mono">vs</div>
        <div className={`text-center flex-1 ${bWins ? 'opacity-100' : 'opacity-60'}`}>
          <p className={`text-lg font-bold ${bWins ? 'text-purple-600' : 'text-gray-700 dark:text-gray-300'}`}>{fmt(b)}</p>
          {bWins && <TrendingUp className="w-3 h-3 text-green-500 mx-auto mt-0.5" />}
        </div>
      </div>
      {diff !== 0 && (
        <div className="mt-2 text-center">
          <span className={`text-xs font-medium ${diff > 0 ? 'text-blue-600' : 'text-purple-600'}`}>
            {diff > 0 ? 'Shop A +' : 'Shop B +'}{formatCurrency(Math.abs(diff))} ({Math.abs(parseFloat(pct as string))}%)
          </span>
        </div>
      )}
    </div>
  )
}

export const ShopComparison: React.FC = () => {
  const { shops } = useShopStore()
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('month')
  const [from, setFrom] = useState(daysAgo(30))
  const [to, setTo] = useState(today())
  const [data, setData] = useState<ShopMetrics[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (period === 'today') { setFrom(today()); setTo(today()) }
    else if (period === 'week') { setFrom(daysAgo(7)); setTo(today()) }
    else if (period === 'month') { setFrom(daysAgo(30)); setTo(today()) }
  }, [period])

  const load = useCallback(async () => {
    if (shops.length < 2) return
    setLoading(true)
    try {
      const result = await shopComparisonDb.compare(shops.map(s => s.id), from, to)
      setData(result)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [shops, from, to])

  useEffect(() => { load() }, [load])

  if (shops.length < 2) return (
    <div className="p-6">
      <EmptyState icon={<GitCompare className="w-8 h-8 text-gray-400" />} title="Only one shop" description="Shop comparison requires at least 2 shops" />
    </div>
  )

  const shopA = shops[0]
  const shopB = shops[1]
  const metricsA = data.find(d => d.shop_id === shopA.id) || { shop_id: shopA.id, revenue: 0, profit: 0, bills_count: 0, returns_amount: 0, due_amount: 0, inventory_value: 0 }
  const metricsB = data.find(d => d.shop_id === shopB.id) || { shop_id: shopB.id, revenue: 0, profit: 0, bills_count: 0, returns_amount: 0, due_amount: 0, inventory_value: 0 }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-blue-600" /> Shop Comparison
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Side-by-side performance comparison</p>
      </div>

      {/* Shop labels */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-3 text-center border-2 border-blue-500">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm mx-auto mb-1">{shopA.bill_prefix}</div>
          <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{shopA.name}</p>
          <p className="text-xs text-blue-600 font-medium">Shop A</p>
        </Card>
        <Card className="p-3 text-center border-2 border-purple-500">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm mx-auto mb-1">{shopB.bill_prefix}</div>
          <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{shopB.name}</p>
          <p className="text-xs text-purple-600 font-medium">Shop B</p>
        </Card>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className="text-xs text-gray-500 mb-1 font-medium">Period</p>
          <div className="flex gap-1">
            {(['today', 'week', 'month', 'custom'] as const).map(p => (
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
        <Button variant="outline" size="sm" onClick={load} loading={loading} icon={<RefreshCw className="w-3.5 h-3.5" />}>Refresh</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-6 h-6" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MetricCard label="Revenue" icon={<DollarSign className="w-4 h-4" />} a={metricsA.revenue} b={metricsB.revenue} isCurrency />
          <MetricCard label="Gross Profit" icon={<TrendingUp className="w-4 h-4" />} a={metricsA.profit} b={metricsB.profit} isCurrency />
          <MetricCard label="Total Bills" icon={<ShoppingCart className="w-4 h-4" />} a={metricsA.bills_count} b={metricsB.bills_count} isCount />
          <MetricCard label="Returns Amount" icon={<ArrowLeftRight className="w-4 h-4" />} a={metricsA.returns_amount} b={metricsB.returns_amount} isCurrency lowerIsBetter />
          <MetricCard label="Due Outstanding" icon={<AlertCircle className="w-4 h-4" />} a={metricsA.due_amount} b={metricsB.due_amount} isCurrency lowerIsBetter />
          <MetricCard label="Inventory Value" icon={<Package className="w-4 h-4" />} a={metricsA.inventory_value} b={metricsB.inventory_value} isCurrency />
        </div>
      )}
    </div>
  )
}
