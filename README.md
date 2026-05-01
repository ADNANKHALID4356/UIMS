# Universal Inventory Management System (UIMS) - Complete Technical Overview

Version: 2.0.0 (Production Ready)
Platform: Windows Desktop (Electron)
Repo: https://github.com/ADNANKHALID4356/UIMS
Current State: Full enterprise app with multi-industry support (Agriculture, Medicine, Property, Grains, Dealers, Commissions)

## 🎯 App Overview

**UIMS** is a comprehensive desktop inventory and financial management system for multiple industries. Features double-entry ledger, multi-item transactions, entity management, reports, backups, auth. Offline SQLite DB.

**Key Evolution:**
- Started as Agricultural Inventory
- Expanded to Universal (added Medicine/Prescriptions/ControlledSubstances, Property Listings, Commissions, Companies, Grains)
- Restructured frontend (src/frontend), backend IPC handlers (24+), services (25+)
- Latest commit: b2e13a9 - Added new modules/pages/scripts

## 🏗️ Complete File Structure (Current State)

```
c:/Inventory/Inventory_management_system/ais/
├── .babelrc, .eslintrc.cjs, .prettierrc, .gitignore
├── package.json (Electron 33, React 18, Vite 5, Tailwind 3, Redux Toolkit, better-sqlite3, bcrypt)
├── tailwind.config.js, vite.config.js, postcss.config.js
├── index.html, LICENSE.txt
├── fix_irregular_entity_table.py, fix_reversal_entries.sql, replace-alerts.js
├── assets/ (logo.png, icon-256.png)
├── docs/ (5 MD files: api-reference, developer-guide, installation, project-overview, user-guide)
├── release/ (build outputs)
├── scripts/ (10+ utils: __check_users.mjs, cleanup_user_data.js, electron-reset-password.js, fix-setup.js, inject-admin.js, inspect-db.js)
├── src/
│   ├── backend/ (Electron main)
│   │   ├── main.js (app ready, createWindow, license/DB init)
│   │   ├── preload.js (contextBridge)
│   │   └── ipc/
│   │       ├── index.js (registerIPCHandlers)
│   │       └── handlers/ (24 handlers: Auth, Backup, Commission, Company, ControlledSubstance, Database, Dealer, Farmer, Grain, History, Ledger, License, MedicineBatch, Organization, Prescription, ProductCategory, Product, Property, Report, Stock, System, Transaction, TransactionV2, UserManagement)
│   ├── frontend/ (React Vite app)
│   │   ├── App.jsx (Router/PermissionGate/MainLayout)
│   │   ├── main.jsx (ReactDOM)
│   │   ├── index.css (Tailwind)
│   │   ├── components/ (Breadcrumb, ExportService, MainLayout, PermissionGate, Sidebar, useKeyboardShortcuts, common/Toast, transaction/MultiItemTransactionForm)
│   │   └── pages/ (29 pages: Backup, Commissions, Companies, DashboardPageV2, Dealers, EditTransaction, Entities, EntityLedger, Farmers, FirstRunSetup, Grains, History, IndustrySetupWizard, LicenseActivation, Loading, Login, MedicineBatches, Placeholder, Prescriptions, ProductCategories, Products, PropertyListings, Reports, Settings, StockMovements, TransactionDetails, Transactions, UniversalTransaction, UserManagement)
│   │   └── store/ (hooks.js, store.js, slices/ 12: auth, company, dealer, farmer, grain, history, organization, productCategory, product, stock, transaction, ui)
│   ├── main/ (Legacy/backup IPC: main.js, preload.js, ipc/index.js, handlers/Auth Company Database Dealer Farmer License Organization System Transaction)
│   └── services/ (25 services)
│       ├── auth/ (AuthService, PermissionsService)
│       ├── backup/ (BackupService, DataArchiveService)
│       ├── commission/ (CommissionService)
│       ├── company/ (CompanyService)
│       ├── database/ (DatabaseService)
│       ├── dealer/ (DealerService)
│       ├── farmer/ (FarmerService)
│       ├── grain/ (GrainService)
│       ├── history/ (HistoryService)
│       ├── ledger/ (LedgerService)
│       ├── license/ (HardwareService, LicenseService)
│       ├── medicine/ (ControlledSubstanceService, MedicineBatchService)
│       ├── organization/ (industryConfigs, OrganizationService)
│       ├── prescription/ (PrescriptionService)
│       ├── product/ (ProductCategoryService, ProductService)
│       ├── property/ (PropertyService)
│       ├── report/ (ReportService)
│       ├── stock/ (StockService)
│       └── transaction/ (TransactionEditService, TransactionService, TransactionServiceV2)
├── tests/ (empty)
```

## 🔧 Technical Details

**Frontend**: React 18 Router v6 Redux Toolkit TailwindCSS Vite HMR. State slices for each domain. PermissionGate RBAC.

**Backend**: Electron 33 Node.js better-sqlite3 WAL mode. Secure IPC (preload/contextIsolation). Single-instance lock.

**Database**: SQLite tables: users, entities, product_categories, products, transactions, transaction_items, ledger_entries, stock_movements (+ industry-specific).

**IPC Pattern**: window.electronAPI.[module].[method](data) → handler → service → DB.

**Build**: npm run dev:app (concurrent backend/frontend/electron). npm run package:win (electron-builder NSIS/portable).

**App Flow**: Loading → License → Login → DashboardV2 → Modules.

## 🚀 Developer Onboarding (5 min)

1. `npm install` (deps: React/Electron/SQLite etc.)
2. `npm run dev:app` (http://localhost:5173 + Electron)
3. DevTools F12, DB inspect via scripts/inspect-db.js
4. Build: `npm run package:win`

**Data Location**: %AppData%/ais/database.sqlite

## 📊 Current App State (Post b2e13a9)

- **New Modules**: Commission, MedicineBatches/Prescriptions/ControlledSubstances, PropertyListings, Companies, Grains, Organizations
- **New Pages**: 15+ (DashboardV2, Entities, UserManagement, IndustrySetupWizard, etc.)
- **New Services/IPC**: Matching new domains
- **Restructured**: src/frontend from src/renderer, backend ipc expanded
- **Scripts**: Admin injection, DB fix, user cleanup
- **Ready**: Run/test/build/deploy

## 🧪 Testing

- Jest configured (tests/ empty)
- Manual: npm run dev, test pages/IPC/DB ops
- Edge: Low stock, multi-user, large txns

## 🔮 Next Steps Suggestion

1. TypeScript migration
2. Jest coverage
3. Cross-platform (Mac/Linux)
4. PDF/Excel exports enhancement
5. Dark mode

**Built for multi-industry inventory mastery. Questions? Review docs/ + code.**


