import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShopStore } from '../store/shopStore'
import { analytics } from '../lib/database'
import {
  StatCard, Card, Badge, EmptyState, Spinner
} from '../components/ui'
import {
  ShoppingCart, TrendingUp, AlertCircle, Package,
  Users, DollarSign, ArrowUpRight, Clock, BarChart2
} from 'lucide-react'
import { formatCurrency, formatDateTime, getStatusColor, timeAgo } from '../lib/utils'
import type { DashboardStats, SalesTrend, TopProduct, Bill } from '../types'

export const Dashboard: React.FC = () => {
  const { activeShop } = useShopStore()
  const navigate = useNavigate()

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [trend, setTrend] = useState<SalesTrend[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [recentBills, setRecentBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!activeShop) return
    setLoading(true)
    try {
      const [s, t, tp, rb] = await Promise.all([
        analytics.getDashboardStats(activeShop.id),
        analytics.getSalesTrend(activeShop.id, 14),
        analytics.getTopProducts(activeShop.id, 5),
        analytics.getRecentBills(activeShop.id, 8),
      ])
      setStats(s)
      setTrend(t)
      setTopProducts(tp)
      setRecentBills(rb)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [activeShop?.id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{activeShop?.name}</h2>
            <p className="text-blue-100 text-sm mt-1">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button
            onClick={() => navigate('/pos')}
            className="flex items-center gap-2 bg-white text-blue-700 px-4 py-2 rounded-xl font-semibold text-sm hover:bg-blue-50 transition-colors shadow-sm"
          >
            <ShoppingCart className="w-4 h-4" />
            New Bill
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Today's Sales"
            value={formatCurrency(stats.today_sales)}
            icon={<DollarSign className="w-5 h-5 text-green-600" />}
            color="bg-green-50 dark:bg-green-900/20"
            sub={`${stats.today_bills} bills`}
          />
          <StatCard
            label="Monthly Sales"
            value={formatCurrency(stats.monthly_sales)}
            icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
            color="bg-blue-50 dark:bg-blue-900/20"
            sub={`${stats.monthly_bills} bills`}
          />
          <StatCard
            label="Total Due"
            value={formatCurrency(stats.total_due)}
            icon={<AlertCircle className="w-5 h-5 text-red-600" />}
            color="bg-red-50 dark:bg-red-900/20"
            sub="Pending collection"
          />
          <StatCard
            label="Total Products"
            value={stats.total_products.toLocaleString()}
            icon={<Package className="w-5 h-5 text-purple-600" />}
            color="bg-purple-50 dark:bg-purple-900/20"
            sub={`${stats.low_stock_count} low stock`}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend */}
        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Sales Trend (14 days)</h3>
              <BarChart2 className="w-4 h-4 text-gray-400" />
            </div>
            {(() => {
              if (trend.length === 0) return <div className="flex items-center justify-center h-24 text-gray-400 text-sm">No sales data yet</div>
              const max = Math.max(...trend.map(x => x.amount))
              if (max === 0) return <div className="flex items-center justify-center h-24 text-gray-400 text-sm">No sales data yet</div>
              return (
                <div className="flex items-end gap-1 h-24">
                  {trend.map((t, i) => {
                    const height = (t.amount / max) * 100
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                        <div className="w-full relative">
                          <div
                            className="w-full bg-blue-500 hover:bg-blue-600 rounded-t transition-all cursor-pointer"
                            style={{ height: `${Math.max(4, height * 0.88)}px` }}
                            title={`${t.date}: ${formatCurrency(t.amount)}`}
                          />
                        </div>
                        <span className="text-xs text-gray-400 hidden sm:block" style={{ fontSize: '9px' }}>
                          {t.date.slice(8)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </Card>
        </div>

        {/* Top Products */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Top Products</h3>
            <ArrowUpRight className="w-4 h-4 text-gray-400" />
          </div>
          {topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={p.product_id} className="flex items-center gap-3">
                  <span className="w-5 h-5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{p.product_name}</p>
                    <p className="text-xs text-gray-500">{p.total_qty} units</p>
                  </div>
                  <span className="text-sm font-semibold text-green-600">{formatCurrency(p.total_amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No sales yet" description="Start selling to see top products" />
          )}
        </Card>
      </div>

      {/* Recent Bills */}
      <Card padding={false}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Recent Bills</h3>
          <button onClick={() => navigate('/bills')} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            View All →
          </button>
        </div>
        {recentBills.length > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {recentBills.map(bill => (
              <div
                key={bill.id}
                onClick={() => navigate(`/bills?id=${bill.id}`)}
                className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-blue-600">#{bill.bill_number}</span>
                    <span className="text-sm text-gray-900 dark:text-gray-100 truncate">{bill.customer_name || 'Walk-in Customer'}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-500">{timeAgo(bill.created_at)}</span>
                    {bill.customer_phone && <span className="text-xs text-gray-400">• {bill.customer_phone}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatCurrency(bill.grand_total)}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${getStatusColor(bill.payment_status)}`}>
                    {bill.payment_status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<ShoppingCart className="w-8 h-8" />}
            title="No bills yet"
            description="Create your first bill from the POS"
            action={
              <button onClick={() => navigate('/pos')} className="text-sm text-blue-600 font-medium">
                Go to POS →
              </button>
            }
          />
        )}
      </Card>

      {/* Low Stock Alert */}
      {stats && stats.low_stock_count > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center gap-4">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              {stats.low_stock_count} products are running low on stock
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Restock soon to avoid stockouts</p>
          </div>
          <button
            onClick={() => navigate('/inventory?filter=lowStock')}
       
            className="text-sm text-amber-700 dark:text-amber-300 font-medium hover:underline whitespace-nowrap"
          >
            View →
          </button>
        </div>
      )}
    </div>
  )
}
