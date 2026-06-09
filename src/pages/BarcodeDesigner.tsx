import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useReactToPrint } from 'react-to-print'
import { useShopStore } from '../store/shopStore'
import { products as productsDb, suppliersDb, getErrorMessage } from '../lib/database'
import { Button, Card, Input, Spinner, EmptyState } from '../components/ui'
import {
  Barcode, Search, Plus, Trash2, Printer, Download,
  RefreshCw, Settings2, Package, ChevronDown, ChevronUp, X
} from 'lucide-react'
import JsBarcode from 'jsbarcode'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import toast from 'react-hot-toast'
import type { Product } from '../types'

// ── Template presets ─────────────────────────────────────────────────────────
export type TemplateId = 'A4_24' | 'A4_40' | 'A4_65' | 'T_40x20' | 'T_50x25' | 'T_60x40' | 'CUSTOM'

interface LabelTemplate {
  id: TemplateId
  label: string
  type: 'A4' | 'THERMAL'
  cols: number
  labelW: number   // mm
  labelH: number
  pageW: number
  marginTop: number
  marginLeft: number
  gapX: number
  gapY: number
}

const TEMPLATES: LabelTemplate[] = [
  { id: 'A4_24',  label: 'A4 — 24 labels (3×8)',  type: 'A4',     cols: 3, labelW: 66, labelH: 36, pageW: 210, marginTop: 10, marginLeft: 7,  gapX: 3, gapY: 2 },
  { id: 'A4_40',  label: 'A4 — 40 labels (4×10)', type: 'A4',     cols: 4, labelW: 48, labelH: 25, pageW: 210, marginTop: 12, marginLeft: 8,  gapX: 2, gapY: 2 },
  { id: 'A4_65',  label: 'A4 — 65 labels (5×13)', type: 'A4',     cols: 5, labelW: 38, labelH: 21, pageW: 210, marginTop: 12, marginLeft: 4,  gapX: 2, gapY: 0 },
  { id: 'T_40x20',label: 'Thermal 40×20 mm',      type: 'THERMAL', cols: 1, labelW: 40, labelH: 20, pageW: 40,  marginTop: 2,  marginLeft: 2,  gapX: 0, gapY: 2 },
  { id: 'T_50x25',label: 'Thermal 50×25 mm',      type: 'THERMAL', cols: 1, labelW: 50, labelH: 25, pageW: 50,  marginTop: 2,  marginLeft: 2,  gapX: 0, gapY: 2 },
  { id: 'T_60x40',label: 'Thermal 60×40 mm',      type: 'THERMAL', cols: 1, labelW: 60, labelH: 40, pageW: 60,  marginTop: 2,  marginLeft: 2,  gapX: 0, gapY: 2 },
  { id: 'CUSTOM', label: 'Custom Size',            type: 'THERMAL', cols: 1, labelW: 50, labelH: 30, pageW: 50,  marginTop: 2,  marginLeft: 2,  gapX: 0, gapY: 2 },
]

// ── Single Designer Label ─────────────────────────────────────────────────────
interface DesignerLabelProps {
  product: Product
  shopName: string
  tpl: LabelTemplate
  showShop: boolean
  showDate: boolean
  showPrice: boolean
  showVariant: boolean
}

