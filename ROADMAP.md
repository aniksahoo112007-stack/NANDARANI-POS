# Nandarani POS — Codebase Roadmap

**Last updated:** June 2026  
**Shops:** NANDARANI BASTRALAY (NB) · NEW NANDARANI BASTRALAY (NBN)  
**Stack:** React 18 + TypeScript + Vite · Supabase (Postgres + Auth + RLS) · Tailwind CSS · Zustand

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Complete — implemented and bug-fixed |
| 🔶 | Partial — exists but has gaps or rough edges |
| ❌ | Missing — not yet built |

---

## 1. Authentication & Session Management ✅

- Email/password sign-in and sign-up via Supabase Auth
- Zustand `authStore` with `persist` middleware (user + session + profile)
- `fetchProfile` wrapped in try/catch — `initialized` always resolves even on profile errors
- Protected routes via `ProtectedRoute` wrapper in `App.tsx`
- Auto session restore on page reload via `supabase.auth.onAuthStateChange`
- Sign-out clears user, session, and profile state

**No gaps.**

---

## 2. Shop Management ✅

- Two shops auto-created on first login: **NANDARANI BASTRALAY** (NB) and **NEW NANDARANI BASTRALAY** (NBN)
- `createDefaultShops()` in `database.ts` uses `.upsert()` — safe for retries, no duplicate constraint crashes
- `shopStore.fetchShops` has full try/catch with `error` state — dashboard never hangs forever
- Active shop persisted across page reloads; settings refreshed on every load
- `setActiveShop` catches settings-fetch failures gracefully — shop still activates
- `Layout.tsx` shows loading spinner → error+retry → page content (three-state)
- Shop switcher in sidebar to toggle between shops

**No gaps.**

---

## 3. Inventory Management 🔶

**Complete:**
- Product CRUD: Add, edit, archive (`AddProduct.tsx`, `Inventory.tsx`)
- Barcode generation: atomic PostgreSQL sequence per shop via `get_next_barcode` RPC; JsBarcode CODE128 rendering
- Stock quantity tracked; `low_stock_limit` per product
- Low-stock filter: client-side filtering after full fetch (PostgREST cannot do column-to-column comparison)
- Category and HSN code fields; GST rate per product
- Inventory movement log (`inventory_movements` table) — entries written on bill creation and returns

**Gaps:**
- 🔶 No dedicated "Receive Stock / Purchase Order" UI — stock can only increase via manual edit or return processing
- 🔶 Barcode printing page (print labels in bulk) not built
- 🔶 No product image support
- 🔶 CSV/Excel import for bulk product upload missing

---

## 4. Point of Sale (Billing) ✅

- `POS.tsx` (724 lines) — full cart UI with product search, quantity edit, per-item discount
- Correct billing math (fixed): `discount → after-discount price → GST on after-discount → total = after-discount + GST`
- Bill type toggle: **GST bill** (with GST) vs **Retail bill** (no GST)
- Bill-level discount in %
- Customer selection / quick-add from POS
- Payment modes: Cash, Card, UPI, Split
- Due amount tracking (partial payment)
- UPI QR code generated via `qrcode` library with `upi://pay?pa=...` format
- Thermal bill print (`ThermalBill.tsx`) via `react-to-print` — 80mm format with CSS print media queries
- Bill number barcode rendered inline on thermal bill via JsBarcode
- WhatsApp share link (`wa.me/916296240320`) on bill
- Atomic bill number sequence per shop via `get_next_bill_number` RPC
- PDF save via jsPDF + html2canvas

**No gaps in core flow.**

---

## 5. Bill History & Reprinting 🔶

**Complete:**
- `Bills.tsx` — list all bills with date, customer, amount filters
- Bill detail view with full item breakdown
- Reprint thermal bill from history

**Gaps:**
- 🔶 No bill void / cancellation flow (only returns exist)
- 🔶 No edit-after-creation (bills are immutable once saved — correct by design, but no UI note)
- 🔶 Bill search by bill number not surfaced prominently

---

## 6. Customer Management 🔶

**Complete:**
- `Customers.tsx` — list, search, add, edit customers
- `total_purchase` and `total_due` auto-incremented on bill creation (fixed: removed double-update bug)
- Last purchase date tracked
- Customer detail view with purchase history

**Gaps:**
- 🔶 No customer statement / ledger printout
- 🔶 No customer-wise sales report export
- 🔶 Bulk import (CSV) not available

---

## 7. Due Management ✅

- `DueManagement.tsx` — lists all customers with outstanding dues
- Record payment against due
- Due amount updates correctly after payment (direct increment fix applied)
- WhatsApp reminder link per customer

**No critical gaps.**

---

## 8. Returns & Exchanges 🔶

**Complete:**
- `Returns.tsx` — return flow against existing bill
- Stock quantity restored on return
- `returns` and `return_items` tables with RLS
- Inventory movement logged as `return_in`

**Gaps:**
- 🔶 Exchange flow (`exchanges`, `exchange_items` tables exist in schema and types, but `Exchanges.tsx` page is not built)
- 🔶 Partial return (returning some items from a bill) needs more testing
- 🔶 No return receipt printout

---

## 9. Reports & Analytics 🔶

**Complete:**
- `Reports.tsx` — daily/weekly/monthly sales summary
- Top-selling products
- Low-stock alert list (fixed: `lowStock` state type fixed, client-side filter applied)
- Sales trend chart (via Recharts)

