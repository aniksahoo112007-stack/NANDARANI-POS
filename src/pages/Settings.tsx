import React, { useState, useEffect } from 'react'
import { useShopStore } from '../store/shopStore'
import { shops } from '../lib/database'
import { Button, Input, Textarea, Toggle, Card, ConfirmDialog } from '../components/ui'
import { Save, RefreshCw, Plus, X, Globe, MapPin, Clock, Eye, EyeOff, Image } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ShopSettings, Shop } from '../types'

export const Settings: React.FC = () => {
  const { activeShop, activeSettings, updateShop, updateSettings, refreshSettings, shops: allShops } = useShopStore()
  const [shopData, setShopData] = useState<Partial<Shop>>({})
  const [settingsData, setSettingsData] = useState<Partial<ShopSettings>>({})
  const [saving, setSaving] = useState(false)
  // Catalog state: keyed by shopId
  const [catalogData, setCatalogData] = useState<Record<string, Partial<Shop>>>({})
  const [catalogSaving, setCatalogSaving] = useState<string | null>(null)
  const [billerInput, setBillerInput] = useState('')
  const [paymentInput, setPaymentInput] = useState('')
  const [confirmReset, setConfirmReset] = useState<'bill' | 'barcode' | null>(null)

  useEffect(() => {
    if (activeShop) setShopData(activeShop)
  }, [activeShop])

  useEffect(() => {
    if (activeSettings) setSettingsData(activeSettings)
  }, [activeSettings])

  // Seed catalog form whenever allShops loads/changes
  useEffect(() => {
    if (allShops.length > 0) {
      setCatalogData(prev => {
        const next = { ...prev }
        allShops.forEach(s => {
          if (!next[s.id]) next[s.id] = {
            whatsapp: s.whatsapp ?? '',
            address: s.address ?? '',
            google_maps_url: s.google_maps_url ?? '',
            shop_photo_url: s.shop_photo_url ?? '',
            catalog_url: s.catalog_url ?? '',
            business_hours: s.business_hours ?? '',
            show_in_catalog: s.show_in_catalog ?? true,
          }
        })
        return next
      })
    }
  }, [allShops])

  const handleSaveShop = async () => {
    if (!activeShop) return
    setSaving(true)
    try {
      await updateShop(activeShop.id, {
        name: shopData.name,
        display_name: shopData.display_name,
        address: shopData.address,
        pincode: shopData.pincode,
        phone: shopData.phone,
        whatsapp: shopData.whatsapp,
        gst_number: shopData.gst_number,
        upi_id: shopData.upi_id,
        upi_name: shopData.upi_name,
        logo_url: shopData.logo_url,
        bill_prefix: shopData.bill_prefix,
        barcode_prefix: shopData.barcode_prefix,
      })
      toast.success('Shop details saved!')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveSettings = async () => {
    if (!activeShop) return
    setSaving(true)
    try {
      await updateSettings(activeShop.id, settingsData)
      toast.success('Settings saved!')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const addBiller = () => {
    if (!billerInput.trim()) return
    setSettingsData(s => ({ ...s, biller_names: [...(s.biller_names || []), billerInput.trim()] }))
    setBillerInput('')
  }

  const removeBiller = (i: number) => {
    setSettingsData(s => ({ ...s, biller_names: (s.biller_names || []).filter((_, idx) => idx !== i) }))
  }

  const addPaymentMethod = () => {
    if (!paymentInput.trim()) return
    setSettingsData(s => ({ ...s, payment_methods: [...(s.payment_methods || []), paymentInput.trim()] }))
    setPaymentInput('')
  }

  const removePaymentMethod = (i: number) => {
    setSettingsData(s => ({ ...s, payment_methods: (s.payment_methods || []).filter((_, idx) => idx !== i) }))
  }

  const handleReset = async (type: 'bill' | 'barcode') => {
    if (!activeShop) return
    try {
      if (type === 'bill') await shops.resetBillSequence(activeShop.id)
      else await shops.resetBarcodeSequence(activeShop.id)
      toast.success(`${type === 'bill' ? 'Bill' : 'Barcode'} sequence reset to 0!`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Reset failed')
    }
  }

  const handleSaveCatalog = async (shopId: string, shopName: string) => {
    const data = catalogData[shopId]
    if (!data) return
    setCatalogSaving(shopId)
    try {
      await updateShop(shopId, {
        whatsapp: data.whatsapp ?? null,
        address: data.address ?? null,
        google_maps_url: data.google_maps_url ?? null,
        shop_photo_url: data.shop_photo_url ?? null,
        catalog_url: data.catalog_url ?? null,
        business_hours: data.business_hours ?? null,
        show_in_catalog: data.show_in_catalog ?? true,
      })
      toast.success(`Catalog profile saved for ${shopName}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save catalog profile')
    } finally {
      setCatalogSaving(null)
    }
  }

  const setCatalog = (shopId: string, updates: Partial<Shop>) =>
    setCatalogData(prev => ({ ...prev, [shopId]: { ...prev[shopId], ...updates } }))

  if (!activeShop) return null

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Settings</h2>
          <p className="text-sm text-gray-500 mt-0.5">{activeShop.name}</p>
        </div>
      </div>

      {/* Shop Details */}
      <Card>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          🏪 Shop Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Shop Name" value={shopData.name || ''} onChange={e => setShopData(s => ({ ...s, name: e.target.value }))} />
          <Input label="Display Name" value={shopData.display_name || ''} onChange={e => setShopData(s => ({ ...s, display_name: e.target.value }))} />
          <Input label="Phone Number" value={shopData.phone || ''} onChange={e => setShopData(s => ({ ...s, phone: e.target.value }))} />
          <Input label="WhatsApp Number" value={shopData.whatsapp || ''} onChange={e => setShopData(s => ({ ...s, whatsapp: e.target.value }))} />
          <Input label="GST Number" value={shopData.gst_number || ''} onChange={e => setShopData(s => ({ ...s, gst_number: e.target.value }))} />
          <Input label="Pincode" value={shopData.pincode || ''} onChange={e => setShopData(s => ({ ...s, pincode: e.target.value }))} />
          <div className="md:col-span-2">
            <Textarea label="Address" rows={2} value={shopData.address || ''} onChange={e => setShopData(s => ({ ...s, address: e.target.value }))} />
          </div>
        </div>
        <Button onClick={handleSaveShop} loading={saving} icon={<Save className="w-4 h-4" />} className="mt-4">
          Save Shop Details
        </Button>
      </Card>

      {/* Prefixes & Sequences */}
      <Card>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">🔖 Prefixes & Sequences</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Input label="Bill Number Prefix" value={shopData.bill_prefix || ''} onChange={e => setShopData(s => ({ ...s, bill_prefix: e.target.value }))} hint="e.g. NB or NBN" />
          <Input label="Barcode Prefix" value={shopData.barcode_prefix || ''} onChange={e => setShopData(s => ({ ...s, barcode_prefix: e.target.value }))} hint="e.g. NB or NBN" />
        </div>
        <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={() => setConfirmReset('bill')}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reset Bill Sequence
          </button>
          <button
            onClick={() => setConfirmReset('barcode')}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reset Barcode Sequence
          </button>
        </div>
        <Button onClick={handleSaveShop} loading={saving} icon={<Save className="w-4 h-4" />} variant="secondary" className="mt-4">
          Save Prefixes
        </Button>
      </Card>

      {/* Payment & UPI */}
      <Card>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">💳 Payment & UPI</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="UPI ID" value={shopData.upi_id || ''} onChange={e => setShopData(s => ({ ...s, upi_id: e.target.value }))} placeholder="shopname@upi" />
          <Input label="UPI Display Name" value={shopData.upi_name || ''} onChange={e => setShopData(s => ({ ...s, upi_name: e.target.value }))} placeholder="Shop name on QR" />
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Payment Methods</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {(settingsData.payment_methods || []).map((m, i) => (
              <span key={i} className="flex items-center gap-1 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                {m}
                <button onClick={() => removePaymentMethod(i)} className="ml-1 hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={paymentInput} onChange={e => setPaymentInput(e.target.value)} placeholder="Add method (e.g. UPI, Card)" onKeyDown={e => e.key === 'Enter' && addPaymentMethod()} />
            <Button onClick={addPaymentMethod} icon={<Plus className="w-4 h-4" />} variant="secondary">Add</Button>
          </div>
        </div>
        <Button onClick={handleSaveShop} loading={saving} icon={<Save className="w-4 h-4" />} className="mt-4">
          Save Payment Settings
        </Button>
      </Card>

      {/* Billing Settings */}
      <Card>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">🧾 Billing Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <Input
            label="Default GST Rate (%)"
            type="number"
            min="0" max="28"
            value={settingsData.default_gst_rate ?? ''}
            onChange={e => setSettingsData(s => ({ ...s, default_gst_rate: parseFloat(e.target.value) || 0 }))}
          />
          <Input
            label="Default Discount (%)"
            type="number"
            min="0" max="100"
            value={settingsData.default_discount ?? ''}
            onChange={e => setSettingsData(s => ({ ...s, default_discount: parseFloat(e.target.value) || 0 }))}
          />
          <Input
            label="Low Stock Alert (qty)"
            type="number"
            min="0"
            value={settingsData.low_stock_limit ?? ''}
            onChange={e => setSettingsData(s => ({ ...s, low_stock_limit: parseInt(e.target.value) || 5 }))}
          />
        </div>
        <div className="space-y-3 mb-4">
          <Toggle
            checked={settingsData.round_off_bill ?? true}
            onChange={v => setSettingsData(s => ({ ...s, round_off_bill: v }))}
            label="Round off bill total"
          />
          <Toggle
            checked={settingsData.enable_gst ?? false}
            onChange={v => setSettingsData(s => ({ ...s, enable_gst: v }))}
            label="Enable GST billing"
          />
          <Toggle
            checked={settingsData.show_mrp_on_bill ?? true}
            onChange={v => setSettingsData(s => ({ ...s, show_mrp_on_bill: v }))}
            label="Show MRP on bill"
          />
        </div>
        <div className="space-y-4">
          <Textarea
            label="Bill Footer Text"
            rows={2}
            value={settingsData.bill_footer || ''}
            onChange={e => setSettingsData(s => ({ ...s, bill_footer: e.target.value }))}
            placeholder="Thank you for shopping with us!"
          />
          <Textarea
            label="Return/Exchange Policy"
            rows={2}
            value={settingsData.return_policy || ''}
            onChange={e => setSettingsData(s => ({ ...s, return_policy: e.target.value }))}
            placeholder="Exchange within 7 days with bill."
          />
        </div>
        <Button onClick={handleSaveSettings} loading={saving} icon={<Save className="w-4 h-4" />} className="mt-4">
          Save Billing Settings
        </Button>
      </Card>

      {/* Biller Names */}
      <Card>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">👤 Biller Names</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {(settingsData.biller_names || []).map((b, i) => (
            <span key={i} className="flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm">
              {b}
              <button onClick={() => removeBiller(i)} className="ml-1 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={billerInput} onChange={e => setBillerInput(e.target.value)} placeholder="Add biller name" onKeyDown={e => e.key === 'Enter' && addBiller()} />
          <Button onClick={addBiller} icon={<Plus className="w-4 h-4" />} variant="secondary">Add</Button>
        </div>
        <Button onClick={handleSaveSettings} loading={saving} icon={<Save className="w-4 h-4" />} variant="secondary" className="mt-3">
          Save Billers
        </Button>
      </Card>

      {/* Logo URL */}
      <Card>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">🖼️ Logo (Optional)</h3>
        <Input label="Logo Image URL" value={shopData.logo_url || ''} onChange={e => setShopData(s => ({ ...s, logo_url: e.target.value }))} placeholder="https://..." />
        {shopData.logo_url && (
          <img src={shopData.logo_url} alt="logo" className="mt-3 h-16 object-contain rounded" onError={e => (e.currentTarget.style.display = 'none')} />
        )}
        <Button onClick={handleSaveShop} loading={saving} icon={<Save className="w-4 h-4" />} variant="secondary" className="mt-3">
          Save Logo
        </Button>
      </Card>

      {/* ── Catalog & Business Profile ─────────────────────────── */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" /> Catalog &amp; Business Profile
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Controls how each shop appears in the public catalog app. Set for both shops independently.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {allShops.map(shop => {
            const cd = catalogData[shop.id] ?? {}
            const isSaving = catalogSaving === shop.id
            return (
              <Card key={shop.id}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{shop.name}</h4>
                    <span className="text-xs text-gray-400 font-mono">{shop.bill_prefix}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {cd.show_in_catalog !== false
                      ? <Eye className="w-4 h-4 text-green-500" />
                      : <EyeOff className="w-4 h-4 text-gray-400" />}
                    <Toggle
                      checked={cd.show_in_catalog ?? true}
                      onChange={v => setCatalog(shop.id, { show_in_catalog: v })}
                      label="Show in Catalog"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Input
                    label="WhatsApp Number"
                    value={cd.whatsapp ?? ''}
                    onChange={e => setCatalog(shop.id, { whatsapp: e.target.value })}
                    placeholder="916296240320"
                    hint="Country code + number, no spaces or +"
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Google Maps Direction Link
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        type="url"
                        value={cd.google_maps_url ?? ''}
                        onChange={e => setCatalog(shop.id, { google_maps_url: e.target.value })}
                        placeholder="https://maps.app.goo.gl/..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <Textarea
                    label="Shop Address"
                    rows={2}
                    value={cd.address ?? ''}
                    onChange={e => setCatalog(shop.id, { address: e.target.value })}
                    placeholder="Full shop address..."
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Shop Photo URL
                    </label>
                    <div className="relative">
                      <Image className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        type="url"
                        value={cd.shop_photo_url ?? ''}
                        onChange={e => setCatalog(shop.id, { shop_photo_url: e.target.value })}
                        placeholder="https://..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {cd.shop_photo_url && (
                      <img
                        src={cd.shop_photo_url}
                        alt="Shop preview"
                        className="mt-2 h-16 w-full object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                        onError={e => (e.currentTarget.style.display = 'none')}
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Catalog Public URL
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        type="url"
                        value={cd.catalog_url ?? ''}
                        onChange={e => setCatalog(shop.id, { catalog_url: e.target.value })}
                        placeholder="https://nandarani-catalog.vercel.app"
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Business Hours
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        type="text"
                        value={cd.business_hours ?? ''}
                        onChange={e => setCatalog(shop.id, { business_hours: e.target.value })}
                        placeholder="10:00 AM - 9:00 PM"
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => handleSaveCatalog(shop.id, shop.name)}
                  loading={isSaving}
                  icon={<Save className="w-4 h-4" />}
                  className="mt-4 w-full"
                >
                  Save {shop.bill_prefix} Catalog Profile
                </Button>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Confirm Reset Dialogs */}
      <ConfirmDialog
        isOpen={confirmReset === 'bill'}
        onClose={() => setConfirmReset(null)}
        onConfirm={() => handleReset('bill')}
        title="Reset Bill Sequence"
        message="This will reset the bill number counter to 0. The next bill will start from #1. This cannot be undone. Are you sure?"
        confirmLabel="Yes, Reset"
        danger
      />
      <ConfirmDialog
        isOpen={confirmReset === 'barcode'}
        onClose={() => setConfirmReset(null)}
        onConfirm={() => handleReset('barcode')}
        title="Reset Barcode Sequence"
        message="This will reset the barcode counter to 0. New barcodes will start from #1. Existing barcodes are unaffected. Are you sure?"
        confirmLabel="Yes, Reset"
        danger
      />
    </div>
  )
}
