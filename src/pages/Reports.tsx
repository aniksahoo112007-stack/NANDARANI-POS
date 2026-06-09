import React, { useState, useCallback } from 'react'
import { useShopStore } from '../store/shopStore'
import { analytics, bills as billsDb, products as productsDb } from '../lib/database'
import { supabase } from '../lib/supabase'
import { Button, Card, EmptyState } from '../components/ui'
import { BarChart2, Download, RefreshCw, TrendingUp, DollarSign, Package, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency, formatDate, exportToCSV } from '../lib/utils'
import type { SalesTrend, TopProduct } from '../types'

type ReportType = 'daily' | 'monthly' | 'products' | 'categories' | 'payments' | 'due' | 'stock'

export const Reports: React.FC = () => {
  const { activeShop } = useShopStore()
  const [reportType, setReportType] = useState<ReportType>('daily')
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [hasRun, setHasRun] = useState(false)

  // Report data
  const [dailySales, setDailySales] = useState<SalesTrend[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [paymentBreakdown, setPaymentBreakdown] = useState<{ method: string; amount: number; count: number }[]>([])
  const [dueSummary, setDueSummary] = useState<{ count: number; total: number; oldest: string }>({ count: 0, total: 0, oldest: '' })
  const [lowStock, setLowStock] = useState<import('../types').Product[]>([])
  const [categoryData, setCategoryData] = useState<{ category: string; amount: number; count: number }[]>([])

  const loadReport = useCallback(async () => {
    if (!activeShop) return
    setLoading(true)
    try {
      const from = new Date(fromDate).toISOString()
      const to = new Date(toDate + 'T23:59:59').toISOString()

      switch (reportType) {
        case 'daily': {
          const days = Math.ceil((new Date(toDate).getTime() - new Date(fromDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
          const data = await analytics.getSalesTrend(activeShop.id, Math.max(1, days))
          setDailySales(data)
          break
        }
        case 'products': {
          // Get bill items in period
          const { data } = await supabase.from('bill_items')
            .select('product_id, product_name, barcode, quantity, total_amount')
            .eq('shop_id', activeShop.id)
            .gte('created_at', from).lte('created_at', to)
          const map = new Map<string, TopProduct>()
          for (const item of data || []) {
            if (!item.product_id) continue
            const e = map.get(item.product_id) || { product_id: item.product_id, product_name: item.product_name, barcode: item.barcode || '', total_qty: 0, total_amount: 0 }
            e.total_qty += item.quantity
            e.total_amount += item.total_amount
            map.set(item.product_id, e)
          }
          setTopProducts(Array.from(map.values()).sort((a, b) => b.total_amount - a.total_amount))
          break
        }
        case 'categories': {
          const { data } = await supabase.from('bill_items')
            .select('category, quantity, total_amount')
            .eq('shop_id', activeShop.id)
            .gte('created_at', from).lte('created_at', to)
          const map = new Map<string, { amount: number; count: number }>()
          for (const item of data || []) {
            const cat = item.category || 'Uncategorized'
            const e = map.get(cat) || { amount: 0, count: 0 }
            e.amount += item.total_amount
            e.count += item.quantity
            map.set(cat, e)
          }
          setCategoryData(Array.from(map.entries()).map(([category, { amount, count }]) => ({ category, amount, count })).sort((a, b) => b.amount - a.amount))
          break
        }
        case 'payments': {
          const data = await analytics.getPaymentMethodBreakdown(activeShop.id, from, to)
          setPaymentBreakdown(data)
          break
        }
        case 'due': {
          const bills = await billsDb.getDue(activeShop.id)
          setDueSummary({
            count: bills.length,
            total: bills.reduce((s, b) => s + b.due_amount, 0),
            oldest: bills.length > 0 ? formatDate(bills[0].created_at) : '',
          })
          break
        }
        case 'stock': {
          const data = await productsDb.getLowStock(activeShop.id)
          setLowStock(data)
          break
        }
      }
    } catch (e) { console.error(e); toast.error('Failed to load report') }
    finally { setLoading(false); setHasRun(true) }
  }, [activeShop?.id, reportType, fromDate, toDate])

  const handleExport = () => {
    if (reportType === 'daily') {
      exportToCSV(dailySales, `daily-sales-${activeShop?.bill_prefix}`)
    } else if (reportType === 'products') {
      exportToCSV(topProducts, `product-sales-${activeShop?.bill_prefix}`)
    } else if (reportType === 'categories') {
      exportToCSV(categoryData, `category-sales-${activeShop?.bill_prefix}`)
    } else if (reportType === 'payments') {
      exportToCSV(paymentBreakdown, `payment-methods-${activeShop?.bill_prefix}`)
    }
    toast.success('Report exported!')
  }

  const REPORT_TYPES: { value: ReportType; label: string; icon: React.ReactNode }[] = [
    { value: 'daily', label: 'Daily Sales', icon: <TrendingUp className="w-4 h-4" /> },
    { value: 'products', label: 'Product-wise', icon: <Package className="w-4 h-4" /> },
    { value: 'categories', label: 'Category-wise', icon: <BarChart2 className="w-4 h-4" /> },
    { value: 'payments', label: 'Payment Methods', icon: <DollarSign className="w-4 h-4" /> },
    { value: 'due', label: 'Due Report', icon: <Users className="w-4 h-4" /> },
    { value: 'stock', label: 'Low Stock', icon: <Package className="w-4 h-4" /> },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Reports & Analytics</h2>
          <p className="text-sm text-gray-500">{activeShop?.name}</p>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="flex flex-wrap gap-2">
        {REPORT_TYPES.map(r => (
          <button
            key={r.value}
            onClick={() => { setReportType(r.value); setHasRun(false) }}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-xl transition-colors ${reportType === r.value ? 'bg-blue-600 text-white shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}
          >
            {r.icon} {r.label}
          </button>
        ))}
      </div>

      {/* Date Range */}
      {!['due', 'stock'].includes(reportType) && (
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <Button icon={<RefreshCw className="w-4 h-4" />} onClick={loadReport} loading={loading}>Run Report</Button>
          <Button variant="secondary" icon={<Download className="w-4 h-4" />} onClick={handleExport}>Export CSV</Button>
        </div>
      )}

      {reportType === 'stock' && (
        <Button icon={<RefreshCw className="w-4 h-4" />} onClick={loadReport} loading={loading}>Load Low Stock</Button>
      )}
      {reportType === 'due' && (
        <Button icon={<RefreshCw className="w-4 h-4" />} onClick={loadReport} loading={loading}>Load Due Report</Button>
      )}

      {/* Report Results */}
      <div>
        {/* Daily Sales */}
        {reportType === 'daily' && dailySales.length > 0 && (
          <Card padding={false}>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Bills</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {dailySales.map(d => (
                  <tr key={d.date} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3">{formatDate(d.date)}</td>
                    <td className="px-4 py-3 text-right">{d.bills}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-600">{formatCurrency(d.amount)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 dark:bg-gray-900/50 font-bold">
                  <td className="px-4 py-3">TOTAL</td>
                  <td className="px-4 py-3 text-right">{dailySales.reduce((s, d) => s + d.bills, 0)}</td>
                  <td className="px-4 py-3 text-right text-green-600">{formatCurrency(dailySales.reduce((s, d) => s + d.amount, 0))}</td>
                </tr>
              </tbody>
            </table>
          </Card>
        )}

        {/* Product-wise */}
        {reportType === 'products' && topProducts.length > 0 && (
          <Card padding={false}>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Barcode</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Qty Sold</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {topProducts.map(p => (
                  <tr key={p.product_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{p.product_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.barcode}</td>
                    <td className="px-4 py-3 text-right">{p.total_qty}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-600">{formatCurrency(p.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* Category-wise */}
        {reportType === 'categories' && categoryData.length > 0 && (
          <Card padding={false}>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Units Sold</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {categoryData.map(c => (
                  <tr key={c.category} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{c.category}</td>
                    <td className="px-4 py-3 text-right">{c.count}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-600">{formatCurrency(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* Payment Methods */}
        {reportType === 'payments' && paymentBreakdown.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {paymentBreakdown.map(p => (
              <Card key={p.method} className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{p.method}</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(p.amount)}</p>
                  <p className="text-xs text-gray-500">{p.count} transactions</p>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Due Report */}
        {reportType === 'due' && dueSummary.count > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <p className="text-sm text-gray-500">Pending Bills</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{dueSummary.count}</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">Total Due</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(dueSummary.total)}</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">Oldest Due</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{dueSummary.oldest || '-'}</p>
            </Card>
          </div>
        )}

        {/* Low Stock */}
        {reportType === 'stock' && (lowStock as { id: string; name: string; barcode: string; stock_quantity: number; low_stock_limit: number; category: string }[]).length > 0 && (
          <Card padding={false}>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Barcode</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Stock</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Min Limit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {(lowStock as { id: string; name: string; barcode: string; stock_quantity: number; low_stock_limit: number; category: string }[]).map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{p.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.barcode}</td>
                    <td className="px-4 py-3 text-gray-500">{p.category || '-'}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">{p.stock_quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{p.low_stock_limit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* Empty State */}
        {!loading && !hasRun && (
          <EmptyState icon={<BarChart2 className="w-10 h-10" />} title="Run a report" description='Select a report type, set a date range, and click "Run Report" to see data.' />
        )}
        {!loading && hasRun && dailySales.length === 0 && topProducts.length === 0 && categoryData.length === 0 && paymentBreakdown.length === 0 && dueSummary.count === 0 && (lowStock as []).length === 0 && (
          <EmptyState icon={<BarChart2 className="w-10 h-10" />} title="No data found" description="No records match the selected criteria for this period." />
        )}
      </div>
    </div>
  )
}
