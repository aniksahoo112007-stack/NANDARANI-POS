// ============================================================
// Shared UI Components
// ============================================================
import React from 'react'
import { cn } from '../../lib/utils'
import { Loader2, X, AlertTriangle, CheckCircle, Info } from 'lucide-react'

// ---- Button ----
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'success'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  loading?: boolean
  icon?: React.ReactNode
  fullWidth?: boolean
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary', size = 'md', loading, icon, fullWidth, children, className, disabled, ...props
}) => {
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm',
    ghost: 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300',
    outline: 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300',
    success: 'bg-green-600 hover:bg-green-700 text-white shadow-sm',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm',
    xl: 'px-6 py-3 text-base',
  }
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant], sizes[size],
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}

// ---- Input ----
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  icon?: React.ReactNode
  suffix?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label, error, hint, icon, suffix, className, ...props
}, ref) => (
  <div className="w-full">
    {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
    <div className="relative">
      {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>}
      <input
        ref={ref}
        className={cn(
          'w-full rounded-lg border px-3 py-2 text-sm transition-colors',
          'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
          'border-gray-300 dark:border-gray-600',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          'placeholder:text-gray-400 dark:placeholder:text-gray-500',
          'disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:cursor-not-allowed',
          error && 'border-red-500 focus:ring-red-500',
          icon && 'pl-10',
          suffix && 'pr-10',
          className
        )}
        {...props}
      />
      {suffix && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{suffix}</div>}
    </div>
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
  </div>
))
Input.displayName = 'Input'

// ---- Select ----
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({
  label, error, options, className, ...props
}, ref) => (
  <div className="w-full">
    {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
    <select
      ref={ref}
      className={cn(
        'w-full rounded-lg border px-3 py-2 text-sm transition-colors',
        'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
        'border-gray-300 dark:border-gray-600',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
        error && 'border-red-500',
        className
      )}
      {...props}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
))
Select.displayName = 'Select'

// ---- Textarea ----
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label, error, className, ...props
}, ref) => (
  <div className="w-full">
    {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-lg border px-3 py-2 text-sm transition-colors resize-none',
        'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
        'border-gray-300 dark:border-gray-600',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
        error && 'border-red-500',
        className
      )}
      {...props}
    />
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
))
Textarea.displayName = 'Textarea'

// ---- Card ----
interface CardProps { children: React.ReactNode; className?: string; padding?: boolean }
export const Card: React.FC<CardProps> = ({ children, className, padding = true }) => (
  <div className={cn(
    'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700',
    padding && 'p-5',
    className
  )}>
    {children}
  </div>
)

// ---- Modal ----
interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-7xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        'relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full animate-slide-up',
        'max-h-[90vh] overflow-hidden flex flex-col',
        sizes[size]
      )}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

// ---- Badge ----
interface BadgeProps { children: React.ReactNode; className?: string; variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' }
export const Badge: React.FC<BadgeProps> = ({ children, className, variant = 'default' }) => {
  const variants = {
    default: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    danger: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  )
}

// ---- Spinner ----
export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({ size = 'md', className }) => {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }
  return <Loader2 className={cn('animate-spin text-blue-600', sizes[size], className)} />
}

