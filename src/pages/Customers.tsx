import React, { useState, useEffect, useCallback } from 'react'
import { useShopStore } from '../store/shopStore'
import { customers as customersDb, bills as billsDb } from '../lib/database'
import {
  Button, Input, Modal, EmptyState, ConfirmDialog, SearchInput, Card
} from '../components/ui'
import { Plus, Edit, Trash2, Users, Phone, MessageCircle, Eye, History, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency, formatDate, generateWhatsAppURL, generateDueReminderMessage, generateUPIString } from '../lib/utils'
import type { Customer, Bill } from '../types'

export const Customers: React.FC = () => {
  const { activeShop } = useShopStore()
  const [customerList, setCustomerList] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [editForm, setEditForm] = useState<Partial<Customer>>({})
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null)
  const [customerBills, setCustomerBills] = useState<Bill[]>([])
  const [addModal, setAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', phone: '', whatsapp: '', address: '', gst_number: '', notes: '' })

  const load = useCallback(async () => {
    if (!activeShop) return
    setLoading(true)
    try {
      const data = await customersDb.list(activeShop.id, search || undefined)
      setCustomerList(data)
    } finally {
      setLoading(false)
    }
  }, [activeShop?.id, search])

  useEffect(() => { load() }, [load])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await customersDb.delete(deleteId)
      toast.success('Customer deleted')
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Delete failed') }
  }

  const handleEditSave = async () => {
    if (!editCustomer) return
    try {
      await customersDb.update(editCustomer.id, editForm)
      toast.success('Customer updated')
      setEditCustomer(null)
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Update failed') }
  }

  const handleAddSave = async () => {
    if (!activeShop || !addForm.name) { toast.error('Name is required'); return }
    try {
      await customersDb.create({ shop_id: activeShop.id, name: addForm.name, phone: addForm.phone || null, whatsapp: addForm.whatsapp || null, address: addForm.address || null, gst_number: addForm.gst_number || null, notes: addForm.notes || null })
      toast.success('Customer added')
      setAddModal(false)
      setAddForm({ name: '', phone: '', whatsapp: '', address: '', gst_number: '', notes: '' })
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Add failed') }
  }

  const viewHistory = async (customer: Customer) => {
    const bills = await customersDb.getBills(customer.id)
    setCustomerBills(bills)
    setViewCustomer(customer)
  }

  const sendDueReminder = async (customer: Customer) => {
    if (!customer.whatsapp && !customer.phone) { toast.error('No contact number'); return }
    if (!activeShop) return
    try {
      // Fetch bill numbers so the reminder message lists actual bill numbers
      const allBills = await customersDb.getBills(customer.id)
      const dueBillNumbers = allBills
        .filter(b => b.payment_status === 'DUE' || b.payment_status === 'PARTIAL')
        .map(b => b.bill_number)
      // Build UPI payment link if shop has a UPI ID
      const upiPaymentLink = (activeShop.upi_id && customer.total_due > 0)
        ? generateUPIString(activeShop.upi_id, activeShop.name, customer.total_due, 'Due Payment')
        : undefined
      const msg = generateDueReminderMessage(activeShop.name, customer.name, customer.total_due, dueBillNumbers, upiPaymentLink)
      const phone = customer.whatsapp || customer.phone || ''
      window.open(generateWhatsAppURL(phone, msg), '_blank')
    } catch {
      toast.error('Failed to fetch bill details')
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Customers</h2>
          <p className="text-sm text-gray-500">{customerList.length} customers • {activeShop?.name}</p>
        </div>
        <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setAddModal(true)}>Add Customer</Button>
      </div>

      <SearchInput value={search} onChange={v => setSearch(v)} placeholder="Search by name or phone..." className="max-w-md" />

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Contact</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Purchase</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Due</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Last Visit</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">Loading...</td></tr>
              ) : customerList.length === 0 ? (
                <tr><td colSpan={6} className="py-12">
                  <EmptyState icon={<Users className="w-8 h-8" />} title="No customers found" action={<Button size="sm" onClick={() => setAddModal(true)}>Add Customer</Button>} />
                </td></tr>
              ) : customerList.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{c.name}</p>
                    {c.address && <p className="text-xs text-gray-500 truncate max-w-[200px]">{c.address}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {c.phone && <span className="text-sm text-gray-700 dark:text-gray-300">{c.phone}</span>}
                      {c.whatsapp && (
                        <button onClick={() => window.open(generateWhatsAppURL(c.whatsapp!, `Hello ${c.name}!`), '_blank')} className="text-green-600 hover:text-green-700">
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">{formatCurrency(c.total_purchase)}</td>
                  <td className="px-4 py-3 text-right">
                    {c.total_due > 0 ? (
                      <span className="font-bold text-red-600">{formatCurrency(c.total_due)}</span>
                    ) : (
                      <span className="text-green-600 text-xs font-medium">Clear</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {c.last_purchase_date ? formatDate(c.last_purchase_date) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => viewHistory(c)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-600 transition-colors" title="View history">
                        <History className="w-4 h-4" />
                      </button>
                      {c.total_due > 0 && (
                        <button onClick={() => sendDueReminder(c)} className="p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-gray-400 hover:text-green-600 transition-colors" title="Send due reminder">
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => { setEditCustomer(c); setEditForm(c) }} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-600 transition-colors" title="Edit">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Customer Modal */}
      <Modal isOpen={addModal} onClose={() => setAddModal(false)} title="Add Customer" size="sm">
        <div className="p-6 space-y-3">
          <Input label="Name *" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} />
          <Input label="Phone" value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} />
          <Input label="WhatsApp" value={addForm.whatsapp} onChange={e => setAddForm(f => ({ ...f, whatsapp: e.target.value }))} />
          <Input label="Address" value={addForm.address} onChange={e => setAddForm(f => ({ ...f, address: e.target.value }))} />
          <Input label="GST Number" value={addForm.gst_number} onChange={e => setAddForm(f => ({ ...f, gst_number: e.target.value }))} />
          <div className="flex gap-3">
            <Button variant="outline" fullWidth onClick={() => setAddModal(false)}>Cancel</Button>
            <Button fullWidth onClick={handleAddSave}>Add Customer</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Customer Modal */}
      <Modal isOpen={!!editCustomer} onClose={() => setEditCustomer(null)} title="Edit Customer" size="sm">
        {editCustomer && (
          <div className="p-6 space-y-3">
            <Input label="Name *" value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            <Input label="Phone" value={editForm.phone || ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
            <Input label="WhatsApp" value={editForm.whatsapp || ''} onChange={e => setEditForm(f => ({ ...f, whatsapp: e.target.value }))} />
            <Input label="Address" value={editForm.address || ''} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
            <Input label="GST Number" value={editForm.gst_number || ''} onChange={e => setEditForm(f => ({ ...f, gst_number: e.target.value }))} />
            <div className="flex gap-3">
              <Button variant="outline" fullWidth onClick={() => setEditCustomer(null)}>Cancel</Button>
              <Button fullWidth onClick={handleEditSave}>Save</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Customer History Modal */}
      <Modal isOpen={!!viewCustomer} onClose={() => setViewCustomer(null)} title={`History: ${viewCustomer?.name}`} size="xl">
        {viewCustomer && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="text-center p-4">
                <p className="text-xs text-gray-500">Total Purchase</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatCurrency(viewCustomer.total_purchase)}</p>
              </Card>
              <Card className="text-center p-4">
                <p className="text-xs text-gray-500">Due Amount</p>
                <p className={`text-lg font-bold mt-1 ${viewCustomer.total_due > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(viewCustomer.total_due)}</p>
              </Card>
              <Card className="text-center p-4">
                <p className="text-xs text-gray-500">Total Bills</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{customerBills.length}</p>
              </Card>
              <Card className="text-center p-4">
                <p className="text-xs text-gray-500">Last Visit</p>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-1">{viewCustomer.last_purchase_date ? formatDate(viewCustomer.last_purchase_date) : '-'}</p>
              </Card>
            </div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Purchase History</h4>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {customerBills.map(bill => (
                <div key={bill.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm">
                  <div>
                    <span className="font-semibold text-blue-600">#{bill.bill_number}</span>
                    <span className="text-gray-500 ml-2">{formatDate(bill.created_at)}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 dark:text-gray-100">{formatCurrency(bill.grand_total)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bill.payment_status === 'PAID' ? 'bg-green-100 text-green-700' : bill.payment_status === 'DUE' || bill.payment_status === 'PARTIAL' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                      {bill.payment_status}
                    </span>
                  </div>
                </div>
              ))}
              {customerBills.length === 0 && <p className="text-center text-gray-400 text-sm py-4">No bills found</p>}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete Customer" message="Delete this customer? Their bill history will be preserved." confirmLabel="Delete" danger
      />
    </div>
  )
}
