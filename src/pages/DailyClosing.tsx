import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useShopStore } from '../store/shopStore'
import { dailyClosingDb, getErrorMessage } from '../lib/database'
import { Button, Card, Input, Spinner, EmptyState } from '../components/ui'
import {
  Moon, Calendar, DollarSign, CreditCard, Smartphone,
  AlertCircle, ArrowLeftRight, TrendingUp, RefreshCw,
  Download, FileText, CheckCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency, formatDate, exportToCSV } from '../lib/utils'
import type { DailyClosing as DailyClosingType } from '../types'
import jsPDF from 'jspdf'

const today = () => new Date().toISOString().split('T')[0]

const StatRow: React.FC<{ label: string; value: string; sub?: string; accent?: string }> = ({ label, value, sub, accent }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
    <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
    <div className="text-right">
      <span className={`font-semibold text-sm ${accent || 'text-gray-900 dark:text-gray-100'}`}>{value}</span>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  </div>
)

export const DailyClosing: React.FC = () => {
  const { activeShop, shops } = useShopStore()
  const [tab, setTab] = useState<'close' | 'history'>('close')
  const [date, setDate] = useState(today())
  const [billerName, setBillerName] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DailyClosingType | null>(null)
  const [history, setHistory] = useState<DailyClosingType[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const loadHistory = useCallback(async () => {
    if (!activeShop) return
    setHistoryLoading(true)
    try {
      const data = await dailyClosingDb.list(activeShop.id, 30)
      setHistory(data)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setHistoryLoading(false)
    }
  }, [activeShop?.id])

  useEffect(() => { if (tab === 'history') loadHistory() }, [tab, loadHistory])

  // Auto-load existing closing for selected date
  useEffect(() => {
    const load = async () => {
      if (!activeShop || !date) return
      const existing = await dailyClosingDb.getByDate(activeShop.id, date).catch(() => null)
      setResult(existing)
    }
    load()
  }, [activeShop?.id, date])

  const handleClose = async () => {
    if (!activeShop) return
    if (!billerName.trim()) { toast.error('Enter biller/staff name'); return }
    setLoading(true)
    try {
      const data = await dailyClosingDb.computeAndSave(activeShop.id, date, billerName, notes || null)
      setResult(data)
      toast.success(`Day closed for ${formatDate(date)}`)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const exportPDF = (closing: DailyClosingType) => {
    const shopName = shops.find(s => s.id === closing.shop_id)?.name || 'Shop'
    const doc = new jsPDF({ format: [80, 180], unit: 'mm' })
    let y = 8
    const line = (text: string, right?: string, bold = false) => {
      doc.setFontSize(bold ? 9 : 8)
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.text(text, 5, y)
      if (right) doc.text(right, 75, y, { align: 'right' })
      y += 5
    }
    const divider = () => { doc.setDrawColor(180); doc.line(5, y, 75, y); y += 3 }

    line(shopName, undefined, true)
    line('DAILY CLOSING REPORT', undefined, true)
    line(`Date: ${formatDate(closing.closing_date)}`)
    line(`Closed by: ${closing.closed_by || '—'}`)
    divider()
    line('Total Bills', String(closing.total_bills))
    line('Gross Revenue', formatCurrency(closing.gross_revenue), true)
    divider()
    line('Collections', undefined, true)
    line('Cash', formatCurrency(closing.cash_total))
    line('UPI / Online', formatCurrency(closing.upi_total))
    if (closing.card_total > 0) line('Card', formatCurrency(closing.card_total))
    if (closing.other_total > 0) line('Other', formatCurrency(closing.other_total))
    divider()
    line('Due Created', formatCurrency(closing.due_created))
    line('Due Collected', formatCurrency(closing.due_collected))
    line('Returns', formatCurrency(closing.returns_total))
    divider()
    line('Cost of Goods', formatCurrency(closing.total_cost))
    line('Gross Profit', formatCurrency(closing.gross_profit), true)
    line('Net Revenue', formatCurrency(closing.net_revenue), true)

    doc.save(`daily-closing-${closing.closing_date}.pdf`)
  }

  const exportCSV = () => {
    exportToCSV(history.map(h => ({
      'Date': formatDate(h.closing_date),
      'Total Bills': h.total_bills,
      'Cash': h.cash_total,
      'UPI': h.upi_total,
      'Card': h.card_total,
      'Other': h.other_total,
      'Due Created': h.due_created,
      'Due Collected': h.due_collected,
      'Returns': h.returns_total,
      'Gross Revenue': h.gross_revenue,
      'Total Cost': h.total_cost,
      'Gross Profit': h.gross_profit,
      'Net Revenue': h.net_revenue,
    })), 'daily-closings')
  }

  if (!activeShop) return null

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Moon className="w-5 h-5 text-blue-600" /> Daily Closing
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">End-of-day summary and closing report</p>
        </div>
        <div className="flex gap-2">
          <Button variant={tab === 'close' ? 'primary' : 'outline'} size="sm" onClick={() => setTab('close')}>
            <Moon className="w-4 h-4" /> Close Day
          </Button>
          <Button variant={tab === 'history' ? 'primary' : 'outline'} size="sm" onClick={() => setTab('history')}>
            <Calendar className="w-4 h-4" /> History
          </Button>
        </div>
      </div>

      {/* ─── Close Day ─────────────────────────────────────────── */}
      {tab === 'close' && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Closing Date" type="date" value={date} onChange={e => setDate(e.target.value)} max={today()} />
              <Input label="Closed By" value={billerName} onChange={e => setBillerName(e.target.value)} placeholder="Staff name" />
              <Input label="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any remarks…" />
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="primary" onClick={handleClose} loading={loading} icon={<CheckCircle className="w-4 h-4" />}>
                {result ? 'Recompute & Save' : 'Compute & Close Day'}
              </Button>
            </div>
          </Card>

          {result && (
            <div ref={printRef}><Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-gray-100">Closing Report — {formatDate(result.closing_date)}</h2>
                  <p className="text-xs text-gray-500">Closed by: {result.closed_by || '—'}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportPDF(result)} icon={<Download className="w-4 h-4" />}>PDF</Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Collections */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Collections</p>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                    <StatRow label="Total Bills" value={String(result.total_bills)} />
                    <StatRow label="💵 Cash" value={formatCurrency(result.cash_total)} />
                    <StatRow label="📱 UPI / Online" value={formatCurrency(result.upi_total)} />
                    {result.card_total > 0 && <StatRow label="💳 Card" value={formatCurrency(result.card_total)} />}
                    {result.other_total > 0 && <StatRow label="Other" value={formatCurrency(result.other_total)} />}
                    <StatRow label="Gross Revenue" value={formatCurrency(result.gross_revenue)} accent="text-blue-600" />
                  </div>
                </div>

                {/* Due & Returns */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Due & Returns</p>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                    <StatRow label="Due Created" value={formatCurrency(result.due_created)} accent="text-red-600" />
                    <StatRow label="Due Collected" value={formatCurrency(result.due_collected)} accent="text-green-600" />
                    <StatRow label="Returns" value={formatCurrency(result.returns_total)} />
                    <StatRow label="Exchanges" value={formatCurrency(result.exchanges_total)} />
                  </div>
                </div>

                {/* Profit */}
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Profit Summary</p>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-gray-500">Cost of Goods</p>
                        <p className="text-lg font-bold text-gray-700 dark:text-gray-300">{formatCurrency(result.total_cost)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Gross Profit</p>
                        <p className="text-lg font-bold text-green-600">{formatCurrency(result.gross_profit)}</p>
                        {result.gross_revenue > 0 && (
                          <p className="text-xs text-gray-400">{((result.gross_profit / result.gross_revenue) * 100).toFixed(1)}% margin</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Net Revenue</p>
                        <p className="text-lg font-bold text-blue-600">{formatCurrency(result.net_revenue)}</p>
                        <p className="text-xs text-gray-400">after returns</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card></div>
          )}
        </div>
      )}

      {/* ─── History ────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            {history.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportCSV} icon={<FileText className="w-4 h-4" />}>Export CSV</Button>
            )}
          </div>
          {historyLoading ? (
            <div className="flex justify-center py-12"><Spinner className="w-6 h-6" /></div>
          ) : history.length === 0 ? (
            <EmptyState icon={<Moon className="w-8 h-8 text-gray-400" />} title="No closing records" description="Close a day to see history here" />
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="text-left p-3 text-gray-600 dark:text-gray-400 font-medium">Date</th>
                    <th className="text-center p-3 text-gray-600 dark:text-gray-400 font-medium">Bills</th>
                    <th className="text-right p-3 text-gray-600 dark:text-gray-400 font-medium">Cash</th>
                    <th className="text-right p-3 text-gray-600 dark:text-gray-400 font-medium">UPI</th>
                    <th className="text-right p-3 text-gray-600 dark:text-gray-400 font-medium">Revenue</th>
                    <th className="text-right p-3 text-gray-600 dark:text-gray-400 font-medium">Profit</th>
                    <th className="text-right p-3 text-gray-600 dark:text-gray-400 font-medium">Due↑</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="p-3 font-medium text-gray-900 dark:text-gray-100">{formatDate(h.closing_date)}</td>
                      <td className="p-3 text-center text-gray-700 dark:text-gray-300">{h.total_bills}</td>
                      <td className="p-3 text-right text-gray-700 dark:text-gray-300">{formatCurrency(h.cash_total)}</td>
                      <td className="p-3 text-right text-gray-700 dark:text-gray-300">{formatCurrency(h.upi_total)}</td>
                      <td className="p-3 text-right font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(h.gross_revenue)}</td>
                      <td className="p-3 text-right">
                        <span className={h.gross_profit >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                          {formatCurrency(h.gross_profit)}
                        </span>
                      </td>
                      <td className="p-3 text-right text-red-500">{formatCurrency(h.due_created)}</td>
                      <td className="p-3">
                        <button onClick={() => exportPDF(h)} className="text-blue-600 hover:text-blue-700 text-xs font-medium">PDF</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
