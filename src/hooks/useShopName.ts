import { useLocation } from 'react-router-dom'
import { useShopStore } from '../store/shopStore'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/pos': 'POS Billing',
  '/inventory': 'Inventory',
  '/products/add': 'Add Product / Barcode',
  '/customers': 'Customers',
  '/bills': 'Bills',
  '/due': 'Due Management',
  '/returns': 'Returns & Exchange',
  '/reports': 'Reports',
  '/settings': 'Settings',
}

export function useShopName(): string {
  const location = useLocation()
  const { activeShop } = useShopStore()
  const pageTitle = PAGE_TITLES[location.pathname] || 'Nandarani POS'
  return activeShop ? `${pageTitle} — ${activeShop.name}` : pageTitle
}
