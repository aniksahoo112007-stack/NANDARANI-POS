import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/authStore'
import { Layout } from './components/layout/Layout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { POS } from './pages/POS'
import { Inventory } from './pages/Inventory'
import { AddProduct } from './pages/AddProduct'
import { Customers } from './pages/Customers'
import { Bills } from './pages/Bills'
import { DueManagement } from './pages/DueManagement'
import { Returns } from './pages/Returns'
import { Reports } from './pages/Reports'
import { Settings } from './pages/Settings'
import { Suppliers } from './pages/Suppliers'
import { PurchaseEntry } from './pages/PurchaseEntry'
import { StockTransfer } from './pages/StockTransfer'
import { StockMovements } from './pages/StockMovements'
import { Quotations } from './pages/Quotations'
import { StockAudit } from './pages/StockAudit'
import { StockReports } from './pages/StockReports'
import { ShopComparison } from './pages/ShopComparison'
import { DailyClosing } from './pages/DailyClosing'
import { ProductPerformance } from './pages/ProductPerformance'
import { BarcodeDesigner } from './pages/BarcodeDesigner'

// Protected Route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, initialized } = useAuthStore()
  if (!initialized) return null
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export const App: React.FC = () => {
  const { setUser } = useAuthStore()

  // Listen for auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null, session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null, session)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'var(--toast-bg, #1f2937)',
            color: 'var(--toast-color, #f9fafb)',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '500',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="pos" element={<POS />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="products/add" element={<AddProduct />} />
          <Route path="customers" element={<Customers />} />
          <Route path="bills" element={<Bills />} />
          <Route path="due" element={<DueManagement />} />
          <Route path="returns" element={<Returns />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="purchases" element={<PurchaseEntry />} />
          <Route path="transfers" element={<StockTransfer />} />
          <Route path="movements" element={<StockMovements />} />
          <Route path="quotations" element={<Quotations />} />
          <Route path="stock-audit" element={<StockAudit />} />
          <Route path="stock-reports" element={<StockReports />} />
          <Route path="shop-comparison" element={<ShopComparison />} />
          <Route path="daily-closing" element={<DailyClosing />} />
          <Route path="product-performance" element={<ProductPerformance />} />
          <Route path="barcode-designer" element={<BarcodeDesigner />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
