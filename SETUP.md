# Nandarani POS — Complete Setup Guide

## Project Overview
Full-stack POS billing + inventory management for:
- **NANDARANI BASTRALAY** (Prefix: NB)
- **NEW NANDARANI BASTRALAY** (Prefix: NBN)

---

## 1. Supabase Setup

### Step 1: Create Supabase Project
1. Go to https://supabase.com and create a new project
2. Note your **Project URL** and **anon key** from Settings → API

### Step 2: Run Database Schema
1. Go to **SQL Editor** in your Supabase project
2. Open the file `supabase-schema.sql` from this project
3. **Paste and run the entire file**
4. This creates all 17 tables, functions, triggers, and RLS policies

### Step 3: Set Auth Settings
1. Go to **Authentication → Settings**
2. Set Site URL: `http://localhost:3000` (dev) or your domain (prod)
3. Optionally disable email confirmations for easier testing

---

## 2. Project Setup

### Step 1: Install Dependencies
```bash
cd nandarani-pos
npm install
```

### Step 2: Environment Variables
Create a `.env` file (copy from `.env.example`):
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 3: Run Development Server
```bash
npm run dev
```
App runs at http://localhost:3000

### Step 4: Build for Production
```bash
npm run build
```

---

## 3. First-Time Usage

### Create Your Account
1. Open the app and click **Sign up**
2. Use your email (aniksahoo112007@gmail.com recommended)
3. Set a strong password
4. **Both shops are created automatically** on first signup

### Initial Shop Setup
1. Go to **Settings** (for each shop)
2. Fill in:
   - Shop address and contact
   - UPI ID for online payments
   - GST number (if applicable)
   - Biller names
   - Bill footer text

### Add Products
1. Go to **Add Product / Barcode**
2. Fill in product details
3. Barcode is auto-generated (NB-000001 or NBN-000001)
4. Download/print barcode labels

---

## 4. Project Structure

```
nandarani-pos/
├── supabase-schema.sql          # Complete database schema
├── SETUP.md                     # This file
├── .env.example                 # Environment template
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── index.html
└── src/
    ├── main.tsx                 # Entry point
    ├── App.tsx                  # Router + auth init
    ├── types/
    │   └── index.ts             # All TypeScript types
    ├── lib/
    │   ├── supabase.ts          # Supabase client
    │   ├── database.ts          # DB helper functions
    │   └── utils.ts             # Utility functions
    ├── store/
    │   ├── authStore.ts         # Auth state (Zustand)
    │   ├── shopStore.ts         # Shop switcher state
    │   └── cartStore.ts         # POS cart state
    ├── hooks/
    │   ├── useDarkMode.ts       # Dark/light mode
    │   └── useShopName.ts       # Page title helper
    ├── components/
    │   ├── layout/
    │   │   ├── Layout.tsx       # Main app shell
    │   │   └── Sidebar.tsx      # Navigation sidebar
    │   ├── pos/
    │   │   └── ThermalBill.tsx  # 80mm bill template
    │   └── ui/
    │       └── index.tsx        # Shared UI components
    ├── pages/
    │   ├── Login.tsx            # Auth page
    │   ├── Dashboard.tsx        # Analytics dashboard
    │   ├── POS.tsx              # Billing screen
    │   ├── AddProduct.tsx       # Product + barcode generator
    │   ├── Inventory.tsx        # Stock management
    │   ├── Customers.tsx        # Customer CRM
    │   ├── Bills.tsx            # Bill history
    │   ├── DueManagement.tsx    # Due collection
    │   ├── Returns.tsx          # Returns & exchanges
    │   ├── Reports.tsx          # Analytics & exports
    │   └── Settings.tsx         # Shop configuration
    └── styles/
        └── global.css           # Tailwind + thermal print CSS
```

---

## 5. Key Features & How They Work

### Barcode System
- Barcodes auto-generate as: `NB-000001`, `NB-000002`, etc.
- Format: **CODE128** (works with any scanner)
- Print: PNG download or A4 PDF sheet
- Scan in POS: type in barcode field and press Enter

### POS Billing
- **Barcode scan**: type/scan barcode → auto-adds product
- **Product search**: type name → dropdown with results
- **Bill types**: Normal (no GST) or GST (shows CGST/SGST)
- **Checkout types**: Offline or Online (generates UPI QR)
- **Payment**: Full, partial, or due — all tracked
- **After checkout**: Print, PDF, or WhatsApp share

### Thermal Printing
- Optimized for **80mm thermal roll** printers
- Use browser print (`Ctrl+P`) → set paper size to 80mm
- Or download PDF and print

### UPI QR Code
- Set UPI ID in Settings
- Online checkout generates a scannable QR for exact amount
- QR prints on the bill

### WhatsApp Sharing
- Bill summary sent via `wa.me/916296240320`
- Due reminders sent from customer profile or Due Management
- Uses WhatsApp Web (no API needed)

### Stock Management
- Stock deducts automatically on checkout
- Stock restores on return/exchange
- Stock can never go below 0
- Low stock alerts on dashboard

---

## 6. Database Tables Reference

| Table | Purpose |
|-------|---------|
| `profiles` | User accounts |
| `shops` | 2 shop configs |
| `shop_settings` | Per-shop preferences |
| `bill_sequences` | Auto-increment bill numbers |
| `barcode_sequences` | Auto-increment barcodes |
| `products` | Product catalog |
| `inventory_movements` | Stock in/out history |
| `customers` | Customer directory |
| `bills` | Bill headers |
| `bill_items` | Line items per bill |
| `payments` | Payment records |
| `returns` | Return transactions |
| `return_items` | Items per return |
| `exchanges` | Exchange transactions |
| `exchange_items` | Items per exchange |
| `suppliers` | Supplier directory |
| `activity_logs` | Audit trail |

---

## 7. Business Numbers (Pre-configured)

- Normal bill contact: **9933426708**
- WhatsApp: **6296240320**
- WhatsApp format: `916296240320`
- Shop 1: NANDARANI BASTRALAY (NB)
- Shop 2: NEW NANDARANI BASTRALAY (NBN)

---

## 8. Deployment (Vercel/Netlify)

```bash
# Build
npm run build

# Deploy dist/ folder to Vercel or Netlify
# Set environment variables in dashboard:
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_ANON_KEY=...
```

For Supabase production:
1. Update Auth → Site URL to your production domain
2. Add domain to Auth → Redirect URLs

---

## 9. Keyboard Shortcuts (POS)

| Key | Action |
|-----|--------|
| Focus barcode input | Auto-focus on page load |
| Enter (in barcode) | Scan product |
| Escape | Clear search results |

---

## 10. Troubleshooting

**"Missing Supabase environment variables"**
→ Check your `.env` file has both variables

**Products not appearing in POS search**
→ Ensure products are added to the correct shop (check shop switcher)

**Barcode not scanning**
→ Check barcode format is CODE128, try manual entry

**Bill number starts from wrong number**
→ Go to Settings → Reset Bill Sequence

**Stock went negative**
→ Use Stock Adjustment in Inventory to correct it

---

Built with ❤️ for Nandarani Bastralay
