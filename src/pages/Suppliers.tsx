import React, { useState, useEffect, useCallback } from 'react'
import { useShopStore } from '../store/shopStore'
import { suppliersDb } from '../lib/database'
import { Button, Input, Card, Spinner, Modal, ConfirmDialog, EmptyState } from '../components/ui'
import { Plus, Edit2, Trash2, Phone, Mail, MapPin, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Supplier } from '../types'

const emptyForm = { name: '', phone: '', email: '', address: '', gst_number: '', notes: '' }

export const Suppliers: React.FC = () => {
  const { activeShop } = useShopStore()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!activeShop) return
    setLoading(true)
    try {
      setSuppliers(await suppliersDb.list(activeShop.id))
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load suppliers')
    } finally {
      setLoading(false)
    }
  }, [activeShop?.id])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (s: Supplier) => {
    setEditing(s)
    setForm({
      name: s.name,
      phone: s.phone ?? '',
      email: s.email ?? '',
      address: s.address ?? '',
      gst_number: s.gst_number ?? '',
      notes: s.notes ?? '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!activeShop || !form.name.trim()) { toast.error('Supplier name is required'); return }
    setSaving(true)
    try {
      if (editing) {
        await suppliersDb.update(editing.id, form)
        toast.success('Supplier updated')
      } else {
        await suppliersDb.create({ ...form, shop_id: activeShop.id })
        toast.success('Supplier added')
      }
      setShowModal(false)
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await suppliersDb.delete(deleteId)
      toast.success('Supplier deleted')
      setDeleteId(null)
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  const filtered = suppliers.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.phone ?? '').includes(search)
  )

  if (!activeShop) return null

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Suppliers</h2>
          <p className="text-sm text-gray-500 mt-0.5">{suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} · {activeShop.name}</p>
        </div>
        <Button onClick={openAdd} icon={<Plus className="w-4 h-4" />}>Add Supplier</Button>
      </div>

      {/* Search */}
      <Input
        placeholder="Search by name or phone…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Building2 className="w-10 h-10" />}
            title={search ? 'No suppliers match your search' : 'No suppliers yet'}
            description={search ? 'Try a different search term.' : 'Add your first supplier to track purchases and invoices.'}
            action={!search ? <Button onClick={openAdd} icon={<Plus className="w-4 h-4" />}>Add Supplier</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => (
            <Card key={s.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{s.name}</p>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 ml-10">
                    {s.phone && (
                      <span className="flex items-center gap-1.5 text-sm text-gray-500">
                        <Phone className="w-3.5 h-3.5" />{s.phone}
                      </span>
                    )}
                    {s.email && (
                      <span className="flex items-center gap-1.5 text-sm text-gray-500">
                        <Mail className="w-3.5 h-3.5" />{s.email}
                      </span>
                    )}
                    {s.address && (
                      <span className="flex items-center gap-1.5 text-sm text-gray-500">
                        <MapPin className="w-3.5 h-3.5" />{s.address}
                      </span>
                    )}
                    {s.gst_number && (
                      <span className="text-sm text-gray-500">GST: {s.gst_number}</span>
                    )}
                  </div>
                  {s.notes && (
                    <p className="text-xs text-gray-400 mt-1 ml-10 truncate">{s.notes}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" icon={<Edit2 className="w-3.5 h-3.5" />} onClick={() => openEdit(s)}>
                    Edit
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                    onClick={() => setDeleteId(s.id)}
                    className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Supplier' : 'Add Supplier'}
        size="md"
      >
        <div className="p-4 space-y-4">
          <Input
            label="Supplier Name *"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Company or person name"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phone"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="9xxxxxxxxx"
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="email@example.com"
            />
          </div>
          <Input
            label="Address"
            value={form.address}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            placeholder="City, State"
          />
          <Input
            label="GST Number"
            value={form.gst_number}
            onChange={e => setForm(f => ({ ...f, gst_number: e.target.value }))}
            placeholder="22AAAAA0000A1Z5"
          />
          <Input
            label="Notes"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Any additional notes…"
          />
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? 'Update Supplier' : 'Add Supplier'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier? Products linked to them will not be affected."
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}
