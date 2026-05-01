# API Reference

## Overview

This document describes the internal API structure used for communication between the frontend (renderer process) and backend (main process) via Electron's IPC (Inter-Process Communication).

## Architecture

```
Frontend → window.electronAPI → IPC → Handler → Service → Database
```

## API Categories

- [Authentication](#authentication-api)
- [Products](#products-api)
- [Categories](#categories-api)
- [Entities](#entities-api)
- [Transactions](#transactions-api)
- [Ledger](#ledger-api)
- [Users](#users-api)
- [Reports](#reports-api)
- [System](#system-api)

---

## Authentication API

### Login

**Method**: `window.electronAPI.auth.login(credentials)`

**Parameters**:
```javascript
{
  username: string,
  password: string
}
```

**Returns**:
```javascript
{
  success: boolean,
  user?: {
    id: number,
    username: string,
    full_name: string,
    role: string
  },
  error?: string
}
```

### Logout

**Method**: `window.electronAPI.auth.logout()`

**Returns**: `{ success: boolean }`

### Change Password

**Method**: `window.electronAPI.auth.changePassword(data)`

**Parameters**:
```javascript
{
  userId: number,
  oldPassword: string,
  newPassword: string
}
```

---

## Products API

### Get All Products

**Method**: `window.electronAPI.products.getAll()`

**Returns**:
```javascript
{
  success: boolean,
  data?: Array<{
    id: number,
    name: string,
    category_id: number,
    category_name: string,
    description: string,
    unit: string,
    stock_quantity: number,
    created_at: string
  }>,
  error?: string
}
```

### Get Product by ID

**Method**: `window.electronAPI.products.getById(id)`

**Parameters**: `id: number`

**Returns**: Single product object

### Create Product

**Method**: `window.electronAPI.products.create(productData)`

**Parameters**:
```javascript
{
  name: string,
  category_id: number,
  description: string,
  unit: string,
  stock_quantity: number
}
```

**Returns**:
```javascript
{
  success: boolean,
  data?: { id: number },
  error?: string
}
```

### Update Product

**Method**: `window.electronAPI.products.update(id, productData)`

**Parameters**:
- `id: number`
- `productData: Partial<ProductData>`

### Delete Product

**Method**: `window.electronAPI.products.delete(id)`

**Parameters**: `id: number`

**Returns**: `{ success: boolean, error?: string }`

---

## Categories API

### Get All Categories

**Method**: `window.electronAPI.categories.getAll()`

**Returns**:
```javascript
{
  success: boolean,
  data?: Array<{
    id: number,
    name: string,
    description: string,
    product_count: number,
    created_at: string
  }>
}
```

### Create Category

**Method**: `window.electronAPI.categories.create(data)`

**Parameters**:
```javascript
{
  name: string,
  description: string
}
```

### Update Category

**Method**: `window.electronAPI.categories.update(id, data)`

### Delete Category

**Method**: `window.electronAPI.categories.delete(id)`

**Note**: Cannot delete categories with associated products

---

## Entities API

### Get All Entities

**Method**: `window.electronAPI.entities.getAll(type)`

**Parameters**: `type: 'farmer' | 'supplier' | 'customer' | 'all'`

**Returns**:
```javascript
{
  success: boolean,
  data?: Array<{
    id: number,
    type: string,
    name: string,
    contact: string,
    address: string,
    cnic: string,
    balance: number,
    created_at: string
  }>
}
```

### Create Entity

**Method**: `window.electronAPI.entities.create(data)`

**Parameters**:
```javascript
{
  type: 'farmer' | 'supplier' | 'customer',
  name: string,
  contact: string,
  address: string,
  cnic: string
}
```

### Update Entity

**Method**: `window.electronAPI.entities.update(id, data)`

### Delete Entity

**Method**: `window.electronAPI.entities.delete(id)`

### Get Entity Ledger

**Method**: `window.electronAPI.entities.getLedger(id, options)`

**Parameters**:
```javascript
{
  id: number,
  startDate?: string,
  endDate?: string
}
```

**Returns**: Array of ledger entries with balance

---

## Transactions API

### Get All Transactions

**Method**: `window.electronAPI.transactions.getAll(filters)`

**Parameters**:
```javascript
{
  type?: 'sale' | 'purchase' | 'payment',
  entityId?: number,
  startDate?: string,
  endDate?: string,
  limit?: number,
  offset?: number
}
```

**Returns**:
```javascript
{
  success: boolean,
  data?: Array<{
    id: number,
    entity_id: number,
    entity_name: string,
    type: string,
    amount: number,
    description: string,
    created_by: number,
    created_by_name: string,
    created_at: string,
    items?: Array<TransactionItem>
  }>,
  total?: number
}
```

### Get Transaction by ID

**Method**: `window.electronAPI.transactions.getById(id)`

**Returns**: Transaction with items and entity details

### Create Transaction

**Method**: `window.electronAPI.transactions.create(data)`

**Parameters**:
```javascript
{
  entity_id: number,
  type: 'sale' | 'purchase' | 'payment',
  amount: number,
  description: string,
  items?: Array<{
    product_id: number,
    quantity: number,
    price: number
  }>,
  created_by: number
}
```

**Note**: For sale/purchase transactions, items array is required

### Update Transaction

**Method**: `window.electronAPI.transactions.update(id, data)`

**Note**: Some fields may be immutable after creation

### Delete Transaction

**Method**: `window.electronAPI.transactions.delete(id)`

**Note**: Reverses ledger entries and stock movements

---

## Ledger API

### Get Ledger Entries

**Method**: `window.electronAPI.ledger.getEntries(filters)`

**Parameters**:
```javascript
{
  entityId?: number,
  transactionId?: number,
  startDate?: string,
  endDate?: string,
  type?: 'debit' | 'credit'
}
```

**Returns**:
```javascript
{
  success: boolean,
  data?: Array<{
    id: number,
    entity_id: number,
    entity_name: string,
    transaction_id: number,
    type: 'debit' | 'credit',
    amount: number,
    balance: number,
    description: string,
    created_at: string
  }>
}
```

### Get Entity Balance

**Method**: `window.electronAPI.ledger.getBalance(entityId)`

**Parameters**: `entityId: number`

**Returns**:
```javascript
{
  success: boolean,
  data?: {
    entity_id: number,
    balance: number,
    total_debit: number,
    total_credit: number
  }
}
```

---

## Users API

### Get All Users

**Method**: `window.electronAPI.users.getAll()`

**Returns**: Array of users (passwords excluded)

### Create User

**Method**: `window.electronAPI.users.create(data)`

**Parameters**:
```javascript
{
  username: string,
  password: string,
  full_name: string,
  email: string,
  role: 'admin' | 'user'
}
```

### Update User

**Method**: `window.electronAPI.users.update(id, data)`

### Delete User

**Method**: `window.electronAPI.users.delete(id)`

**Note**: Cannot delete your own account or last admin

### Reset Password

**Method**: `window.electronAPI.users.resetPassword(userId, newPassword)`

---

## Reports API

### Get Inventory Report

**Method**: `window.electronAPI.reports.inventory(filters)`

**Parameters**:
```javascript
{
  categoryId?: number,
  lowStockOnly?: boolean
}
```

### Get Transaction Report

**Method**: `window.electronAPI.reports.transactions(filters)`

**Parameters**:
```javascript
{
  type?: string,
  startDate: string,
  endDate: string,
  entityId?: number
}
```

### Get Entity Report

**Method**: `window.electronAPI.reports.entities(filters)`

**Parameters**:
```javascript
{
  type?: 'farmer' | 'supplier' | 'customer',
  includeBalance: boolean
}
```

---

## System API

### Get System Info

**Method**: `window.electronAPI.system.getInfo()`

**Returns**:
```javascript
{
  platform: string,
  arch: string,
  nodeVersion: string,
  appVersion: string
}
```

### Get Database Stats

**Method**: `window.electronAPI.system.getDatabaseStats()`

**Returns**:
```javascript
{
  totalProducts: number,
  totalEntities: number,
  totalTransactions: number,
  databaseSize: number
}
```

### Create Backup

**Method**: `window.electronAPI.system.createBackup(path)`

**Parameters**: `path: string` - Destination path for backup file

### Restore Backup

**Method**: `window.electronAPI.system.restoreBackup(path)`

**Parameters**: `path: string` - Path to backup file

---

## Error Handling

All API calls return responses in a consistent format:

**Success Response**:
```javascript
{
  success: true,
  data: <result>
}
```

**Error Response**:
```javascript
{
  success: false,
  error: "Error message"
}
```

### Common Error Codes

- **VALIDATION_ERROR**: Invalid input data
- **NOT_FOUND**: Resource not found
- **DUPLICATE_ENTRY**: Unique constraint violation
- **FOREIGN_KEY_CONSTRAINT**: Referenced entity doesn't exist
- **PERMISSION_DENIED**: Insufficient privileges
- **DATABASE_ERROR**: Database operation failed

### Frontend Error Handling Example

```javascript
try {
  const result = await window.electronAPI.products.create(data);
  
  if (result.success) {
    console.log('Product created:', result.data);
  } else {
    console.error('Error:', result.error);
    // Show error message to user
  }
} catch (error) {
  console.error('Unexpected error:', error);
  // Show generic error message
}
```

---

## Usage Examples

### Creating a Multi-Item Transaction

```javascript
const transactionData = {
  entity_id: 5,
  type: 'sale',
  description: 'Bulk seed purchase',
  created_by: currentUser.id,
  items: [
    { product_id: 1, quantity: 50, price: 100 },
    { product_id: 2, quantity: 30, price: 150 }
  ]
};

// Calculate total amount
transactionData.amount = transactionData.items.reduce(
  (sum, item) => sum + (item.quantity * item.price),
  0
);

const result = await window.electronAPI.transactions.create(transactionData);
```

### Fetching Entity Ledger

```javascript
const ledgerData = await window.electronAPI.entities.getLedger(
  entityId,
  {
    startDate: '2026-01-01',
    endDate: '2026-01-31'
  }
);

console.log('Ledger entries:', ledgerData.data);
console.log('Current balance:', ledgerData.data[ledgerData.data.length - 1]?.balance);
```

### Generating Report

```javascript
const report = await window.electronAPI.reports.transactions({
  type: 'sale',
  startDate: '2026-01-01',
  endDate: '2026-01-31'
});

console.log('Total sales:', report.data.totalAmount);
console.log('Transaction count:', report.data.count);
```

---

## Service Layer Architecture

### Backend Services

All business logic is encapsulated in service classes located in `src/services/`:

```
src/services/
├── auth/
│   └── AuthService.js          # User authentication and session management
├── backup/
│   ├── BackupService.js        # Database backup creation and restoration
│   └── DataArchiveService.js   # Historical data archiving
├── company/
│   └── CompanyService.js       # Company/entity categorization
├── database/
│   └── DatabaseService.js      # Database connection and initialization
├── dealer/
│   └── DealerService.js        # Supplier/dealer management
├── farmer/
│   └── FarmerService.js        # Farmer/customer entity management
├── grain/
│   └── GrainService.js         # Product/grain type management
├── ledger/
│   └── LedgerService.js        # Double-entry bookkeeping ledger
├── license/
│   ├── LicenseService.js       # License validation and activation
│   └── HardwareService.js      # Hardware ID generation
├── product/
│   ├── ProductService.js       # Product CRUD operations
│   └── ProductCategoryService.js # Category management
├── report/
│   └── ReportService.js        # Report generation and analytics
├── stock/
│   └── StockService.js         # Inventory stock management
└── transaction/
    ├── TransactionService.js       # Basic transaction operations
    ├── TransactionServiceV2.js     # Enhanced multi-item transactions
    └── TransactionEditService.js   # Transaction modification logic
```

### Service Layer Patterns

All services follow consistent patterns:

**1. Constructor Pattern**:
```javascript
class ExampleService {
  constructor(db) {
    this.db = db; // SQLite database instance
  }
}
```

**2. Method Naming Conventions**:
- `getAll()` - Retrieve all records
- `getById(id)` - Retrieve single record
- `create(data)` - Insert new record
- `update(id, data)` - Modify existing record
- `delete(id)` - Remove record

**3. Error Handling**:
```javascript
try {
  const result = service.methodName(params);
  return { success: true, data: result };
} catch (error) {
  console.error('Service error:', error);
  return { success: false, error: error.message };
}
```

### IPC Handler Architecture

IPC handlers bridge frontend and backend via Electron's IPC:

```
src/backend/ipc/handlers/
├── AuthIPCHandler.js           # Authentication endpoints
├── BackupIPCHandler.js         # Backup operations
├── CompanyIPCHandler.js        # Company management
├── DatabaseIPCHandler.js       # Database utilities
├── DealerIPCHandler.js         # Dealer operations
├── FarmerIPCHandler.js         # Farmer operations
├── GrainIPCHandler.js          # Product operations
├── LedgerIPCHandler.js         # Ledger queries
├── LicenseIPCHandler.js        # License validation
├── ProductCategoryIPCHandler.js # Category management
├── ProductIPCHandler.js        # Product management
├── ReportIPCHandler.js         # Report generation
├── StockIPCHandler.js          # Stock operations
├── SystemIPCHandler.js         # System information
├── TransactionIPCHandler.js    # Transaction operations
└── TransactionV2IPCHandler.js  # Enhanced transactions
```

**Handler Registration Pattern**:
```javascript
// src/backend/ipc/handlers/ExampleIPCHandler.js
const { ipcMain } = require('electron');

class ExampleIPCHandler {
  constructor(service) {
    this.service = service;
  }

  register() {
    ipcMain.handle('example:getAll', async () => {
      return await this.service.getAll();
    });
    
    ipcMain.handle('example:create', async (event, data) => {
      return await this.service.create(data);
    });
  }
}
```

### Database Schema

Complete SQLite schema located in `src/services/database/DatabaseService.js`:

```sql
-- Users Table
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Entities Table (Farmers, Suppliers, Customers)
CREATE TABLE entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  contact TEXT,
  address TEXT,
  cnic TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Product Categories
CREATE TABLE product_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Products
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category_id INTEGER,
  description TEXT,
  unit TEXT DEFAULT 'kg',
  stock_quantity REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES product_categories(id)
);

-- Transactions
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entity_id) REFERENCES entities(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Transaction Items (Multi-item transactions)
CREATE TABLE transaction_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity REAL NOT NULL,
  price REAL NOT NULL,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Ledger Entries (Double-entry bookkeeping)
CREATE TABLE ledger_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id INTEGER NOT NULL,
  transaction_id INTEGER,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  balance REAL NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entity_id) REFERENCES entities(id),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

-- Stock Movements
CREATE TABLE stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  transaction_id INTEGER,
  type TEXT NOT NULL,
  quantity REAL NOT NULL,
  balance REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);
```

### Frontend State Management

Redux Toolkit slices in `src/frontend/store/slices/`:

```javascript
// Example slice pattern
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export const fetchItems = createAsyncThunk(
  'example/fetchItems',
  async () => {
    const response = await window.electronAPI.example.getAll();
    if (!response.success) throw new Error(response.error);
    return response.data;
  }
);

const exampleSlice = createSlice({
  name: 'example',
  initialState: {
    items: [],
    loading: false,
    error: null
  },
  reducers: {
    clearError: (state) => { state.error = null; }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchItems.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchItems.fulfilled, (state, action) => {
        state.items = action.payload;
        state.loading = false;
      })
      .addCase(fetchItems.rejected, (state, action) => {
        state.error = action.error.message;
        state.loading = false;
      });
  }
});
```

## Notes

- All dates should be in ISO format (YYYY-MM-DD or full ISO string)
- Numeric IDs are integers
- Prices and amounts are stored as numbers (not strings)
- All API calls are asynchronous (return Promises)
- API is only available in the renderer process via `window.electronAPI`
- Unauthorized calls will return permission errors
- Services use better-sqlite3 for synchronous database operations
- IPC handlers use async/await patterns for cleaner code
- Redux Toolkit manages all frontend state with normalized data structures
