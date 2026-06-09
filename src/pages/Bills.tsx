import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useShopStore } from '../store/shopStore'
import { bills as billsDb } from '../lib/database'
import {
  Button, Modal, EmptyState, SearchInput, ConfirmDialog, StatusStamp
} from '../components/ui'
import { FileText, Printer, Download, Share2, Search, Filter } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency, formatDateTime, getStatusColor, generateWhatsAppURL, generateBillShareMessage, generateUPIPaymentLink } from '../lib/utils'
import { ThermalBill } from '../components/pos/ThermalBill'
import { useReactToPrint } from 'react-to-print'
import type { Bill } from '../types'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'PAID', label: 'Paid' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'DUE', label: 'Due' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'EXCHANGED', label: 'Exchanged' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export const Bills: React.FC = () => {
  const { activeShop, activeSettings } = useShopStore()
  const [searchParams] = useSearchParams()

  const [billList, setBillList] = useState<Bill[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const limit = 30

  const [viewBill, setViewBill] = useState<Bill | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [markPaidModal, setMarkPaidModal] = useState<Bill | null>(null)
  const [payAmount, setPayAmount] = useState(0)
  const [payMethod, setPayMethod] = useState('Cash')
  const billRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!activeShop) return
    setLoading(true)
    try {
      const { data, count } = await billsDb.list(activeShop.id, {
        search: search || undefined,
        status: status || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        limit, offset: page * limit,
      })
      setBillList(data)
      setTotal(count)
    } finally { setLoading(false) }
  }, [activeShop?.id, search, status, fromDate, toDate, page])

  useEffect(() => { load() }, [load])

  // Handle ?id= query param
  useEffect(() => {
    const id = searchParams.get('id')
    if (id && activeShop) {
      billsDb.getById(id).then(b => { if (b) setViewBill(b) })
    }
  }, [searchParams, activeShop?.id])

  const handlePrint = useReactToPrint({ content: () => billRef.current })
  const handleDownloadPDF = async () => {
    if (!billRef.current || !viewBill) return
    const canvas = await html2canvas(billRef.current, { scale: 2, useCORS: true })
    const pdf = new jsPDF('p', 'mm', [80, canvas.height / (canvas.width / 80)])
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 80, canvas.height / (canvas.width / 80))
    pdf.save(`Bill-${viewBill.bill_number}.pdf`)
  }

  const handleWhatsApp = (bill: Bill) => {
    // Build UPI payment link if shop has a UPI ID and there's a due amount
    const upiPaymentLink = (activeShop?.upi_id && bill.due_amount > 0)
      ? generateUPIPaymentLink(activeShop.upi_id, activeShop.name, bill.due_amount, bill.bill_number)
      : undefined
    const msg = generateBillShareMessage(
      activeShop?.name || '', bill.bill_number,
      bill.customer_name || 'Customer', bill.grand_total,
      bill.paid_amount, bill.due_amount,
      new Date(bill.created_at).toLocaleDateString('en-IN'),
      upiPaymentLink
    )
    const phone = bill.customer_whatsapp || bill.customer_phone || '916296240320'
    window.open(generateWhatsAppURL(phone, msg), '_blank')
  }

  const handleMarkPaid = async () => {
    if (!markPaidModal || !activeShop) return
    if (!payAmount || payAmount <= 0) { toast.error('Enter a valid amount'); return }
    if (payAmount > markPaidModal.due_amount + 0.01) { toast.error(`Amount cannot exceed due of ₹${markPaidModal.due_amount.toFixed(2)}`); return }
    try {
      await billsDb.markPaid(markPaidModal.id, payAmount, payMethod, activeShop.id, markPaidModal.customer_id)
      toast.success('Payment recorded!')
      setMarkPaidModal(null)
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await billsDb.delete(deleteId)
      toast.success('Bill deleted')
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Delete failed') }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Bills</h2>
          <p className="text-sm text-gray-500">{total} bills • {activeShop?.name}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(0) }} placeholder="Search bill # or customer..." className="flex-1 min-w-48" />
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(0) }}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300" />
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300" />
      </div>

      {/* Bills Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Bill</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Paid</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Due</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center text-gray-400">Loading...</td></tr>
              ) : billList.length === 0 ? (
                <tr><td colSpan={8} className="py-12">
                  <EmptyState icon={<FileText className="w-8 h-8" />} title="No bills found" />
                </td></tr>
              ) : billList.map(bill => (
                <tr key={bill.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-blue-600">#{bill.bill_number}</p>
                    <p className="text-xs text-gray-500">{bill.bill_type}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-900 dark:text-gray-100">{bill.customer_name || 'Walk-in'}</p>
                    {bill.customer_phone && <p className="text-xs text-gray-500">{bill.customer_phone}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{formatDateTime(bill.created_at)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">{formatCurrency(bill.grand_total)}</td>
                  <td className="px-4 py-3 text-right text-green-600">{formatCurrency(bill.paid_amount)}</td>
                  <td className="px-4 py-3 text-right">
                    {bill.due_amount > 0 ? <span className="font-bold text-red-600">{formatCurrency(bill.due_amount)}</span> : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(bill.payment_status)}`}>
                      {bill.payment_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setViewBill(bill)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-600 transition-colors" title="View">
                        <FileText className="w-4 h-4" />
                      </button>
                      {(bill.payment_status === 'DUE' || bill.payment_status === 'PARTIAL') && (
                        <button onClick={() => { setMarkPaidModal(bill); setPayAmount(bill.due_amount); setPayMethod('Cash') }} className="p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-gray-400 hover:text-green-600 transition-colors" title="Mark paid">
                          ✓
                        </button>
                      )}
                      <button onClick={() => handleWhatsApp(bill)} className="p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-gray-400 hover:text-green-600 transition-colors" title="WhatsApp">
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
            <span className="text-sm text-gray-500">{page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Previous</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * limit >= total}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* View Bill Modal */}
      <Modal isOpen={!!viewBill} onClose={() => setViewBill(null)} title={`Bill #${viewBill?.bill_number}`} size="lg">
        {viewBill && activeShop && activeSettings && (
          <div className="p-6 space-y-4">
            <div className="flex gap-3">
              <Button size="sm" icon={<Printer className="w-4 h-4" />} onClick={handlePrint}>Print</Button>
              <Button size="sm" variant="secondary" icon={<Download className="w-4 h-4" />} onClick={handleDownloadPDF}>PDF</Button>
              <Button size="sm" variant="outline" icon={<Share2 className="w-4 h-4" />} onClick={() => handleWhatsApp(viewBill)}>WhatsApp</Button>
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white max-h-[500px] overflow-y-auto">
              <ThermalBill ref={billRef} bill={viewBill} items={viewBill.bill_items || []} shop={activeShop} settings={activeSettings} />
            </div>
          </div>
        )}
      </Modal>

      {/* Mark Paid Modal */}
      <Modal isOpen={!!markPaidModal} onClose={() => setMarkPaidModal(null)} title="Collect Payment" size="sm">
        {markPaidModal && (
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Bill <strong>#{markPaidModal.bill_number}</strong> • Due: <strong className="text-red-600">{formatCurrency(markPaidModal.due_amount)}</strong>
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
              <input type="number" value={payAmount} onChange={e => setPayAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex flex-wrap gap-2">
              {(activeSettings?.payment_methods || ['Cash', 'UPI', 'Card']).map(m => (
                <button key={m} onClick={() => setPayMethod(m)}
                  className={`px-3 py-1.5 text-xs rounded-full transition-colors ${payMethod === m ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                  {m}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" fullWidth onClick={() => setMarkPaidModal(null)}>Cancel</Button>
              <Button fullWidth variant="success" onClick={handleMarkPaid}>Collect ₹{payAmount}</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete Bill" message="Delete this bill? Stock will NOT be restored automatically." confirmLabel="Delete" danger />
    </div>
  )
}
