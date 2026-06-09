import React, { useState, useEffect, useCallback } from 'react'
import { useShopStore } from '../store/shopStore'
import { bills as billsDb } from '../lib/database'
import { Button, Modal, EmptyState, Card } from '../components/ui'
import { AlertCircle, Send, CheckCircle, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency, formatDate, generateWhatsAppURL, generateDueReminderMessage, generateUPIPaymentLink, generateUPIString } from '../lib/utils'
import type { Bill } from '../types'

export const DueManagement: React.FC = () => {
  const { activeShop, activeSettings } = useShopStore()
  const [dueBills, setDueBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [markPaidModal, setMarkPaidModal] = useState<Bill | null>(null)
  const [payAmount, setPayAmount] = useState(0)
  const [payMethod, setPayMethod] = useState('Cash')

  const load = useCallback(async () => {
    if (!activeShop) return
    setLoading(true)
    try {
      const data = await billsDb.getDue(activeShop.id)
      setDueBills(data)
    } finally { setLoading(false) }
  }, [activeShop?.id])

  useEffect(() => { load() }, [load])

  const totalDue = dueBills.reduce((s, b) => s + b.due_amount, 0)

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

  const sendReminder = (bill: Bill) => {
    if (!bill.customer_whatsapp && !bill.customer_phone) { toast.error('No WhatsApp number'); return }
    // Build UPI payment link for the specific bill's due amount
    const upiPaymentLink = activeShop?.upi_id
      ? generateUPIPaymentLink(activeShop.upi_id, activeShop.name || '', bill.due_amount, bill.bill_number)
      : undefined
    const msg = generateDueReminderMessage(activeShop?.name || '', bill.customer_name || 'Customer', bill.due_amount, [bill.bill_number], upiPaymentLink)
    const phone = bill.customer_whatsapp || bill.customer_phone || ''
    window.open(generateWhatsAppURL(phone, msg), '_blank')
  }

  // Group by customer
  const byCustomer = dueBills.reduce<Record<string, { name: string; phone: string; bills: Bill[]; total: number }>>((acc, bill) => {
    const key = bill.customer_name || 'Walk-in Customer'
    if (!acc[key]) acc[key] = { name: key, phone: bill.customer_phone || bill.customer_whatsapp || '', bills: [], total: 0 }
    acc[key].bills.push(bill)
    acc[key].total += bill.due_amount
    return acc
  }, {})

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Due Management</h2>
          <p className="text-sm text-gray-500">{dueBills.length} pending bills • {activeShop?.name}</p>
        </div>
      </div>

      {/* Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Due</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(totalDue)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
            <DollarSign className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Pending Bills</p>
            <p className="text-xl font-bold text-amber-600">{dueBills.length}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <CheckCircle className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Customers with Due</p>
            <p className="text-xl font-bold text-blue-600">{Object.keys(byCustomer).length}</p>
          </div>
        </Card>
      </div>

      {/* Customer-wise Due */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : dueBills.length === 0 ? (
        <EmptyState icon={<CheckCircle className="w-10 h-10" />} title="No pending dues!" description="All bills have been paid." />
      ) : (
        <div className="space-y-4">
          {Object.values(byCustomer).map(group => (
            <Card key={group.name} padding={false}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{group.name}</p>
                  {group.phone && <p className="text-xs text-gray-500">{group.phone}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-red-600">{formatCurrency(group.total)}</span>
                  {group.phone && (
                    <button
                      onClick={() => {
                        // UPI link for total group due — use generic note since multiple bills
                        const upiPaymentLink = activeShop?.upi_id
                          ? generateUPIString(activeShop.upi_id, activeShop.name || '', group.total, 'Due Payment')
                          : undefined
                        const msg = generateDueReminderMessage(activeShop?.name || '', group.name, group.total, group.bills.map(b => b.bill_number), upiPaymentLink)
                        window.open(generateWhatsAppURL(group.phone, msg), '_blank')
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      <Send className="w-3 h-3" /> Remind
                    </button>
                  )}
                </div>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {group.bills.map(bill => (
                  <div key={bill.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-blue-600">#{bill.bill_number}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bill.payment_status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          {bill.payment_status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDate(bill.created_at)} • Total: {formatCurrency(bill.grand_total)} • Paid: {formatCurrency(bill.paid_amount)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">{formatCurrency(bill.due_amount)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="success"
                      icon={<CheckCircle className="w-3 h-3" />}
                      onClick={() => { setMarkPaidModal(bill); setPayAmount(bill.due_amount); setPayMethod('Cash') }}
                    >
                      Collect
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Mark Paid Modal */}
      <Modal isOpen={!!markPaidModal} onClose={() => setMarkPaidModal(null)} title="Collect Payment" size="sm">
        {markPaidModal && (
          <div className="p-6 space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Bill #{markPaidModal.bill_number}</p>
              <p className="text-sm text-gray-500 mt-1">Customer: {markPaidModal.customer_name || 'Walk-in'}</p>
              <p className="text-sm text-gray-500">Total Due: <strong className="text-red-600">{formatCurrency(markPaidModal.due_amount)}</strong></p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount Collected</label>
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
              <Button fullWidth variant="success" onClick={handleMarkPaid}>Confirm ₹{payAmount}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
