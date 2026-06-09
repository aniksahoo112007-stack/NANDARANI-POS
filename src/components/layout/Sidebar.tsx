import React, { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { useShopStore } from '../../store/shopStore'
import {
  LayoutDashboard, ShoppingCart, Package, Users, FileText,
  AlertCircle, ArrowLeftRight, BarChart2, Settings, ChevronRight,
  Store, Menu, X, Barcode
} from 'lucide-react'

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/pos', label: 'POS Billing', icon: ShoppingCart, highlight: true },
  { path: '/inventory', label: 'Inventory', icon: Package },
  { path: '/products/add', label: 'Add Product', icon: Barcode },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/bills', label: 'Bills', icon: FileText },
  { path: '/due', label: 'Due Management', icon: AlertCircle },
  { path: '/returns', label: 'Returns & Exchange', icon: ArrowLeftRight },
  { path: '/reports', label: 'Reports', icon: BarChart2 },
  { path: '/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  mobile?: boolean
  onClose?: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ mobile, onClose }) => {
  const { shops, activeShop, setActiveShop } = useShopStore()
  const location = useLocation()

  return (
    <aside className={cn(
      'flex flex-col h-full',
      'bg-gray-900 dark:bg-gray-950',
      mobile ? 'w-full' : 'w-64'
    )}>
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Nandarani</p>
            <p className="text-gray-400 text-xs">POS System</p>
          </div>
        </div>
        {mobile && onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Shop Switcher */}
      <div className="px-3 pt-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">Active Shop</p>
        <div className="space-y-1">
          {shops.map(shop => (
            <button
              key={shop.id}
              onClick={() => { setActiveShop(shop); onClose?.() }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all',
                activeShop?.id === shop.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <div className={cn(
                'w-6 h-6 rounded flex items-center justify-center text-xs font-bold flex-shrink-0',
                activeShop?.id === shop.id ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300'
              )}>
                {shop.bill_prefix}
              </div>
              <span className="text-xs font-medium truncate">{shop.name}</span>
              {activeShop?.id === shop.id && <ChevronRight className="w-3 h-3 ml-auto flex-shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">Navigation</p>
        {navItems.map(({ path, label, icon: Icon, highlight }) => {
          const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
          return (
            <NavLink
              key={path}
              to={path}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white',
                highlight && !isActive && 'border border-blue-500/30 text-blue-400 hover:bg-blue-600/10'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          )
        })}
      </nav>

      {/* Bottom Info */}
      {activeShop && (
        <div className="px-4 py-3 border-t border-gray-800">
          <p className="text-xs text-gray-500 truncate">{activeShop.name}</p>
          <p className="text-xs text-gray-600 mt-0.5">Bill Prefix: {activeShop.bill_prefix}</p>
        </div>
      )}
    </aside>
  )
}

export const MobileSidebar: React.FC = () => {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <Menu className="w-5 h-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 animate-slide-up">
            <Sidebar mobile onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