// ---- Empty State ----
interface EmptyStateProps { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }
export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    {icon && <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-400">{icon}</div>}
    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
    {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-sm">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
)

// ---- Stat Card ----
interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  color: string
  sub?: string
  trend?: number
}
export const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, sub, trend }) => (
  <Card className="flex items-center gap-4">
    <div className={cn('p-3 rounded-xl', color)}>{icon}</div>
    <div className="flex-1 min-w-0">
      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{label}</p>
      <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
    {trend !== undefined && (
      <span className={cn('text-xs font-medium', trend >= 0 ? 'text-green-600' : 'text-red-600')}>
        {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
      </span>
    )}
  </Card>
)

// ---- Alert ----
interface AlertProps { type: 'error' | 'warning' | 'success' | 'info'; title?: string; message: string; onClose?: () => void }
export const Alert: React.FC<AlertProps> = ({ type, title, message, onClose }) => {
  const styles = {
    error: { bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800', icon: <AlertTriangle className="w-4 h-4 text-red-500" />, text: 'text-red-800 dark:text-red-200' },
    warning: { bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800', icon: <AlertTriangle className="w-4 h-4 text-yellow-500" />, text: 'text-yellow-800 dark:text-yellow-200' },
    success: { bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800', icon: <CheckCircle className="w-4 h-4 text-green-500" />, text: 'text-green-800 dark:text-green-200' },
    info: { bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800', icon: <Info className="w-4 h-4 text-blue-500" />, text: 'text-blue-800 dark:text-blue-200' },
  }
  const s = styles[type]
  return (
    <div className={cn('flex gap-3 p-4 rounded-lg border', s.bg)}>
      <div className="flex-shrink-0 mt-0.5">{s.icon}</div>
      <div className="flex-1">
        {title && <p className={cn('font-medium text-sm', s.text)}>{title}</p>}
        <p className={cn('text-sm', s.text, title && 'mt-0.5')}>{message}</p>
      </div>
      {onClose && <button onClick={onClose} className="flex-shrink-0"><X className="w-4 h-4 text-gray-400" /></button>}
    </div>
  )
}

// ---- Table ----
interface TableProps { children: React.ReactNode; className?: string }
export const Table: React.FC<TableProps> = ({ children, className }) => (
  <div className={cn('w-full overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700', className)}>
    <table className="w-full text-sm">{children}</table>
  </div>
)
export const Th: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <th className={cn('px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide bg-gray-50 dark:bg-gray-900/50 whitespace-nowrap', className)}>{children}</th>
)
export const Td: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <td className={cn('px-4 py-3 text-gray-700 dark:text-gray-300 border-t border-gray-100 dark:border-gray-700/50', className)}>{children}</td>
)

// ---- Confirm Dialog ----
interface ConfirmProps { isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; confirmLabel?: string; danger?: boolean }
export const ConfirmDialog: React.FC<ConfirmProps> = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
    <div className="p-6">
      <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
      <div className="flex gap-3 mt-6 justify-end">
        <Button variant="outline" size="md" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} size="md" onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</Button>
      </div>
    </div>
  </Modal>
)

// ---- Search Input ----
interface SearchInputProps { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }
export const SearchInput: React.FC<SearchInputProps> = ({ value, onChange, placeholder = 'Search...', className }) => (
  <div className={cn('relative', className)}>
    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    {value && (
      <button onClick={() => onChange('')} className="absolute right-3 top-1/2 -translate-y-1/2">
        <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
      </button>
    )}
  </div>
)

// ---- Toggle ----
interface ToggleProps { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }
export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, disabled }) => (
  <label className="flex items-center gap-3 cursor-pointer">
    <div
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'relative w-11 h-6 rounded-full transition-colors',
        checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div className={cn(
        'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
        checked && 'translate-x-5'
      )} />
    </div>
    {label && <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>}
  </label>
)

// ---- Status Stamp ----
export const StatusStamp: React.FC<{ status: string; size?: 'sm' | 'lg' }> = ({ status, size = 'sm' }) => {
  const map: Record<string, { label: string; cls: string }> = {
    PAID: { label: 'PAID', cls: 'text-green-600 border-green-600' },
    PARTIAL: { label: 'PARTIAL PAID', cls: 'text-yellow-600 border-yellow-600' },
    DUE: { label: 'DUE', cls: 'text-red-600 border-red-600' },
    REFUNDED: { label: 'REFUNDED', cls: 'text-purple-600 border-purple-600' },
    EXCHANGED: { label: 'EXCHANGED', cls: 'text-blue-600 border-blue-600' },
    CANCELLED: { label: 'CANCELLED', cls: 'text-gray-500 border-gray-500' },
  }
  const s = map[status] || { label: status, cls: 'text-gray-500 border-gray-500' }
  return (
    <span className={cn(
      'inline-block font-bold border-2 uppercase tracking-widest',
      size === 'lg' ? 'px-3 py-1 text-sm rounded' : 'px-2 py-0.5 text-xs rounded',
      s.cls
    )}>
      {s.label}
    </span>
  )
}
