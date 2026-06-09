import React, { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Sidebar, MobileSidebar } from './Sidebar'
import { useAuthStore } from '../../store/authStore'
import { useShopStore } from '../../store/shopStore'
import { Spinner } from '../ui'
import { Sun, Moon, Bell, LogOut, User } from 'lucide-react'
import { useDarkMode } from '../../hooks/useDarkMode'
import { useShopName } from '../../hooks/useShopName'

export const Layout: React.FC = () => {
  const { user, signOut, initialized } = useAuthStore()
  const { fetchShops, activeShop, loading: shopsLoading, error: shopsError } = useShopStore()
  const navigate = useNavigate()
  const { isDark, toggle } = useDarkMode()
  const shopName = useShopName()

  useEffect(() => {
    if (!initialized) return
    if (!user) { navigate('/login'); return }
    fetchShops(user.id)
  }, [user, initialized])

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex-shrink-0 h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 px-4">
          <MobileSidebar />
          <div className="flex-1">
            <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{shopName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={isDark ? 'Light mode' : 'Dark mode'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 relative">
              <Bell className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-gray-700">
              <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <button
                onClick={signOut}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {activeShop ? (
            <Outlet />
          ) : shopsError ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-sm px-4">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-red-600 text-xl">!</span>
                </div>
                <p className="text-gray-900 dark:text-gray-100 font-medium mb-1">Failed to load shops</p>
                <p className="text-gray-500 text-sm mb-4">{shopsError}</p>
                <button
                  onClick={() => user && fetchShops(user.id)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : shopsLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Spinner size="lg" />
                <p className="mt-4 text-gray-500 text-sm">Setting up your shops…</p>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  )
}
