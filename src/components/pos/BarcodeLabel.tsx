import React, { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import type { Product } from '../../types'

export type LabelFormat = 'A4' | 'THERMAL'

interface BarcodeLabelProps {
  product: Product
  shopName: string
  format: LabelFormat
}

/** Renders a single barcode label. Used both in preview and in print layout. */
export const BarcodeLabel: React.FC<BarcodeLabelProps> = ({ product, shopName, format }) => {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return
    try {
      JsBarcode(svgRef.current, product.barcode, {
        format: 'CODE128',
        width: format === 'THERMAL' ? 1.5 : 1.2,
        height: format === 'THERMAL' ? 28 : 24,
        displayValue: false,
        margin: 0,
        background: '#ffffff',
        lineColor: '#000000',
      })
    } catch { /* ignore invalid barcode */ }
  }, [product.barcode, format])

  const isA4 = format === 'A4'
  const dateAdded = product.created_at
    ? new Date(product.created_at).toLocaleDateString('en-IN')
    : ''

  return (
    <div
      className="barcode-label"
      style={{
        width: isA4 ? '62mm' : '56mm',
        height: isA4 ? '29mm' : '30mm',
        padding: isA4 ? '2mm 3mm' : '2mm 2mm',
        border: '0.5pt solid #ccc',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: 'Arial, sans-serif',
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      {/* Shop name */}
      <div style={{ fontSize: isA4 ? '6pt' : '7pt', fontWeight: 'bold', textAlign: 'center', letterSpacing: '0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {shopName}
      </div>

      {/* Product name */}
      <div style={{ fontSize: isA4 ? '6.5pt' : '7pt', textAlign: 'center', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.2' }}>
        {product.name}
        {(product.size || product.color) && (
          <span style={{ fontSize: '5.5pt', color: '#555' }}>
            {' '}({[product.size, product.color].filter(Boolean).join('/')})
          </span>
        )}
      </div>

      {/* Barcode */}
      <div style={{ textAlign: 'center', lineHeight: 0 }}>
        <svg ref={svgRef} style={{ maxWidth: '100%' }} />
      </div>

      {/* Barcode number + price + date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '6pt', fontFamily: 'monospace', letterSpacing: '-0.5px' }}>
          {product.barcode}
        </span>
        <span style={{ fontSize: '7.5pt', fontWeight: 'bold' }}>
          ₹{product.selling_price.toFixed(2)}
        </span>
        {dateAdded && (
          <span style={{ fontSize: '5.5pt', color: '#555' }}>{dateAdded}</span>
        )}
      </div>
    </div>
  )
}

interface BarcodeLabelSheetProps {
  product: Product
  shopName: string
  format: LabelFormat
  quantity: number
}

/** Renders N copies of the label for print — grid for A4, stack for thermal. */
export const BarcodeLabelSheet = React.forwardRef<HTMLDivElement, BarcodeLabelSheetProps>(
  ({ product, shopName, format, quantity }, ref) => {
    const isA4 = format === 'A4'
    const labels = Array.from({ length: quantity })

    return (
      <div
        ref={ref}
        id="barcode-label-sheet"
        style={{
          width: isA4 ? '210mm' : '58mm',
          padding: isA4 ? '5mm' : '2mm',
          boxSizing: 'border-box',
          display: isA4 ? 'grid' : 'flex',
          gridTemplateColumns: isA4 ? 'repeat(3, 1fr)' : undefined,
          gap: isA4 ? '1mm' : '2mm',
          flexDirection: isA4 ? undefined : 'column',
          background: '#fff',
        }}
      >
        {labels.map((_, i) => (
          <BarcodeLabel key={i} product={product} shopName={shopName} format={format} />
        ))}
      </div>
    )
  }
)
BarcodeLabelSheet.displayName = 'BarcodeLabelSheet'