**Gaps:**
- 🔶 No GST report / GSTR-1 summary export
- 🔶 No supplier-wise purchase report
- 🔶 No profit margin report (requires cost price vs selling price tracking)
- 🔶 Export to Excel/CSV missing
- 🔶 Cross-shop consolidated report not available

---

## 10. Settings 🔶

**Complete:**
- `Settings.tsx` — shop name, address, contact, UPI ID
- Dark mode toggle (`useDarkMode` hook, `darkMode: 'class'` in Tailwind)
- Bill prefix and barcode prefix per shop
- GST number field

**Gaps:**
- 🔶 Logo upload for bill header not implemented
- 🔶 Bill footer / terms & conditions customization missing
- 🔶 Tax rate presets not configurable from UI (fixed in schema, editable only via DB)
- 🔶 Sequence reset UI (reset bill/barcode counter for new financial year) — SQL functions exist (`reset_bill_sequence`, `reset_barcode_sequence`) but no UI

---

## 11. Supplier Management ❌

- `suppliers` table exists in schema and types (`Supplier` type defined)
- No `Suppliers.tsx` page built
- No purchase order flow
- No supplier ledger or payment tracking

**Entire module to build.**

---

## 12. Activity Log ❌

- `activity_logs` table exists in schema (`ActivityLog` type defined)
- No writes to this table from the application yet
- No `ActivityLog.tsx` page to view history

**Entire module to build.**

---

## 13. Multi-Shop Inventory Sync ❌

- Both shops have fully separate inventory (by design — each shop has its own `owner_id`-scoped products)
- No stock transfer between NANDARANI BASTRALAY ↔ NEW NANDARANI BASTRALAY
- No consolidated stock view across both shops

**To build:** stock transfer UI + `inventory_movements` entry of type `transfer_out` / `transfer_in`.

---

## 14. Barcode Scanner Input ❌

- JsBarcode generates barcodes correctly
- No USB/Bluetooth barcode scanner input handler in POS
- Manual product search is the only input method

**To build:** `keydown` listener in POS that accumulates rapid digit input (scanner behavior) and triggers `products.getByBarcode()` lookup.

---

## 15. Offline / PWA Support ❌

- App is fully online-only (direct Supabase calls)
- No service worker, no IndexedDB cart persistence
- No offline bill queue

**Low priority for garment retail — shop has reliable internet. Skip unless requested.**

---

## 16. Role-Based Access Control ❌

- Currently single-owner model (all data scoped to `auth.uid()`)
- No staff/cashier accounts with restricted permissions
- No audit trail of who performed which action

**To build if multi-staff operation is needed.**

---

## 17. Database & Infrastructure ✅

- `supabase-schema.sql` (564 lines) — complete 17-table schema
- RLS policies on all tables scoping data via `owner_id = auth.uid()` through shop join
- Atomic sequences: `get_next_bill_number`, `get_next_barcode` (SECURITY DEFINER, no RLS bypass needed)
- `setup_initial_shops` RPC exists as fallback; JS layer `createDefaultShops()` is primary
- `bill_sequences` and `barcode_sequences` use `shop_id` as PRIMARY KEY

**No gaps in schema for implemented features.**

---

## Bug Fixes Applied This Session

| # | File | Bug | Status |
|---|------|-----|--------|
| 1 | `database.ts` | `products.list()` lowStock filter used illegal `supabase.rpc` cast | ✅ Fixed |
| 2 | `database.ts` | `customers.updateTotals()` double-counted totals (RPC + direct update) | ✅ Fixed |
| 3 | `database.ts` | `createDefaultShops()` crashed on retry due to PK constraint | ✅ Fixed (upsert) |
| 4 | `database.ts` | Shop upsert by `bill_prefix` on retry — safe re-entry | ✅ Fixed |
| 5 | `authStore.ts` | `fetchProfile` had no try-catch — `initialized` never set on error | ✅ Fixed |
| 6 | `shopStore.ts` | `fetchShops` had no error handling — dashboard spun forever | ✅ Fixed |
| 7 | `shopStore.ts` | `setActiveShop` settings fetch crash blocked shop activation | ✅ Fixed |
| 8 | `Layout.tsx` | No error state — no way to recover from shop load failure | ✅ Fixed |
| 9 | `POS.tsx` | GST calculated pre-discount; `total_amount` excluded GST | ✅ Fixed |
| 10 | `POS.tsx` | UPI QR `useEffect` used unstable `getGrandTotal()` as dependency | ✅ Fixed |
| 11 | `Reports.tsx` | `lowStock` TypeScript type was `never[]` — broke inference | ✅ Fixed |

---

## Recommended Next Steps (Priority Order)

1. **Supplier module** — purchase orders, receiving stock, supplier payments
2. **Sequence reset UI** — new financial year bill/barcode counter reset
3. **GST report export** — monthly GSTR-1 summary as PDF/Excel
4. **Barcode scanner input** — keyboard wedge scanner support in POS
5. **Exchange flow** — complete `Exchanges.tsx` (schema already ready)
6. **Activity log writes + view** — audit trail for all mutations
7. **Stock transfer between shops** — with movement log
8. **Bill void / cancellation** — with reason and stock reversal
9. **Bulk product CSV import**
10. **Customer statement printout**
