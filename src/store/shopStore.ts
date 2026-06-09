import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Shop, ShopSettings } from '../types'
import { shops } from '../lib/database'

interface ShopState {
  shops: Shop[]
  activeShop: Shop | null
  activeSettings: ShopSettings | null
  loading: boolean
  error: string | null
  fetchShops: (userId: string) => Promise<void>
  setActiveShop: (shop: Shop) => Promise<void>
  updateShop: (shopId: string, updates: Partial<Shop>) => Promise<void>
  updateSettings: (shopId: string, updates: Partial<ShopSettings>) => Promise<void>
  refreshSettings: () => Promise<void>
}

export const useShopStore = create<ShopState>()(
  persist(
    (set, get) => ({
      shops: [],
      activeShop: null,
      activeSettings: null,
      loading: false,
      error: null,

      fetchShops: async (userId) => {
        set({ loading: true, error: null })
        try {
          // getByUser auto-creates default shops if none exist
          const data = await shops.getByUser(userId)
          set({ shops: data })

          const currentActive = get().activeShop
          if (!currentActive && data.length > 0) {
            // First load — set first shop as active
            await get().setActiveShop(data[0])
          } else if (currentActive) {
            // Already have an active shop — refresh its data
            const refreshed = data.find(s => s.id === currentActive.id) ?? data[0]
            if (refreshed) {
              const settings = await shops.getSettings(refreshed.id)
              set({ activeShop: refreshed, activeSettings: settings })
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to load shops'
          set({ error: msg })
          console.error('[shopStore] fetchShops error:', err)
        } finally {
          set({ loading: false })
        }
      },

      setActiveShop: async (shop) => {
        try {
          const settings = await shops.getSettings(shop.id)
          set({ activeShop: shop, activeSettings: settings })
        } catch {
          // Set shop even if settings fetch fails — page will use defaults
          set({ activeShop: shop, activeSettings: null })
        }
      },

      updateShop: async (shopId, updates) => {
        const updated = await shops.update(shopId, updates)
        set(state => ({
          shops: state.shops.map(s => s.id === shopId ? updated : s),
          activeShop: state.activeShop?.id === shopId ? updated : state.activeShop,
        }))
      },

      updateSettings: async (shopId, updates) => {
        const updated = await shops.updateSettings(shopId, updates)
        set({ activeSettings: updated })
      },

      refreshSettings: async () => {
        const shop = get().activeShop
        if (!shop) return
        const settings = await shops.getSettings(shop.id)
        set({ activeSettings: settings })
      },
    }),
    {
      name: 'shop-store',
      partialize: (state) => ({ activeShop: state.activeShop }),
    }
  )
)