const DesignerLabel: React.FC<DesignerLabelProps> = ({
  product, shopName, tpl, showShop, showDate, showPrice, showVariant
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const w = tpl.labelW, h = tpl.labelH
  const small = w < 45 || h < 22
  const dateAdded = product.created_at ? new Date(product.created_at).toLocaleDateString('en-IN') : ''

  useEffect(() => {
    if (!svgRef.current) return
    try {
      JsBarcode(svgRef.current, product.barcode || '0000000000', {
        format: 'CODE128', width: small ? 1.0 : 1.2,
        height: small ? 18 : h < 30 ? 22 : 30,
        displayValue: false, margin: 0,
        background: '#ffffff', lineColor: '#000000',
      })
    } catch { /* ignore */ }
  }, [product.barcode, h, small])

  return (
    <div className="barcode-label" style={{
      width: w + 'mm', height: h + 'mm', padding: '1.5mm 2mm', border: '0.5pt solid #ccc',
      boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
      justifyContent: 'space-between', fontFamily: 'Arial, sans-serif',
      overflow: 'hidden', background: '#fff', pageBreakInside: 'avoid',
    }}>
      {showShop && (
        <div style={{ fontSize: small ? '5pt' : '6pt', fontWeight: 'bold', textAlign: 'center', letterSpacing: '0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {shopName}
        </div>
      )}
      <div style={{ fontSize: small ? '5.5pt' : '6.5pt', textAlign: 'center', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.2', flex: '0 0 auto' }}>
        {product.name}
        {showVariant && (product.size || product.color) && (
          <span style={{ fontSize: small ? '4.5pt' : '5.5pt', color: '#555' }}>
            {' '}({[product.size, product.color].filter(Boolean).join('/')})
          </span>
        )}
      </div>
      <div style={{ textAlign: 'center', lineHeight: 0, flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg ref={svgRef} style={{ maxWidth: '100%', maxHeight: '100%' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: '0 0 auto' }}>
        <span style={{ fontSize: small ? '5pt' : '5.5pt', fontFamily: 'monospace', letterSpacing: '-0.5px' }}>
          {product.barcode}
        </span>
        {showPrice && (
          <span style={{ fontSize: small ? '6.5pt' : '7.5pt', fontWeight: 'bold' }}>
            ₹{product.selling_price.toFixed(2)}
          </span>
        )}
        {showDate && dateAdded && (
          <span style={{ fontSize: '4.5pt', color: '#555' }}>{dateAdded}</span>
        )}
      </div>
    </div>
  )
}

// ── Print Sheet ───────────────────────────────────────────────────────────────
interface PrintSheetProps {
  entries: { product: Product; qty: number }[]
  shopName: string
  tpl: LabelTemplate
  showShop: boolean
  showDate: boolean
  showPrice: boolean
  showVariant: boolean
}

const PrintSheet = React.forwardRef<HTMLDivElement, PrintSheetProps>(
  ({ entries, shopName, tpl, showShop, showDate, showPrice, showVariant }, ref) => {
    const isA4 = tpl.type === 'A4'
    const allLabels: Product[] = []
    entries.forEach(e => { for (let i = 0; i < e.qty; i++) allLabels.push(e.product) })

    return (
      <div ref={ref} style={{
        width: tpl.pageW + 'mm',
        padding: `${tpl.marginTop}mm ${tpl.marginLeft}mm`,
        boxSizing: 'border-box',
        display: isA4 ? 'grid' : 'flex',
        gridTemplateColumns: isA4 ? `repeat(${tpl.cols}, 1fr)` : undefined,
        gap: `${tpl.gapY}mm ${tpl.gapX}mm`,
        flexDirection: isA4 ? undefined : 'column',
        background: '#fff',
      }}>
        {allLabels.map((p, i) => (
          <DesignerLabel key={i} product={p} shopName={shopName} tpl={tpl}
            showShop={showShop} showDate={showDate} showPrice={showPrice} showVariant={showVariant} />
        ))}
      </div>
    )
  }
)
PrintSheet.displayName = 'PrintSheet'

// ── Main page ─────────────────────────────────────────────────────────────────
export const BarcodeDesigner: React.FC = () => {
  const { activeShop } = useShopStore()
  const printRef = useRef<HTMLDivElement>(null)

  const [templateId, setTemplateId] = useState<TemplateId>('A4_24')
  const [customTpl, setCustomTpl] = useState<LabelTemplate>(TEMPLATES[6])

  const tpl: LabelTemplate = templateId === 'CUSTOM'
    ? customTpl
    : TEMPLATES.find(t => t.id === templateId)!

  // Label field toggles
  const [showShop, setShowShop]       = useState(true)
  const [showDate, setShowDate]       = useState(true)
  const [showPrice, setShowPrice]     = useState(true)
  const [showVariant, setShowVariant] = useState(true)

  // Product list
  const [entries, setEntries] = useState<{ product: Product; qty: number }[]>([])

  // Product search
  const [searchMode, setSearchMode] = useState<'search' | 'category' | 'supplier'>('search')
  const [searchQ, setSearchQ]       = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [suppliers, setSuppliers]   = useState<string[]>([])
  const [selectedCat, setSelectedCat] = useState('')
  const [selectedSup, setSelectedSup] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (activeShop) {
      productsDb.getCategories(activeShop.id).then(setCategories)
      suppliersDb.list(activeShop.id).then(sups => setSuppliers(sups.map(s => s.name).filter(Boolean)))
    }
  }, [activeShop?.id])

  useEffect(() => {
    if (!searchQ.trim() || !activeShop) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const { data } = await productsDb.list(activeShop.id, { search: searchQ, limit: 8 })
        setSearchResults(data)
      } finally { setSearchLoading(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [searchQ, activeShop?.id])

  const addEntry = (p: Product) => {
    setEntries(prev => {
      const existing = prev.find(e => e.product.id === p.id)
      if (existing) return prev.map(e => e.product.id === p.id ? { ...e, qty: e.qty + 1 } : e)
      return [...prev, { product: p, qty: 1 }]
    })
    setSearchQ('')
    setSearchResults([])
  }

  const loadByCategory = useCallback(async () => {
    if (!activeShop || !selectedCat) return
    setBulkLoading(true)
    try {
      const { data } = await productsDb.list(activeShop.id, { category: selectedCat, limit: 200 })
      const newEntries = data.filter(p => !entries.find(e => e.product.id === p.id))
        .map(p => ({ product: p, qty: 1 }))
      setEntries(prev => [...prev, ...newEntries])
      toast.success(`Added ${newEntries.length} products`)
    } catch (e) { toast.error(getErrorMessage(e)) }
    finally { setBulkLoading(false) }
  }, [activeShop?.id, selectedCat, entries])

  const loadBySupplier = useCallback(async () => {
    if (!activeShop || !selectedSup) return
    setBulkLoading(true)
    try {
      const { data } = await productsDb.list(activeShop.id, { search: selectedSup, limit: 200 })
      const filtered = data.filter(p => p.supplier_name === selectedSup)
      const newEntries = filtered.filter(p => !entries.find(e => e.product.id === p.id))
        .map(p => ({ product: p, qty: 1 }))
      setEntries(prev => [...prev, ...newEntries])
      toast.success(`Added ${newEntries.length} products`)
    } catch (e) { toast.error(getErrorMessage(e)) }
    finally { setBulkLoading(false) }
  }, [activeShop?.id, selectedSup, entries])

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: 'Barcode-Labels',
    pageStyle: `
      @page { size: ${tpl.type === 'A4' ? 'A4 portrait' : tpl.pageW + 'mm auto'}; margin: 0; }
      @media print { body { margin: 0; } .barcode-label { break-inside: avoid; } }
    `,
  })

  const handleExportPDF = async () => {
    if (!printRef.current || entries.length === 0) return
    setExporting(true)
    try {
      const canvas = await html2canvas(printRef.current, { scale: 3, useCORS: true, backgroundColor: '#fff' })
      const imgData = canvas.toDataURL('image/png')
      const isA4 = tpl.type === 'A4'
      const pdfW = isA4 ? 210 : tpl.pageW
      const pdfH = isA4 ? 297 : (canvas.height * (tpl.pageW / canvas.width))
      const pdf = new jsPDF({ format: isA4 ? 'a4' : [pdfW, pdfH], unit: 'mm', orientation: 'portrait' })
      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, isA4 ? 297 : pdfH)
      pdf.save(`barcode-labels-${templateId.toLowerCase()}.pdf`)
      toast.success('PDF exported')
    } catch (e) {
      toast.error('PDF export failed')
    } finally {
      setExporting(false)
    }
  }

  const totalLabels = entries.reduce((s, e) => s + e.qty, 0)
  const previewEntry = entries[0] || null

  if (!activeShop) return null

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Barcode className="w-5 h-5 text-blue-600" /> Barcode Designer
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Design and print labels for any format</p>
        </div>
        <div className="flex gap-2">
          {entries.length > 0 && (
            <>
              <Button variant="outline" size="sm" icon={<Download className="w-4 h-4" />}
                onClick={handleExportPDF} loading={exporting}>
                Export PDF
              </Button>
              <Button variant="primary" size="sm" icon={<Printer className="w-4 h-4" />}
                onClick={handlePrint}>
                Print ({totalLabels})
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Left Panel ── */}
        <div className="lg:col-span-1 space-y-4">

          {/* Template Selection */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Template</h3>
            <div className="space-y-1">
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => setTemplateId(t.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    templateId === t.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {templateId === 'CUSTOM' && (
              <div className="mt-3 grid grid-cols-2 gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div>
                  <label className="text-xs text-gray-500 font-medium">Width (mm)</label>
                  <input type="number" min="20" max="210" value={customTpl.labelW}
                    onChange={e => setCustomTpl(p => ({ ...p, labelW: +e.target.value, pageW: +e.target.value }))}
                    className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Height (mm)</label>
                  <input type="number" min="15" max="150" value={customTpl.labelH}
                    onChange={e => setCustomTpl(p => ({ ...p, labelH: +e.target.value }))}
                    className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Columns</label>
                  <input type="number" min="1" max="5" value={customTpl.cols}
                    onChange={e => setCustomTpl(p => ({ ...p, cols: +e.target.value }))}
                    className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Gap (mm)</label>
                  <input type="number" min="0" max="10" value={customTpl.gapX}
                    onChange={e => setCustomTpl(p => ({ ...p, gapX: +e.target.value, gapY: +e.target.value }))}
                    className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Margin Top (mm)</label>
                  <input type="number" min="0" max="30" value={customTpl.marginTop}
                    onChange={e => setCustomTpl(p => ({ ...p, marginTop: +e.target.value }))}
                    className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Margin Left (mm)</label>
                  <input type="number" min="0" max="30" value={customTpl.marginLeft}
                    onChange={e => setCustomTpl(p => ({ ...p, marginLeft: +e.target.value }))}
                    className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            )}
          </Card>

          {/* Label Fields */}
          <Card className="p-4">
            <button className="w-full flex items-center justify-between text-sm font-semibold text-gray-800 dark:text-gray-200"
              onClick={() => setShowSettings(p => !p)}>
              <span className="flex items-center gap-2"><Settings2 className="w-4 h-4" /> Label Fields</span>
              {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showSettings && (
              <div className="mt-3 space-y-2">
                {[
                  ['Shop Name', showShop, setShowShop],
                  ['Selling Price', showPrice, setShowPrice],
                  ['Variant (Size/Color)', showVariant, setShowVariant],
                  ['Date Added', showDate, setShowDate],
                ].map(([label, val, setter]) => (
                  <label key={label as string} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{label as string}</span>
                    <button
                      onClick={() => (setter as React.Dispatch<React.SetStateAction<boolean>>)(p => !p)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${val ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${val ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                ))}
              </div>
            )}
          </Card>

          {/* Product Selection */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Add Products</h3>

            {/* Mode tabs */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-0.5 rounded-lg mb-3">
              {(['search', 'category', 'supplier'] as const).map(m => (
                <button key={m} onClick={() => setSearchMode(m)}
                  className={`flex-1 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                    searchMode === m ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                  {m}
                </button>
              ))}
            </div>

            {searchMode === 'search' && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  placeholder="Search products…"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {searchLoading && <Spinner size="sm" className="absolute right-2.5 top-1/2 -translate-y-1/2" />}
                {searchResults.length > 0 && (
                  <div className="absolute z-20 top-full mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                    {searchResults.map(p => (
                      <button key={p.id} onClick={() => addEntry(p)}
                        className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700">
                        <Plus className="w-3.5 h-3.5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.barcode} · ₹{p.selling_price}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {searchMode === 'category' && (
              <div className="space-y-2">
                <select value={selectedCat} onChange={e => setSelectedCat(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select category…</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <Button fullWidth variant="outline" size="sm" onClick={loadByCategory}
                  loading={bulkLoading} disabled={!selectedCat}
                  icon={<Plus className="w-3.5 h-3.5" />}>
                  Add All in Category
                </Button>
              </div>
            )}

            {searchMode === 'supplier' && (
              <div className="space-y-2">
                <select value={selectedSup} onChange={e => setSelectedSup(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select supplier…</option>
                  {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <Button fullWidth variant="outline" size="sm" onClick={loadBySupplier}
                  loading={bulkLoading} disabled={!selectedSup}
                  icon={<Plus className="w-3.5 h-3.5" />}>
                  Add All by Supplier
                </Button>
              </div>
            )}
          </Card>

          {/* Product List */}
          {entries.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Products ({entries.length}) · {totalLabels} labels
                </h3>
                <button onClick={() => setEntries([])}
                  className="text-xs text-red-500 hover:text-red-700">Clear all</button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {entries.map((e, i) => (
                  <div key={e.product.id} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{e.product.name}</p>
                      <p className="text-xs text-gray-400">{e.product.barcode}</p>
                    </div>
                    <input type="number" min="1" max="100" value={e.qty}
                      onChange={ev => setEntries(prev => prev.map((x, j) => j === i ? { ...x, qty: Math.max(1, +ev.target.value) } : x))}
                      className="w-14 text-center px-1 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button onClick={() => setEntries(prev => prev.filter((_, j) => j !== i))}
                      className="text-gray-400 hover:text-red-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* ── Right Panel — Preview ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Single label preview */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
              Label Preview — {tpl.labelW}×{tpl.labelH} mm
            </h3>
            <div className="flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
              {previewEntry ? (
                <div style={{ transform: 'scale(3)', transformOrigin: 'center center', margin: '40px auto' }}>
                  <DesignerLabel product={previewEntry.product} shopName={activeShop.name} tpl={tpl}
                    showShop={showShop} showDate={showDate} showPrice={showPrice} showVariant={showVariant} />
                </div>
              ) : (
                <EmptyState icon={<Package className="w-8 h-8 text-gray-400" />}
                  title="No products yet" description="Add products from the left panel to see preview" />
              )}
            </div>
          </Card>

          {/* Multi-label grid preview */}
          {entries.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Sheet Preview (first {Math.min(totalLabels, tpl.type === 'A4' ? 24 : 8)} labels)
                </h3>
                <span className="text-xs text-gray-500">{tpl.label}</span>
              </div>
              <div className="overflow-x-auto bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                <div style={{
                  display: tpl.type === 'A4' ? 'grid' : 'flex',
                  gridTemplateColumns: tpl.type === 'A4' ? `repeat(${tpl.cols}, max-content)` : undefined,
                  gap: `${tpl.gapY * 3}px ${tpl.gapX * 3}px`,
                  flexDirection: tpl.type === 'THERMAL' ? 'column' : undefined,
                  alignItems: tpl.type === 'THERMAL' ? 'flex-start' : undefined,
                }}>
                  {entries.flatMap(e => Array.from({ length: e.qty }, (_, i) => ({ ...e, _i: i })))
                    .slice(0, tpl.type === 'A4' ? 24 : 8)
                    .map((e, idx) => (
                      <div key={idx} style={{ transform: 'scale(1.5)', transformOrigin: 'top left', margin: `${tpl.labelH * 0.25}px ${tpl.labelW * 0.25}px` }}>
                        <DesignerLabel product={e.product} shopName={activeShop.name} tpl={tpl}
                          showShop={showShop} showDate={showDate} showPrice={showPrice} showVariant={showVariant} />
                      </div>
                    ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Hidden print sheet */}
      <div className="hidden">
        <PrintSheet ref={printRef} entries={entries} shopName={activeShop.name} tpl={tpl}
          showShop={showShop} showDate={showDate} showPrice={showPrice} showVariant={showVariant} />
      </div>
    </div>
  )
}
