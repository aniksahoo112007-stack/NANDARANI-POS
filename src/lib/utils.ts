import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format currency
export function formatCurrency(amount: number, symbol = '₹'): string {
  return `${symbol}${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// Format date
export function formatDate(date: string | Date, fmt = 'dd/MM/yyyy'): string {
  return format(new Date(date), fmt)
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'dd/MM/yyyy hh:mm a')
}

export function timeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

// Round off to nearest integer
export function roundOff(amount: number): { rounded: number; diff: number } {
  const rounded = Math.round(amount)
  const diff = rounded - amount
  return { rounded, diff: parseFloat(diff.toFixed(2)) }
}

// Calculate GST
export function calculateGST(
  amount: number,
  gstRate: number,
  isInclusive = false
): { base: number; gst: number; total: number; cgst: number; sgst: number } {
  if (gstRate === 0) return { base: amount, gst: 0, total: amount, cgst: 0, sgst: 0 }

  let base: number
  let gst: number

  if (isInclusive) {
    base = (amount * 100) / (100 + gstRate)
    gst = amount - base
  } else {
    base = amount
    gst = (amount * gstRate) / 100
  }

  const cgst = gst / 2
  const sgst = gst / 2
  return {
    base: parseFloat(base.toFixed(2)),
    gst: parseFloat(gst.toFixed(2)),
    total: parseFloat((base + gst).toFixed(2)),
    cgst: parseFloat(cgst.toFixed(2)),
    sgst: parseFloat(sgst.toFixed(2)),
  }
}

// Generate WhatsApp URL
export function generateWhatsAppURL(phone: string, message: string): string {
  const cleaned = phone.replace(/\D/g, '')
  const number = cleaned.startsWith('91') ? cleaned : `91${cleaned}`
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

// Generate UPI QR string (generic, note is free text)
export function generateUPIString(upiId: string, name: string, amount: number, note = ''): string {
  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`
}

// Generate UPI payment link with bill number in tn field
export function generateUPIPaymentLink(upiId: string, shopName: string, amount: number, billNumber: string): string {
  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Bill ' + billNumber)}`
}

// Bill share message (includes UPI payment link when due > 0)
export function generateBillShareMessage(
  shopName: string,
  billNumber: string,
  customerName: string,
  grandTotal: number,
  paidAmount: number,
  dueAmount: number,
  date: string,
  upiPaymentLink?: string
): string {
  let msg = `*${shopName}*
━━━━━━━━━━━━━━━━━
Bill #${billNumber}
Date: ${date}
Customer: ${customerName}
━━━━━━━━━━━━━━━━━
Total: ₹${grandTotal.toFixed(2)}
Paid: ₹${paidAmount.toFixed(2)}
Due: ₹${dueAmount.toFixed(2)}
━━━━━━━━━━━━━━━━━
Thank you for shopping with us! 🙏`

  if (upiPaymentLink && dueAmount > 0) {
    msg += `\n\n💳 *Pay Due Amount ₹${dueAmount.toFixed(2)}:*\n${upiPaymentLink}`
  }
  return msg
}

// UPI payment request message (before bill, for QR share)
export function generateUPIRequestMessage(
  shopName: string,
  customerName: string,
  amount: number,
  upiPaymentLink: string
): string {
  return `*Payment Request from ${shopName}*
━━━━━━━━━━━━━━━━━
Customer: ${customerName}
Amount: ₹${amount.toFixed(2)}
━━━━━━━━━━━━━━━━━
💳 Click to pay via UPI:
${upiPaymentLink}
━━━━━━━━━━━━━━━━━
Powered by Nandarani POS`
}

// Due reminder message (optional UPI payment link appended when provided)
export function generateDueReminderMessage(
  shopName: string,
  customerName: string,
  dueAmount: number,
  billNumbers: string[],
  upiPaymentLink?: string
): string {
  const billList = billNumbers.length > 0 ? billNumbers.join(', ') : 'pending'
  let msg = `Dear ${customerName},

This is a gentle reminder from *${shopName}* regarding your pending due amount of *₹${dueAmount.toFixed(2)}* for bill(s): ${billList}.

Please visit our shop or make a UPI payment at your earliest convenience.

Thank you! 🙏`

  if (upiPaymentLink) {
    msg += `\n\n💳 *Pay Now via UPI:*\n${upiPaymentLink}`
  }
  return msg
}

// Download file
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Generate UUID (simple)
export function generateId(): string {
  return crypto.randomUUID()
}

// Debounce
export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

// Validate phone
export function isValidPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone.replace(/\D/g, ''))
}

// Number to words (for bills)
export function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  function convert(n: number): string {
    if (n < 20) return ones[n]
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '')
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '')
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '')
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '')
  }

  const rupees = Math.floor(num)
  const paise = Math.round((num - rupees) * 100)
  let result = convert(rupees) + ' Rupees'
  if (paise > 0) result += ' and ' + convert(paise) + ' Paise'
  return result + ' Only'
}

// Status badge color
export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    PAID: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    PARTIAL: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    DUE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    REFUNDED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    EXCHANGED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    CANCELLED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400',
  }
  return map[status] || 'bg-gray-100 text-gray-800'
}

// CSV export — accepts any array of objects
export function exportToCSV(data: object[], filename: string): void {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const csvRows = [
    headers.join(','),
    ...data.map(row => {
      const r = row as Record<string, unknown>
      return headers.map(h => {
        const val = r[h]
        return typeof val === 'string' && val.includes(',') ? `"${val}"` : val
      }).join(',')
    }),
  ]
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
  downloadBlob(blob, `${filename}.csv`)
}
