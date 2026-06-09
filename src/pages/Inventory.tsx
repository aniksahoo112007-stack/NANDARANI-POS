import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useReactToPrint } from 'react-to-print'
import { useShopStore } from '../store/shopStore'
import { products as productsDb } from '../lib/database'
import {
  Button, Card, Badge, Modal, Input, EmptyState,
  ConfirmDialog, Table, Th, Td, SearchInput
} from '../components/ui'
import {
  Plus, Edit, Trash2, Package, TrendingDown, Eye,
  BarChart2, Filter, ChevronDown, RefreshCw, Download, Printer,
  CheckSquare, Square, Layers, Tag, Percent, Users, AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency, formatDate, exportToCSV } from '../lib/utils'
import type { Product, InventoryMovement } from '../types'
import JsBarcode from 'jsbarcode'
import { BarcodeLabelSheet } from '../components/pos/BarcodeLabel'
import type { LabelFormat } from '../components/pos/BarcodeLabel'

export const Inventory: React.FC = () => {
  const { activeShop } = useShopStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [productList, setProductList] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [lowStockOnly, setLowStockOnly] = useState(searchParams.get('filter') === 'lowStock')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const limit = 50

  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [editForm, setEditForm] = useState<Partial<Product>>({})
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [viewProduct, setViewProduct] = useState<Product | null>(null)
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [stockModal, setStockModal] = useState<{ product: Product; type: 'IN' | 'OUT' | 'ADJUSTMENT' } | null>(null)
  const [stockQty, setStockQty] = useState(0)
  const [stockNotes, setStockNotes] = useState('')

  // Barcode label print
  const [labelProduct, setLabelProduct] = useState<Product | null>(null)
  const [labelFormat, setLabelFormat] = useState<LabelFormat>('A4')
  const [labelQty, setLabelQty] = useState(1)
  const labelSheetRef = useRef<HTMLDivElement>(null)

  // ─── Bulk management ──────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkModal, setBulkModal] = useState<'price' | 'category' | 'gst' | 'supplier' | 'lowstock' | null>(null)
  const [bulkPriceMode, setBulkPriceMode] = useState<'increase_pct' | 'decrease_pct' | 'set'>('increase_pct')
  const [bulkPriceValue, setBulkPriceValue] = useState(0)
  const [bulkTextValue, setBulkTextValue] = useState('')
  const [bulkNumValue, setBulkNumValue] = useState(0)
  const [bulkApplying, setBulkApplying] = useState(false)

  const handlePrintLabels = useReactToPrint({
    content: () => labelSheetRef.current,
    documentTitle: `Barcode-Labels`,
    pageStyle: `
      @page {
        size: ${labelFormat === 'A4' ? 'A4 portrait' : '58mm auto'};
        margin: ${labelFormat === 'A4' ? '5mm' : '2mm'};
      }
      @media print {
        body { margin: 0; }
        #barcode-label-sheet { page-break-inside: avoid; }
        .barcode-label { break-inside: avoid; }
      }
    `,
  })

  const load = useCallback(async () => {
    if (!activeShop) return
    setLoading(true)
    try {
      const opts = { search, category: category || undefined, lowStock: lowStockOnly, limit, offset: page * limit }
      const { data, count } = await productsDb.list(activeShop.id, opts)
      setProductList(data)
      setTotal(count)
    } finally {
      setLoading(false)
    }
  }, [activeShop?.id, search, category, lowStockOnly, page])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (activeShop) {
      productsDb.getCategories(activeShop.id).then(setCategories)
    }
  }, [activeShop?.id])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await productsDb.delete(deleteId)
      toast.success('Product deleted')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const handleEditSave = async () => {
    if (!editProduct) return
    try {
      await productsDb.update(editProduct.id, editForm)
      toast.success('Product updated')
      setEditProduct(null)
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  const handleStockAdjust = async () => {
    if (!stockModal || !activeShop || stockQty <= 0) return
    const { product, type } = stockModal
    const delta = type === 'OUT' ? -stockQty : type === 'IN' ? stockQty : stockQty - product.stock_quantity

    // For ADJUSTMENT, set absolute value
    const actualDelta = type === 'ADJUSTMENT' ? (stockQty - product.stock_quantity) : delta

    try {
      await productsDb.adjustStock(
        product.id, activeShop.id, actualDelta,
        type, 'MANUAL', null, null, stockNotes, 'Admin'
      )
      toast.success(`Stock updated for ${product.name}`)
      setStockModal(null)
      setStockQty(0)
      setStockNotes('')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Stock update failed')
    }
  }

  const loadMovements = async (product: Product) => {
    const data = await productsDb.getInventoryMovements(product.id)
    setMovements(data)
    setViewProduct(product)
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === productList.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(productList.map(p => p.id)))
    }
  }

  const handleBulkApply = async () => {
    if (!activeShop || selected.size === 0) return
    setBulkApplying(true)
    try {
      const ids = Array.from(selected)
      for (const id of ids) {
        const product = productList.find(p => p.id === id)
        if (!product) continue
        let updates: Partial<Product> = {}

        if (bulkModal === 'price') {
          let newPrice = product.selling_price
          if (bulkPriceMode === 'increase_pct') newPrice = parseFloat((product.selling_price * (1 + bulkPriceValue / 100)).toFixed(2))
          else if (bulkPriceMode === 'decrease_pct') newPrice = parseFloat((product.selling_price * (1 - bulkPriceValue / 100)).toFixed(2))
          else newPrice = bulkPriceValue
          updates = { selling_price: Math.max(0, newPrice) }
        } else if (bulkModal === 'category') {
          updates = { category: bulkTextValue }
        } else if (bulkModal === 'gst') {
          updates = { gst_rate: bulkNumValue }
        } else if (bulkModal === 'supplier') {
          updates = { supplier_name: bulkTextValue }
        } else if (bulkModal === 'lowstock') {
          updates = { low_stock_limit: bulkNumValue }
        }

        await productsDb.update(id, updates)
      }

      toast.success(`Updated ${ids.length} products`)
      setBulkModal(null)
      setSelected(new Set())
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Bulk update failed')
    } finally {
      setBulkApplying(false)
    }
  }

  const handleExport = () => {
    if (!productList.length) return
    exportToCSV(productList.map(p => ({
      barcode: p.barcode,
      name: p.name,
      category: p.category || '',
      brand: p.brand || '',
      size: p.size || '',
      color: p.color || '',
      gender: p.gender,
      purchase_price: p.purchase_price,
      selling_price: p.selling_price,
      mrp: p.mrp,
      stock_quantity: p.stock_quantity,
      low_stock_limit: p.low_stock_limit,
      supplier: p.supplier_name || '',
      added: p.created_at.slice(0, 10),
    })), `inventory-${activeShop?.bill_prefix}`)
    toast.success('Inventory exported!')
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Inventory</h2>
          <p className="text-sm text-gray-500">{total} products • {activeShop?.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<Download className="w-4 h-4" />} onClick={handleExport}>Export</Button>
          <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => navigate('/products/add')}>Add Product</Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">{selected.size} selected</span>
          <div className="flex flex-wrap gap-2 ml-2">
            <Button variant="outline" size="sm" onClick={() => { setBulkModal('price'); setBulkPriceValue(0); setBulkPriceMode('increase_pct') }} icon={<Tag className="w-3.5 h-3.5" />}>Bulk Price</Button>
            <Button variant="outline" size="sm" onClick={() => { setBulkModal('category'); setBulkTextValue('') }} icon={<Layers className="w-3.5 h-3.5" />}>Category</Button>
            <Button variant="outline" size="sm" onClick={() => { setBulkModal('gst'); setBulkNumValue(0) }} icon={<Percent className="w-3.5 h-3.5" />}>GST %</Button>
            <Button variant="outline" size="sm" onClick={() => { setBulkModal('supplier'); setBulkTextValue('') }} icon={<Users className="w-3.5 h-3.5" />}>Supplier</Button>
            <Button variant="outline" size="sm" onClick={() => { setBulkModal('lowstock'); setBulkNumValue(5) }} icon={<AlertTriangle className="w-3.5 h-3.5" />}>Low Stock Limit</Button>
          </div>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Clear selection</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(0) }} placeholder="Search by name or barcode..." className="flex-1 min-w-48" />
        <select
          value={category}
          onChange={e => { setCategory(e.target.value); setPage(0) }}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={() => { setLowStockOnly(v => !v); setPage(0) }}
          className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${lowStockOnly ? 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}
        >
          <TrendingDown className="w-4 h-4" />
          Low Stock
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50">
                <th className="px-3 py-3 w-10">
                  <button onClick={toggleSelectAll} className="text-gray-400 hover:text-blue-600">
                    {selected.size === productList.length && productList.length > 0
                      ? <CheckSquare className="w-4 h-4 text-blue-600" />
                      : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Barcode</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Price</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">Loading...</td></tr>
              ) : productList.length === 0 ? (
                <tr><td colSpan={6} className="py-12">
                  <EmptyState icon={<Package className="w-8 h-8" />} title="No products found" action={<Button size="sm" onClick={() => navigate('/products/add')}>Add First Product</Button>} />
                </td></tr>
              ) : productList.map(product => (
                <tr key={product.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${selected.has(product.id) ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                  <td className="px-3 py-3">
                    <button onClick={() => toggleSelect(product.id)} className="text-gray-400 hover:text-blue-600">
                      {selected.has(product.id) ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                        ) : <Package className="w-4 h-4 text-gray-400" />}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{product.name}</p>
                        <p className="text-xs text-gray-500">{product.brand} {product.size && `• ${product.size}`} {product.color && `• ${product.color}`}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{product.barcode}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{product.category || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-medium text-gray-900 dark:text-gray-100">₹{product.selling_price}</p>
                    {product.discount_pct > 0 && <p className="text-xs text-green-600">{product.discount_pct}% off</p>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-bold ${product.stock_quantity <= product.low_stock_limit ? 'text-red-600' : product.stock_quantity <= product.low_stock_limit * 2 ? 'text-amber-600' : 'text-green-700 dark:text-green-400'}`}>
                      {product.stock_quantity}
                    </span>
                    {product.stock_quantity <= product.low_stock_limit && (
                      <p className="text-xs text-red-500">Low!</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => { setLabelProduct(product); setLabelQty(1); setLabelFormat('A4') }} className="p-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-400 hover:text-purple-600 transition-colors" title="Print barcode label">
                        <Printer className="w-4 h-4" />
                      </button>
                      <button onClick={() => loadMovements(product)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-600 transition-colors" title="View history">
                        <BarChart2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setStockModal({ product, type: 'IN' }); setStockQty(0) }}
                        className="p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-gray-400 hover:text-green-600 transition-colors"
                        title="Stock in"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setEditProduct(product); setEditForm(product) }} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-600 transition-colors" title="Edit">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteId(product.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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

      {/* Edit Product Modal */}
      <Modal isOpen={!!editProduct} onClose={() => setEditProduct(null)} title="Edit Product" size="lg">
        {editProduct && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Name *" value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="col-span-2" />
              <Input label="Selling Price" type="number" value={editForm.selling_price ?? ''} onChange={e => setEditForm(f => ({ ...f, selling_price: parseFloat(e.target.value) }))} />
              <Input label="MRP" type="number" value={editForm.mrp ?? ''} onChange={e => setEditForm(f => ({ ...f, mrp: parseFloat(e.target.value) }))} />
              <Input label="Category" value={editForm.category || ''} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} />
              <Input label="Size" value={editForm.size || ''} onChange={e => setEditForm(f => ({ ...f, size: e.target.value }))} />
              <Input label="Color" value={editForm.color || ''} onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))} />
              <Input label="GST Rate (%)" type="number" value={editForm.gst_rate ?? ''} onChange={e => setEditForm(f => ({ ...f, gst_rate: parseFloat(e.target.value) }))} />
              <Input label="Low Stock Limit" type="number" value={editForm.low_stock_limit ?? ''} onChange={e => setEditForm(f => ({ ...f, low_stock_limit: parseInt(e.target.value) }))} />
              <Input label="Image URL" value={editForm.image_url || ''} onChange={e => setEditForm(f => ({ ...f, image_url: e.target.value }))} className="col-span-2" />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setEditProduct(null)}>Cancel</Button>
              <Button onClick={handleEditSave}>Save Changes</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Stock Adjustment Modal */}
      <Modal isOpen={!!stockModal} onClose={() => setStockModal(null)} title="Adjust Stock" size="sm">
        {stockModal && (
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>{stockModal.product.name}</strong><br />
              Current Stock: <strong>{stockModal.product.stock_quantity}</strong>
            </p>
            <div className="flex gap-2">
              {(['IN', 'OUT', 'ADJUSTMENT'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setStockModal(s => s ? { ...s, type: t } : s)}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${stockModal.type === t ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <Input
              label={stockModal.type === 'ADJUSTMENT' ? 'Set stock to' : 'Quantity'}
              type="number"
              min="0"
              value={stockQty || ''}
              onChange={e => setStockQty(parseInt(e.target.value) || 0)}
            />
            <Input label="Notes (optional)" value={stockNotes} onChange={e => setStockNotes(e.target.value)} />
            <div className="flex gap-3">
              <Button variant="outline" fullWidth onClick={() => setStockModal(null)}>Cancel</Button>
              <Button fullWidth onClick={handleStockAdjust}>Update Stock</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Product History Modal */}
      <Modal isOpen={!!viewProduct} onClose={() => setViewProduct(null)} title={`History: ${viewProduct?.name}`} size="lg">
        {viewProduct && (
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div><span className="text-gray-500">Barcode:</span> <strong>{viewProduct.barcode}</strong></div>
              <div><span className="text-gray-500">Current Stock:</span> <strong className={viewProduct.stock_quantity <= viewProduct.low_stock_limit ? 'text-red-600' : 'text-green-600'}>{viewProduct.stock_quantity}</strong></div>
              <div><span className="text-gray-500">Category:</span> {viewProduct.category || '-'}</div>
              <div><span className="text-gray-500">Price:</span> ₹{viewProduct.selling_price}</div>
            </div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Stock Movement History</h4>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {movements.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No movements recorded</p>
              ) : movements.map(m => (
                <div key={m.id} className="flex items-center gap-3 text-sm p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${m.movement_type.includes('IN') || m.movement_type === 'ADJUSTMENT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {m.movement_type.includes('IN') || m.movement_type === 'ADJUSTMENT' ? '+' : '-'}
                  </span>
                  <div className="flex-1">
                    <span className="font-medium">{m.movement_type}</span>
                    <span className="text-gray-500 ml-2">{m.quantity} units</span>
                    {m.notes && <span className="text-gray-400 ml-2">• {m.notes}</span>}
                  </div>
                  <span className="text-xs text-gray-400">{m.created_at ? new Date(m.created_at).toLocaleDateString() : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk Modals */}
      <Modal isOpen={bulkModal === 'price'} onClose={() => setBulkModal(null)} title={`Bulk Price Update (${selected.size} products)`} size="sm">
        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            {(['increase_pct', 'decrease_pct', 'set'] as const).map(m => (
              <button key={m} onClick={() => setBulkPriceMode(m)}
                className={`flex-1 py-2 text-xs font-medium rounded-lg capitalize ${bulkPriceMode === m ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600'}`}>
                {m === 'increase_pct' ? 'Increase %' : m === 'decrease_pct' ? 'Decrease %' : 'Set Price'}
              </button>
            ))}
          </div>
          <Input
            label={bulkPriceMode === 'set' ? 'New Selling Price' : 'Percentage (%)'}
            type="number" min="0"
            value={bulkPriceValue || ''}
            onChange={e => setBulkPriceValue(parseFloat(e.target.value) || 0)}
          />
          <div className="flex gap-3">
            <Button variant="outline" fullWidth onClick={() => setBulkModal(null)}>Cancel</Button>
            <Button fullWidth onClick={handleBulkApply} loading={bulkApplying}>Apply to {selected.size} Products</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={bulkModal === 'category'} onClose={() => setBulkModal(null)} title={`Bulk Category (${selected.size} products)`} size="sm">
        <div className="p-5 space-y-4">
          <Input label="New Category" value={bulkTextValue} onChange={e => setBulkTextValue(e.target.value)} placeholder="e.g. Shirts, Sarees" list="cat-list" />
          <datalist id="cat-list">{categories.map(c => <option key={c} value={c} />)}</datalist>
          <div className="flex gap-3">
            <Button variant="outline" fullWidth onClick={() => setBulkModal(null)}>Cancel</Button>
            <Button fullWidth onClick={handleBulkApply} loading={bulkApplying}>Apply to {selected.size} Products</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={bulkModal === 'gst'} onClose={() => setBulkModal(null)} title={`Bulk GST Rate (${selected.size} products)`} size="sm">
        <div className="p-5 space-y-4">
          <Input label="New GST Rate (%)" type="number" min="0" max="28" value={bulkNumValue || ''} onChange={e => setBulkNumValue(parseFloat(e.target.value) || 0)} />
          <div className="flex gap-3">
            <Button variant="outline" fullWidth onClick={() => setBulkModal(null)}>Cancel</Button>
            <Button fullWidth onClick={handleBulkApply} loading={bulkApplying}>Apply to {selected.size} Products</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={bulkModal === 'supplier'} onClose={() => setBulkModal(null)} title={`Bulk Supplier (${selected.size} products)`} size="sm">
        <div className="p-5 space-y-4">
          <Input label="Supplier Name" value={bulkTextValue} onChange={e => setBulkTextValue(e.target.value)} placeholder="Supplier name" />
          <div className="flex gap-3">
            <Button variant="outline" fullWidth onClick={() => setBulkModal(null)}>Cancel</Button>
            <Button fullWidth onClick={handleBulkApply} loading={bulkApplying}>Apply to {selected.size} Products</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={bulkModal === 'lowstock'} onClose={() => setBulkModal(null)} title={`Bulk Low Stock Limit (${selected.size} products)`} size="sm">
        <div className="p-5 space-y-4">
          <Input label="Low Stock Limit" type="number" min="0" value={bulkNumValue || ''} onChange={e => setBulkNumValue(parseInt(e.target.value) || 0)} />
          <div className="flex gap-3">
            <Button variant="outline" fullWidth onClick={() => setBulkModal(null)}>Cancel</Button>
            <Button fullWidth onClick={handleBulkApply} loading={bulkApplying}>Apply to {selected.size} Products</Button>
          </div>
        </div>
      </Modal>

      {/* Barcode Label Print Modal */}
      <Modal isOpen={!!labelProduct} onClose={() => setLabelProduct(null)} title="Print Barcode Labels" size="sm">
        {labelProduct && (
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>{labelProduct.name}</strong><br />
              Barcode: <span className="font-mono">{labelProduct.barcode}</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Format</label>
                <select
                  value={labelFormat}
                  onChange={e => setLabelFormat(e.target.value as typeof labelFormat)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="A4">A4 Sheet</option>
                  <option value="thermal">Thermal Roll</option>
                </select>
              </div>
              <Input label="Qty" type="number" min="1" max="200"
                value={labelQty} onChange={e => setLabelQty(parseInt(e.target.value) || 1)} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" fullWidth onClick={() => setLabelProduct(null)}>Cancel</Button>
              <Button fullWidth onClick={handlePrintLabels} icon={<Printer className="w-4 h-4" />}>Print Labels</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Hidden label sheet for printing */}
      <div className="hidden">
        <div ref={labelSheetRef} id="barcode-label-sheet">
          {labelProduct && activeShop && (
            <BarcodeLabelSheet
              product={labelProduct}
              format={labelFormat}
              quantity={labelQty}
              shopName={activeShop.name}
            />
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Product"
        message="Are you sure you want to delete this product? This action cannot be undone."
        confirmLabel="Delete"
        danger={true}
      />

    </div>
  )

}