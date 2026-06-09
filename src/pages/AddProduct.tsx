import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useShopStore } from '../store/shopStore'
import { products as productsDb, shops as shopsDb } from '../lib/database'
import { Button, Input, Select, Textarea, Card, Modal } from '../components/ui'
import { Save, Barcode, Download, Printer, RefreshCw, Package, Layers, Search, X, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import JsBarcode from 'jsbarcode'
import jsPDF from 'jspdf'
import type { Product, Gender } from '../types'

const CATEGORIES = ['Shirt', 'Pant', 'Saree', 'Kurti', 'Lehenga', 'Suit', 'Dress', 'Dupatta', 'Innerwear', 'Kids Wear', 'Accessories', 'Other']
const GENDERS: { value: Gender; label: string }[] = [
  { value: '', label: 'Select Gender' },
  { value: 'Men', label: 'Men' },
  { value: 'Women', label: 'Women' },
  { value: 'Kids', label: 'Kids' },
  { value: 'Unisex', label: 'Unisex' },
]

const defaultForm = {
  name: '', category: '', sub_category: '', brand: '', size: '', color: '',
  gender: '' as Gender, fabric: '',
  purchase_price: '', selling_price: '', mrp: '', discount_pct: '0',
  gst_rate: '0', hsn_code: '', stock_quantity: '1', low_stock_limit: '5',
  supplier_name: '', image_url: '', notes: '',
}

export const AddProduct: React.FC = () => {
  const { activeShop } = useShopStore()
  const [form, setForm] = useState(defaultForm)
  const [barcode, setBarcode] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedProduct, setSavedProduct] = useState<Product | null>(null)
  const [showBarcodeModal, setShowBarcodeModal] = useState(false)
  const [barcodeCount, setBarcodeCount] = useState(1)
  const barcodeRef = useRef<SVGSVGElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)

  // ─── Variant Matrix ──────────────────────────────────────────
  const [parentProductId, setParentProductId] = useState<string | null>(null)
  const [parentProduct, setParentProduct] = useState<Product | null>(null)
  const [variantGroup, setVariantGroup] = useState<Product[]>([])
  const [variantSearch, setVariantSearch] = useState('')
  const [variantSearchResults, setVariantSearchResults] = useState<Product[]>([])
  const [variantSearching, setVariantSearching] = useState(false)

  const searchVariantParent = useCallback(async (q: string) => {
    if (!activeShop || q.length < 2) { setVariantSearchResults([]); return }
    setVariantSearching(true)
    try {
      const { data } = await productsDb.list(activeShop.id, { search: q, limit: 8 })
      // Only show products that could be parents (no parent themselves, or are a parent)
      setVariantSearchResults(data)
    } finally {
      setVariantSearching(false)
    }
  }, [activeShop?.id])

  useEffect(() => {
    const timer = setTimeout(() => searchVariantParent(variantSearch), 300)
    return () => clearTimeout(timer)
  }, [variantSearch, searchVariantParent])

  const loadVariantGroup = useCallback(async (pid: string) => {
    if (!activeShop) return
    const { data } = await productsDb.list(activeShop.id, { limit: 50 })
    setVariantGroup(data.filter(p => p.id === pid || p.parent_product_id === pid))
  }, [activeShop?.id])

  const selectParent = (p: Product) => {
    setParentProductId(p.id)
    setParentProduct(p)
    setVariantSearch('')
    setVariantSearchResults([])
    loadVariantGroup(p.id)
    // Pre-fill name/category/brand/price from parent
    setForm(s => ({
      ...s,
      name: p.name,
      category: p.category || s.category,
      brand: p.brand || s.brand,
      purchase_price: String(p.purchase_price || s.purchase_price),
      selling_price: String(p.selling_price || s.selling_price),
      mrp: String(p.mrp || s.mrp),
      gst_rate: String(p.gst_rate ?? s.gst_rate),
      supplier_name: p.supplier_name || s.supplier_name,
    }))
  }

  const clearParent = () => {
    setParentProductId(null)
    setParentProduct(null)
    setVariantGroup([])
  }

  // Generate barcode on mount (fetch next)
  useEffect(() => {
    if (activeShop) generateNewBarcode()
  }, [activeShop?.id])

  const generateNewBarcode = async () => {
    if (!activeShop) return
    try {
      const bc = await shopsDb.getNextBarcode(activeShop.id)
      setBarcode(bc)
    } catch (e) {
      console.error(e)
    }
  }

  // Render barcode SVG whenever barcode changes
  useEffect(() => {
    if (barcode && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, barcode, {
          format: 'CODE128',
          width: 2,
          height: 50,
          displayValue: true,
          fontSize: 12,
          margin: 4,
        })
      } catch {}
    }
  }, [barcode])

  const f = (key: keyof typeof defaultForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(s => ({ ...s, [key]: e.target.value }))

  const handleSave = async () => {
    if (!activeShop) return
    if (!form.name) { toast.error('Product name is required'); return }
    if (!form.selling_price) { toast.error('Selling price is required'); return }

    setSaving(true)
    try {
      const product = await productsDb.create({
        shop_id: activeShop.id,
        barcode,
        name: form.name,
        category: form.category || null,
        sub_category: form.sub_category || null,
        brand: form.brand || null,
        size: form.size || null,
        color: form.color || null,
        gender: form.gender,
        fabric: form.fabric || null,
        purchase_price: parseFloat(form.purchase_price) || 0,
        selling_price: parseFloat(form.selling_price) || 0,
        mrp: parseFloat(form.mrp) || parseFloat(form.selling_price) || 0,
        discount_pct: parseFloat(form.discount_pct) || 0,
        gst_rate: parseFloat(form.gst_rate) || 0,
        hsn_code: form.hsn_code || null,
        stock_quantity: parseInt(form.stock_quantity) || 0,
        low_stock_limit: parseInt(form.low_stock_limit) || 5,
        supplier_id: null,
        supplier_name: form.supplier_name || null,
        image_url: form.image_url || null,
        notes: form.notes || null,
        is_active: true,
        parent_product_id: parentProductId || null,
      })

      setSavedProduct(product)
      toast.success(`Product "${product.name}" added with barcode ${barcode}!`)
      setShowBarcodeModal(true)
      setForm(defaultForm)
      await generateNewBarcode()
      // Refresh variant group after save
      if (parentProductId) {
        loadVariantGroup(parentProductId)
      } else if (product.id) {
        // This new product becomes a potential parent — keep it selected
        setVariantGroup([product])
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  const downloadBarcodeImage = () => {
    if (!barcodeRef.current) return
    const svgData = new XMLSerializer().serializeToString(barcodeRef.current)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx?.drawImage(img, 0, 0)
      const a = document.createElement('a')
      a.download = `barcode-${barcode}.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
  }

  const downloadBarcodesPDF = () => {
    if (!barcodeRef.current || !savedProduct) return
    // Convert SVG → canvas → PNG first (jsPDF SVG support is unreliable cross-browser)
    const svgData = new XMLSerializer().serializeToString(barcodeRef.current)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width || 300
      canvas.height = img.height || 100
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      const pngData = canvas.toDataURL('image/png')

      const pdf = new jsPDF('p', 'mm', 'a4')
      const cols = 4
      const labelW = 45
      const labelH = 30
      const marginX = 10
      const marginY = 10
      let x = marginX, y = marginY

      for (let i = 0; i < barcodeCount; i++) {
        if (i > 0 && i % cols === 0) { y += labelH + 4; x = marginX }
        pdf.setDrawColor(180)
        pdf.rect(x, y, labelW, labelH)
        pdf.setFontSize(6)
        pdf.text(activeShop?.name || '', x + labelW / 2, y + 4, { align: 'center' })
        pdf.setFontSize(7)
        pdf.text(savedProduct!.name.slice(0, 20), x + labelW / 2, y + 8, { align: 'center' })
        pdf.text(`₹${savedProduct!.selling_price}`, x + labelW / 2, y + 12, { align: 'center' })
        if (savedProduct!.size) pdf.text(`Size: ${savedProduct!.size}`, x + labelW / 2, y + 16, { align: 'center' })
        pdf.addImage(pngData, 'PNG', x + 2, y + 18, labelW - 4, 10)
        x += labelW + 4
      }

      pdf.save(`barcodes-${barcode}.pdf`)
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Add Product / Barcode Generator</h2>
          <p className="text-sm text-gray-500 mt-0.5">{activeShop?.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Form */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Package className="w-4 h-4" /> Product Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input label="Product Name *" value={form.name} onChange={f('name')} placeholder="e.g. Cotton Printed Shirt" />
              </div>
              <Select label="Category" value={form.category} onChange={f('category') as React.ChangeEventHandler<HTMLSelectElement>}
                options={[{ value: '', label: 'Select Category' }, ...CATEGORIES.map(c => ({ value: c, label: c }))]} />
              <Input label="Sub Category" value={form.sub_category} onChange={f('sub_category')} placeholder="e.g. Casual, Formal" />
              <Input label="Brand" value={form.brand} onChange={f('brand')} placeholder="e.g. Raymond" />
              <Select label="Gender" value={form.gender} onChange={f('gender') as React.ChangeEventHandler<HTMLSelectElement>} options={GENDERS as { value: string; label: string }[]} />
              <Input label="Size" value={form.size} onChange={f('size')} placeholder="e.g. M, L, XL, 38, Free" />
              <Input label="Color" value={form.color} onChange={f('color')} placeholder="e.g. Red, Navy Blue" />
              <Input label="Fabric / Material" value={form.fabric} onChange={f('fabric')} placeholder="e.g. Cotton, Polyester" />
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">💰 Pricing & GST</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Input label="Purchase Price (₹)" type="number" min="0" value={form.purchase_price} onChange={f('purchase_price')} placeholder="0" />
              <Input label="Selling Price (₹) *" type="number" min="0" value={form.selling_price} onChange={f('selling_price')} placeholder="0" />
              <Input label="MRP (₹)" type="number" min="0" value={form.mrp} onChange={f('mrp')} placeholder="0" />
              <Input label="Discount (%)" type="number" min="0" max="100" value={form.discount_pct} onChange={f('discount_pct')} />
              <Input label="GST Rate (%)" type="number" min="0" max="28" value={form.gst_rate} onChange={f('gst_rate')} hint="0, 5, 12, 18, 28" />
              <Input label="HSN Code" value={form.hsn_code} onChange={f('hsn_code')} placeholder="Optional" />
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">📦 Stock & Supplier</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Input label="Opening Stock" type="number" min="0" value={form.stock_quantity} onChange={f('stock_quantity')} />
              <Input label="Low Stock Alert" type="number" min="0" value={form.low_stock_limit} onChange={f('low_stock_limit')} />
              <Input label="Supplier Name" value={form.supplier_name} onChange={f('supplier_name')} placeholder="Optional" />
              <div className="md:col-span-3">
                <Input label="Product Image URL" value={form.image_url} onChange={f('image_url')} placeholder="https://..." />
              </div>
              <div className="md:col-span-3">
                <Textarea label="Notes" rows={2} value={form.notes} onChange={f('notes')} placeholder="Additional notes..." />
              </div>
            </div>
          </Card>

          <Button onClick={handleSave} loading={saving} fullWidth size="lg" icon={<Save className="w-4 h-4" />}>
            Save Product & Generate Barcode
          </Button>
        </div>

        {/* Barcode Preview Panel */}
        <div className="space-y-4">
          <Card>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Barcode className="w-4 h-4" /> Barcode Preview
            </h3>
            <div className="bg-white border-2 border-gray-200 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">{activeShop?.name}</p>
              <svg ref={barcodeRef} />
            </div>
            <div className="mt-3 space-y-2">
              <p className="text-sm font-mono text-center text-gray-700 dark:text-gray-300">{barcode}</p>
              <button
                onClick={generateNewBarcode}
                className="w-full flex items-center justify-center gap-2 py-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Regenerate
              </button>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">🖨️ Print Options</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Number of copies</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={barcodeCount}
                  onChange={e => setBarcodeCount(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <Button onClick={downloadBarcodeImage} variant="secondary" fullWidth size="sm" icon={<Download className="w-4 h-4" />}>
                Download PNG
              </Button>
              <Button onClick={downloadBarcodesPDF} variant="secondary" fullWidth size="sm" icon={<Download className="w-4 h-4" />}>
                Download A4 PDF ({barcodeCount} labels)
              </Button>
            </div>
          </Card>

          {/* Variant Matrix */}
          <Card>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600" /> Variant Group
            </h3>

            {parentProduct ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-purple-800 dark:text-purple-200">{parentProduct.name}</p>
                    <p className="text-xs text-purple-600 dark:text-purple-400">Parent product</p>
                  </div>
                  <button onClick={clearParent} className="text-purple-400 hover:text-purple-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {variantGroup.length > 0 && (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    <p className="text-xs text-gray-500 font-medium">Existing variants ({variantGroup.length})</p>
                    {variantGroup.map(v => (
                      <div key={v.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-gray-50 dark:bg-gray-800">
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">{v.size || '\u2014'} / {v.color || '\u2014'}</span>
                          <span className="ml-2 text-gray-400">\u20b9{v.selling_price}</span>
                        </div>
                        <span className={`font-mono ${v.stock_quantity <= 0 ? 'text-red-500' : 'text-gray-500'}`}>
                          {v.stock_quantity} pcs
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-400">Fill in size/color for this new variant, then save.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 mb-2">Link this product as a variant of an existing product (e.g. same shirt in different sizes).</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    value={variantSearch}
                    onChange={e => setVariantSearch(e.target.value)}
                    placeholder="Search parent product\u2026"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                {variantSearching && <p className="text-xs text-gray-400 text-center py-1">Searching\u2026</p>}
                {variantSearchResults.length > 0 && (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700 max-h-40 overflow-y-auto">
                    {variantSearchResults.map(p => (
                      <button key={p.id} onClick={() => selectParent(p)}
                        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors">
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.category} \u00b7 {p.barcode}</p>
                        </div>
                        <Plus className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Tips */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
            <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">\ud83d\udca1 Tips</h4>
            <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
              <li>\u2022 Barcode prefix: <strong>{activeShop?.barcode_prefix}</strong></li>
              <li>\u2022 Format: CODE128 (universal)</li>
              <li>\u2022 Scan directly in POS</li>
              <li>\u2022 Print on thermal or A4 labels</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Barcode Success Modal */}
      <Modal isOpen={showBarcodeModal} onClose={() => setShowBarcodeModal(false)} title="Product Added!" size="sm">
        <div className="p-6 text-center space-y-4">
          <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
            <Barcode className="w-7 h-7 text-green-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100">{savedProduct?.name}</p>
            <p className="text-sm text-gray-500 font-mono mt-1">{savedProduct?.barcode}</p>
            <p className="text-sm text-gray-500 mt-1">\u20b9{savedProduct?.selling_price} \u2022 Stock: {savedProduct?.stock_quantity}</p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button icon={<Download className="w-4 h-4" />} variant="secondary" fullWidth size="sm" onClick={() => { downloadBarcodeImage(); setShowBarcodeModal(false) }}>
                Download
              </Button>
              <Button fullWidth size="sm" onClick={() => setShowBarcodeModal(false)}>
                Add Another
              </Button>
            </div>
            {parentProduct && (
              <Button variant="outline" fullWidth size="sm" icon={<Layers className="w-3.5 h-3.5" />}
                onClick={() => {
                  setShowBarcodeModal(false)
                  setForm(s => ({ ...s, size: '', color: '', stock_quantity: '1' }))
                }}>
                Add Another Variant ({parentProduct.name})
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
