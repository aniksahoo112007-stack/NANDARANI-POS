import React, { forwardRef } from 'react'
import { formatDate, formatDateTime, numberToWords } from '../../lib/utils'
import type { Bill, BillItem, Shop, ShopSettings } from '../../types'
import JsBarcode from 'jsbarcode'

interface ThermalBillProps {
  bill: Bill
  items: BillItem[]
  shop: Shop
  settings: ShopSettings
  upiQR?: string        // data URL of QR image to print
  upiPayLink?: string   // upi:// payment link for display
}

export const ThermalBill = forwardRef<HTMLDivElement, ThermalBillProps>(({ bill, items, shop, settings, upiQR, upiPayLink }, ref) => {
  const isGST = bill.bill_type === 'GST'

  // Generate barcode SVG for bill number
  const barcodeSVG = React.useMemo(() => {
    try {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      JsBarcode(svg, bill.bill_number, {
        format: 'CODE128', width: 1.2, height: 30, displayValue: false, margin: 0
      })
      return svg.outerHTML
    } catch { return '' }
  }, [bill.bill_number])

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const itemDiscount = items.reduce((s, i) => s + i.discount_amount, 0)
  const afterItemDisc = subtotal - itemDiscount
  const billDisc = bill.bill_discount || 0
  const gst = bill.gst_amount || 0
  const roundOff = bill.round_off || 0

  return (
    <div ref={ref} className="thermal-bill" id="thermal-bill-print">
      {/* Header */}
      <div className="center bold" style={{ fontSize: '14px', letterSpacing: '1px' }}>
        {shop.name}
      </div>
      {shop.address && <div className="center" style={{ fontSize: '10px' }}>{shop.address}{shop.pincode ? `, ${shop.pincode}` : ''}</div>}
      {shop.phone && <div className="center" style={{ fontSize: '10px' }}>Ph: {shop.phone} | WA: {shop.whatsapp}</div>}
      {isGST && shop.gst_number && <div className="center" style={{ fontSize: '10px' }}>GSTIN: {shop.gst_number}</div>}
      <div className="divider" />

      {/* Bill Info */}
      <table>
        <tbody>
          <tr>
            <td className="bold">Bill #{bill.bill_number}</td>
            <td style={{ textAlign: 'right' }}>{isGST ? 'GST Invoice' : 'Tax Invoice'}</td>
          </tr>
          <tr>
            <td>Date: {formatDateTime(bill.created_at)}</td>
            <td style={{ textAlign: 'right' }}>Biller: {bill.biller_name || 'Staff'}</td>
          </tr>
        </tbody>
      </table>
      <div className="divider" />

      {/* Customer Info */}
      {(bill.customer_name || bill.customer_phone) && (
        <>
          <div className="bold" style={{ fontSize: '10px' }}>Customer:</div>
          {bill.customer_name && <div>{bill.customer_name}</div>}
          {bill.customer_phone && <div>Ph: {bill.customer_phone}</div>}
          {bill.customer_address && <div>{bill.customer_address}</div>}
          {isGST && bill.customer_gst && <div>GSTIN: {bill.customer_gst}</div>}
          <div className="divider" />
        </>
      )}

      {/* Items Header */}
      <table>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', width: '40%' }}>Item</th>
            <th style={{ textAlign: 'center', width: '10%' }}>Qty</th>
            <th style={{ textAlign: 'right', width: '20%' }}>Rate</th>
            {itemDiscount > 0 && <th style={{ textAlign: 'right', width: '10%' }}>Disc</th>}
            <th style={{ textAlign: 'right', width: '20%' }}>Amt</th>
          </tr>
        </thead>
      </table>
      <div className="divider" />

      {/* Items */}
      <table>
        <tbody>
          {items.map((item, i) => (
            <React.Fragment key={i}>
              <tr>
                <td colSpan={5} style={{ fontWeight: 'bold', paddingTop: '2px' }}>
                  {item.product_name}
                </td>
              </tr>
              <tr>
                <td style={{ fontSize: '9px', color: '#666' }}>
                  {[item.barcode, item.size, item.color].filter(Boolean).join(' | ')}
                  {isGST && item.hsn_code && ` HSN:${item.hsn_code}`}
                </td>
                <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                <td style={{ textAlign: 'right' }}>₹{item.unit_price.toFixed(2)}</td>
                {itemDiscount > 0 && (
                  <td style={{ textAlign: 'right' }}>
                    {item.discount_pct > 0 ? `-${item.discount_pct}%` : ''}
                  </td>
                )}
                <td style={{ textAlign: 'right' }}>₹{item.total_amount.toFixed(2)}</td>
              </tr>
              {isGST && item.gst_rate > 0 && (
                <tr>
                  <td colSpan={5} style={{ fontSize: '9px', color: '#666', textAlign: 'right' }}>
                    GST @{item.gst_rate}%: ₹{item.gst_amount.toFixed(2)} (CGST: ₹{(item.gst_amount / 2).toFixed(2)} | SGST: ₹{(item.gst_amount / 2).toFixed(2)})
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <div className="divider" />

      {/* Totals */}
      <table>
        <tbody>
          <tr>
            <td>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</td>
            <td style={{ textAlign: 'right' }}>₹{subtotal.toFixed(2)}</td>
          </tr>
          {itemDiscount > 0 && (
            <tr>
              <td>Item Discount</td>
              <td style={{ textAlign: 'right', color: '#e53e3e' }}>-₹{itemDiscount.toFixed(2)}</td>
            </tr>
          )}
          {billDisc > 0 && (
            <tr>
              <td>Bill Discount</td>
              <td style={{ textAlign: 'right', color: '#e53e3e' }}>-₹{billDisc.toFixed(2)}</td>
            </tr>
          )}
          {isGST && gst > 0 && (
            <>
              <tr>
                <td>CGST</td>
                <td style={{ textAlign: 'right' }}>₹{(gst / 2).toFixed(2)}</td>
              </tr>
              <tr>
                <td>SGST</td>
                <td style={{ textAlign: 'right' }}>₹{(gst / 2).toFixed(2)}</td>
              </tr>
            </>
          )}
          {roundOff !== 0 && (
            <tr>
              <td>Round Off</td>
              <td style={{ textAlign: 'right' }}>{roundOff > 0 ? '+' : ''}₹{roundOff.toFixed(2)}</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="divider" />
      <table>
        <tbody>
          <tr>
            <td className="bold" style={{ fontSize: '13px' }}>GRAND TOTAL</td>
            <td className="bold" style={{ textAlign: 'right', fontSize: '13px' }}>₹{bill.grand_total.toFixed(2)}</td>
          </tr>
          <tr>
            <td style={{ fontSize: '9px', fontStyle: 'italic' }} colSpan={2}>
              {numberToWords(bill.grand_total)}
            </td>
          </tr>
        </tbody>
      </table>
      <div className="divider" />

      {/* Payment */}
      <table>
        <tbody>
          <tr>
            <td>Paid Amount</td>
            <td style={{ textAlign: 'right' }}>₹{bill.paid_amount.toFixed(2)}</td>
          </tr>
          {bill.due_amount > 0 && (
            <tr>
              <td className="bold">Due Amount</td>
              <td className="bold" style={{ textAlign: 'right', color: '#e53e3e' }}>₹{bill.due_amount.toFixed(2)}</td>
            </tr>
          )}
          {bill.paid_amount > bill.grand_total && (
            <tr>
              <td>Change Return</td>
              <td style={{ textAlign: 'right' }}>₹{(bill.paid_amount - bill.grand_total).toFixed(2)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Status Stamp */}
      <div style={{ textAlign: 'center', margin: '6px 0' }}>
        <span className="stamp" style={{
          color: bill.payment_status === 'PAID' ? '#38a169' : bill.payment_status === 'DUE' ? '#e53e3e' : '#d69e2e',
          borderColor: 'currentColor',
        }}>
          {bill.payment_status}
        </span>
      </div>

      <div className="divider" />

      {/* UPI QR Code — only printed when UPI payment */}
      {upiQR && (
        <>
          <div className="center bold" style={{ fontSize: '10px', marginBottom: '2px' }}>
            Scan & Pay via UPI
          </div>
          <div className="center">
            <img
              src={upiQR}
              alt="UPI QR"
              style={{ width: '100px', height: '100px', display: 'block', margin: '0 auto' }}
            />
          </div>
          {upiPayLink && (
            <div className="center" style={{ fontSize: '8px', marginTop: '2px', wordBreak: 'break-all' }}>
              {upiPayLink}
            </div>
          )}
          <div className="divider" />
        </>
      )}

      {/* Contact */}
      <div className="center" style={{ fontSize: '10px' }}>
        For queries: {shop.phone || '9933426708'}
      </div>
      <div className="center" style={{ fontSize: '10px' }}>
        WhatsApp: {shop.whatsapp || '6296240320'}
      </div>
      <div className="divider" />

      {/* Policy */}
      {settings?.return_policy && (
        <div style={{ fontSize: '9px', textAlign: 'center' }}>{settings.return_policy}</div>
      )}

      {/* Footer */}
      <div className="divider" />
      <div className="center bold" style={{ fontSize: '11px' }}>
        {settings?.bill_footer || 'Thank you for shopping with us!'}
      </div>
      <div className="center" style={{ fontSize: '9px', marginTop: '2px' }}>
        Powered by Nandarani POS
      </div>

      {/* Barcode */}
      {barcodeSVG && (
        <div className="center" style={{ marginTop: '4px' }} dangerouslySetInnerHTML={{ __html: barcodeSVG }} />
      )}
      <div className="center" style={{ fontSize: '10px' }}>{bill.bill_number}</div>
      <div style={{ height: '8mm' }} />
    </div>
  )
})

ThermalBill.displayName = 'ThermalBill'
