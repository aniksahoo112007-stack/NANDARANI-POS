import React, { useState, useEffect, useCallback } from 'react'
import { useShopStore } from '../store/shopStore'
import { returns as returnsDb, exchanges as exchangesDb, bills as billsDb } from '../lib/database'
import { Button, Input, Modal, EmptyState, Card } from '../components/ui'
import { ArrowLeftRight, RefreshCw, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency, formatDate } from '../lib/utils'
import type { Return, Exchange, Bill, BillItem, ReturnItem, ExchangeItem } from '../types'

type Tab = 'returns' | 'exchanges'

export const Returns: React.FC = () => {
  const { activeShop } = useShopStore()
  const [tab, setTab] = useState<Tab>('returns')
  const [returnList, setReturnList] = useState<Return[]>([])
  const [exchangeList, setExchangeList] = useState<Exchange[]>([])
  const [loading, setLoading] = useState(true)

  // Return Modal
  const [returnModal, setReturnModal] = useState(false)
  const [billSearch, setBillSearch] = useState('')
  const [foundBill, setFoundBill] = useState<Bill | null>(null)
  const [selectedReturnItems, setSelectedReturnItems] = useState<{ item: BillItem; qty: number }[]>([])
  const [returnReason, setReturnReason] = useState('')
  const [refundMethod, setRefundMethod] = useState('Cash')
  const [billerName, setBillerName] = useState('')

  // Exchange Modal
  const [exchangeModal, setExchangeModal] = useState(false)
  const [newItems, setNewItems] = useState<Partial<ExchangeItem>[]>([])

  const load = useCallback(async () => {
    if (!activeShop) return
    setLoading(true)
    try {
      const [r, e] = await Promise.all([
        returnsDb.list(activeShop.id),
        exchangesDb.list(activeShop.id),
      ])
      setReturnList(r)
      setExchangeList(e)
    } finally { setLoading(false) }
  }, [activeShop?.id])

  useEffect(() => { load() }, [load])

  const searchBill = async () => {
    if (!activeShop || !billSearch.trim()) return
    const bill = await billsDb.getByNumber(activeShop.id, billSearch.trim())
    if (!bill) { toast.error('Bill not found'); return }
    setFoundBill(bill)
    setSelectedReturnItems([])
  }

  const toggleReturnItem = (item: BillItem) => {
    setSelectedReturnItems(prev => {
      const existing = prev.find(r => r.item.id === item.id)
      if (existing) return prev.filter(r => r.item.id !== item.id)
      return [...prev, { item, qty: item.quantity }]
    })
  }

  const handleReturn = async () => {
    if (!activeShop || !foundBill || selectedReturnItems.length === 0) {
      toast.error('Select at least one item to return')
      return
    }

    const returnItems: Omit<ReturnItem, 'id' | 'return_id'>[] = selectedReturnItems.map(({ item, qty }) => ({
      bill_item_id: item.id,
      product_id: item.product_id,
      barcode: item.barcode,
      product_name: item.product_name,
      quantity: qty,
      unit_price: item.unit_price,
      total_amount: item.unit_price * qty,
    }))

    try {
      await returnsDb.create(
        activeShop.id,
        {
          originalBillId: foundBill.id,
          originalBillNumber: foundBill.bill_number,
          customerId: foundBill.customer_id,
          customerName: foundBill.customer_name || 'Customer',
          reason: returnReason,
          refundMethod,
          billerName,
          notes: '',
        },
        returnItems
      )
      toast.success('Return processed! Stock restored.')
      setReturnModal(false)
      setFoundBill(null)
      setBillSearch('')
      setSelectedReturnItems([])
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Return failed') }
  }

  const handleExchange = async () => {
    if (!activeShop || !foundBill || selectedReturnItems.length === 0 || newItems.length === 0) {
      toast.error('Select returned items and new items')
      return
    }

    const returnedItems: Omit<ExchangeItem, 'id' | 'exchange_id'>[] = selectedReturnItems.map(({ item, qty }) => ({
      item_type: 'RETURNED' as const,
      product_id: item.product_id,
      barcode: item.barcode,
      product_name: item.product_name,
      quantity: qty,
      unit_price: item.unit_price,
      total_amount: item.unit_price * qty,
    }))

    const validNewItems = newItems.filter(i => i.product_name && i.unit_price) as ExchangeItem[]

    try {
      await exchangesDb.create(
        activeShop.id,
        {
          originalBillId: foundBill.id,
          originalBillNumber: foundBill.bill_number,
          customerId: foundBill.customer_id,
          customerName: foundBill.customer_name || 'Customer',
          reason: returnReason,
          paymentMethod: refundMethod,
          billerName,
        },
        returnedItems,
        validNewItems.map(i => ({ ...i, item_type: 'NEW' as const }))
      )
      toast.success('Exchange processed!')
      setExchangeModal(false)
      setFoundBill(null)
      setBillSearch('')
      setSelectedReturnItems([])
      setNewItems([])
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Exchange failed') }
  }

  const resetModals = () => {
    setFoundBill(null)
    setBillSearch('')
    setSelectedReturnItems([])
    setNewItems([])
    setReturnReason('')
    setRefundMethod('Cash')
    setBillerName('')
  }

  const totalRefunded = returnList.reduce((s, r) => s + r.refund_amount, 0)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Returns & Exchange</h2>
          <p className="text-sm text-gray-500">{activeShop?.name}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" icon={<RefreshCw className="w-4 h-4" />} onClick={() => { resetModals(); setReturnModal(true) }}>
            Process Return
          </Button>
          <Button size="sm" icon={<ArrowLeftRight className="w-4 h-4" />} onClick={() => { resetModals(); setExchangeModal(true) }}>
            Process Exchange
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <p className="text-sm text-gray-500">Total Returns</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{returnList.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Total Refunded</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(totalRefunded)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Total Exchanges</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{exchangeList.length}</p>
        </Card>
      </div>

      {/* Tab */}
      <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden w-fit">
        {(['returns', 'exchanges'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-6 py-2 text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Returns Table */}
      {tab === 'returns' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Return #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Original Bill</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reason</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Refund</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {returnList.length === 0 ? (
                <tr><td colSpan={6} className="py-12">
                  <EmptyState icon={<RefreshCw className="w-8 h-8" />} title="No returns yet" />
                </td></tr>
              ) : returnList.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{r.return_number}</td>
                  <td className="px-4 py-3 text-blue-600">#{r.original_bill_number}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.customer_name}</td>
                  <td className="px-4 py-3 text-gray-500 truncate max-w-32">{r.reason || '-'}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(r.refund_amount)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Exchanges Table */}
      {tab === 'exchanges' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Exchange #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Original Bill</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Returned</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">New Items</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Difference</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {exchangeList.length === 0 ? (
                <tr><td colSpan={7} className="py-12">
                  <EmptyState icon={<ArrowLeftRight className="w-8 h-8" />} title="No exchanges yet" />
                </td></tr>
              ) : exchangeList.map(e => (
                <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{e.exchange_number}</td>
                  <td className="px-4 py-3 text-blue-600">#{e.original_bill_number}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{e.customer_name}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(e.returned_value)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(e.new_items_value)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={e.price_difference > 0 ? 'text-red-600 font-bold' : e.price_difference < 0 ? 'text-green-600 font-bold' : 'text-gray-500'}>
                      {e.price_difference > 0 ? '+' : ''}{formatCurrency(e.price_difference)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(e.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Return Modal */}
      <Modal isOpen={returnModal} onClose={() => setReturnModal(false)} title="Process Return" size="lg">
        <div className="p-6 space-y-4">
          {/* Bill Search */}
          <div className="flex gap-2">
            <Input value={billSearch} onChange={e => setBillSearch(e.target.value)} placeholder="Enter bill number (e.g. NB-000001)" onKeyDown={e => e.key === 'Enter' && searchBill()} className="flex-1" />
            <Button onClick={searchBill} variant="secondary">Find Bill</Button>
          </div>

          {foundBill && (
            <>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Bill #{foundBill.bill_number} • {foundBill.customer_name || 'Walk-in'} • {formatCurrency(foundBill.grand_total)}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select items to return:</p>
                <div className="space-y-2">
                  {(foundBill.bill_items || []).map(item => {
                    const selected = selectedReturnItems.find(r => r.item.id === item.id)
                    return (
                      <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${selected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}`}
                        onClick={() => toggleReturnItem(item)}>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.product_name}</p>
                          <p className="text-xs text-gray-500">{item.barcode} {item.size && `• ${item.size}`} • Qty: {item.quantity}</p>
                        </div>
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatCurrency(item.total_amount)}</p>
                        {selected && (
                          <input
                            type="number" min="1" max={item.quantity}
                            value={selected.qty}
                            onClick={e => e.stopPropagation()}
                            onChange={e => setSelectedReturnItems(prev => prev.map(r => r.item.id === item.id ? { ...r, qty: parseInt(e.target.value) || 1 } : r))}
                            className="w-16 px-2 py-1 text-sm border border-gray-300 rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input label="Reason" value={returnReason} onChange={e => setReturnReason(e.target.value)} placeholder="Defective / Wrong size..." />
                <Input label="Biller Name" value={billerName} onChange={e => setBillerName(e.target.value)} />
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Refund Method</p>
                <div className="flex gap-2">
                  {['Cash', 'UPI', 'Card', 'Store Credit'].map(m => (
                    <button key={m} onClick={() => setRefundMethod(m)}
                      className={`px-3 py-1.5 text-xs rounded-full transition-colors ${refundMethod === m ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {selectedReturnItems.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-sm">
                  Refund Amount: <strong className="text-red-600">{formatCurrency(selectedReturnItems.reduce((s, { item, qty }) => s + item.unit_price * qty, 0))}</strong>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" fullWidth onClick={() => setReturnModal(false)}>Cancel</Button>
                <Button fullWidth onClick={handleReturn} disabled={selectedReturnItems.length === 0}>Process Return</Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Exchange Modal */}
      <Modal isOpen={exchangeModal} onClose={() => setExchangeModal(false)} title="Process Exchange" size="xl">
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            <Input value={billSearch} onChange={e => setBillSearch(e.target.value)} placeholder="Enter bill number" onKeyDown={e => e.key === 'Enter' && searchBill()} className="flex-1" />
            <Button onClick={searchBill} variant="secondary">Find Bill</Button>
          </div>

          {foundBill && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Items to Return */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Items Being Returned</h4>
                <div className="space-y-2">
                  {(foundBill.bill_items || []).map(item => {
                    const selected = selectedReturnItems.find(r => r.item.id === item.id)
                    return (
                      <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}
                        onClick={() => toggleReturnItem(item)}>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.product_name}</p>
                          <p className="text-xs text-gray-500">₹{item.unit_price} × {item.quantity}</p>
                        </div>
                        {selected && <span className="text-xs text-blue-600 font-bold">✓ RETURNING</span>}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Right: New Items */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">New Items Given</h4>
                <div className="space-y-2">
                  {newItems.map((item, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input type="text" placeholder="Product name" value={item.product_name || ''} onChange={e => setNewItems(prev => prev.map((n, idx) => idx === i ? { ...n, product_name: e.target.value } : n))}
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none" />
                      <input type="number" placeholder="Qty" min="1" value={item.quantity || 1} onChange={e => setNewItems(prev => prev.map((n, idx) => idx === i ? { ...n, quantity: parseInt(e.target.value) || 1, total_amount: (n.unit_price || 0) * (parseInt(e.target.value) || 1) } : n))}
                        className="w-14 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none" />
                      <input type="number" placeholder="₹/unit" value={item.unit_price || ''} onChange={e => setNewItems(prev => prev.map((n, idx) => idx === i ? { ...n, unit_price: parseFloat(e.target.value) || 0, total_amount: (parseFloat(e.target.value) || 0) * (n.quantity || 1) } : n))}
                        className="w-20 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none" />
                      <button onClick={() => setNewItems(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button onClick={() => setNewItems(prev => [...prev, { product_name: '', unit_price: 0, quantity: 1, total_amount: 0, item_type: 'NEW' }])}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 border border-dashed border-blue-300 rounded-xl hover:bg-blue-50 w-full justify-center">
                    <Plus className="w-4 h-4" /> Add New Item
                  </button>
                </div>
              </div>
            </div>
          )}

          {foundBill && (
            <>
              <div className="grid grid-cols-2 gap-4 mb-2">
                <Input label="Reason" value={returnReason} onChange={e => setReturnReason(e.target.value)} placeholder="Wrong size / Defective..." />
                <Input label="Biller Name" value={billerName} onChange={e => setBillerName(e.target.value)} placeholder="Staff name" />
              </div>
              <div className="grid grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Returned Value</p>
                  <p className="font-bold text-red-600">{formatCurrency(selectedReturnItems.reduce((s, { item, qty }) => s + item.unit_price * qty, 0))}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">New Items Value</p>
                  <p className="font-bold text-green-600">{formatCurrency(newItems.reduce((s, i) => s + (i.total_amount || 0), 0))}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Difference</p>
                  {(() => {
                    const diff = newItems.reduce((s, i) => s + (i.total_amount || 0), 0) - selectedReturnItems.reduce((s, { item, qty }) => s + item.unit_price * qty, 0)
                    return (
                      <p className={`font-bold ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                        {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                        <span className="block text-xs font-normal text-gray-500 mt-0.5">{diff > 0 ? 'Customer pays' : diff < 0 ? 'Refund to customer' : 'Even exchange'}</span>
                      </p>
                    )
                  })()}
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" fullWidth onClick={() => setExchangeModal(false)}>Cancel</Button>
                <Button fullWidth onClick={handleExchange}>Process Exchange</Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
