# Developer Guide

## Development Environment Setup

### Prerequisites

- Node.js 18+ and npm 9+
- Git
- Windows 10/11 (for Electron development)
- Code editor (VS Code recommended)

### Initial Setup

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/agricultural-inventory-system.git
cd agricultural-inventory-system

# Install dependencies
npm install

# Run in development mode
npm run dev
```

## Project Architecture

### Overview

The application follows a modular architecture with clear separation of concerns:

```
Frontend (React) ↔ IPC ↔ Backend (Electron Main) ↔ Services ↔ Database (SQLite)
```

### Directory Structure

```
ais/
├── src/
│   ├── backend/              # Electron main process
│   │   ├── ipc/             # IPC handlers
│   │   ├── main.js          # Entry point
│   │   └── preload.js       # Preload script
│   │
│   ├── frontend/            # React application
│   │   ├── pages/          # Page components
│   │   ├── components/     # Reusable components
│   │   ├── store/          # Redux store
│   │   │   └── slices/    # Redux slices
│   │   ├── App.jsx         # Root component
│   │   └── main.jsx        # Entry point
│   │
│   └── services/           # Business logic
│       ├── auth/          # Authentication
│       ├── database/      # Database operations
│       ├── product/       # Product management
│       ├── transaction/   # Transaction handling
│       └── ...
│
├── docs/                   # Documentation
├── package.json           # Dependencies
├── index.html            # HTML template
├── vite.config.js        # Vite configuration
├── tailwind.config.js    # TailwindCSS config
└── .babelrc             # Babel configuration
```

## Getting Started

### Prerequisites

Before you begin, ensure you have:
- **Node.js**: Version 18.x or higher ([Download](https://nodejs.org/))
- **npm**: Version 9.x or higher (comes with Node.js)
- **Git**: For cloning the repository
- **VS Code**: Recommended IDE with ESLint extension

### Initial Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/agricultural-inventory-system.git
   cd agricultural-inventory-system
   ```

2. **Install dependencies** (First time only - takes 2-3 minutes):
   ```bash
   npm install
   ```
   
   This command:
   - Reads `package.json` to know what packages are needed
   - Downloads ~200-300 MB of dependencies into `node_modules/` folder
   - Installs platform-specific binaries (Electron, SQLite, etc.)
   - Creates `package-lock.json` for exact version locking
   
   **Important**: You only need to run this once, or when dependencies change.

3. **Run in development mode**:
   ```bash
   npm run dev
   ```
   
   This starts:
   - Vite dev server on http://localhost:5173
   - Electron app with hot reload
   - Auto-opens the application window
   
   Changes to frontend code will automatically reload the app.

4. **Build for production** (when ready):
   ```bash
   npm run build
   ```

## Key Technologies

### Frontend Stack

- **React 18**: UI framework
- **Redux Toolkit**: State management
- **React Router v6**: Routing
- **TailwindCSS**: Styling
- **Vite**: Build tool and dev server

### Backend Stack

- **Electron 33**: Desktop framework
- **Node.js**: Runtime environment
- **SQLite3**: Database
- **better-sqlite3**: Database driver
- **bcrypt**: Password hashing

## Development Workflow

### Running Development Server

```bash
npm run dev
```

This starts:
- Vite dev server for frontend (hot reload)
- Electron main process
- Auto-reload on backend changes

### Building for Production

```bash
# Build frontend and backend
npm run build

# Create installer package
npm run package
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build production code
- `npm run package` - Create installer
- `npm run test` - Run tests (manual)

## Code Structure

### Backend (Electron Main Process)

**main.js**
```javascript
// Application lifecycle management
// Window creation
// IPC setup
```

**preload.js**
```javascript
// Exposes IPC APIs to renderer
// Security bridge between main and renderer
```

**IPC Handlers** (`src/backend/ipc/handlers/`)
```javascript
// Each handler manages specific domain
// Example: AuthIPCHandler.js, ProductIPCHandler.js
// Registers IPC channels
// Calls service layer
```

### Services Layer

Business logic separated from UI and IPC:

```javascript
// src/services/product/ProductService.js
class ProductService {
  constructor(db) {
    this.db = db;
  }
  
  async getAll() {
    // Database query
    // Business logic
    // Return formatted data
  }
}
```

### Frontend (React)

**Pages** (`src/frontend/pages/`)
- Full-page components
- Connected to Redux store
- Handle user interactions

**Redux Store** (`src/frontend/store/`)
```javascript
// store.js - Configure store
// slices/ - Feature-based slices
  // authSlice.js
  // productSlice.js
  // transactionSlice.js
```

**Components** (`src/frontend/components/`)
- Reusable UI components
- Transaction forms
- Modals, tables, etc.

## Database Schema

### Main Tables

**users**
- id (PRIMARY KEY)
- username (UNIQUE)
- password_hash
- full_name
- email
- role
- created_at

**products**
- id (PRIMARY KEY)
- name
- category_id (FOREIGN KEY)
- description
- unit
- stock_quantity
- created_at

**product_categories**
- id (PRIMARY KEY)
- name
- description
- created_at

**entities**
- id (PRIMARY KEY)
- type (farmer/supplier/customer)
- name
- contact
- address
- cnic
- created_at

**transactions**
- id (PRIMARY KEY)
- entity_id (FOREIGN KEY)
- type (sale/purchase/payment)
- amount
- description
- created_by (FOREIGN KEY)
- created_at

**transaction_items**
- id (PRIMARY KEY)
- transaction_id (FOREIGN KEY)
- product_id (FOREIGN KEY)
- quantity
- price
- subtotal

**ledger_entries**
- id (PRIMARY KEY)
- entity_id (FOREIGN KEY)
- transaction_id (FOREIGN KEY)
- type (debit/credit)
- amount
- balance
- created_at

## IPC Communication

### Pattern

```javascript
// Frontend (Renderer)
const result = await window.electronAPI.products.getAll();

// Preload (Bridge)
electronAPI: {
  products: {
    getAll: () => ipcRenderer.invoke('products:getAll')
  }
}

// Backend (Main Process)
ipcMain.handle('products:getAll', async () => {
  return await productService.getAll();
});
```

### Creating New IPC Handler

1. **Create handler file**: `src/backend/ipc/handlers/NewFeatureIPCHandler.js`

```javascript
import { ipcMain } from 'electron';

export class NewFeatureIPCHandler {
  constructor(service) {
    this.service = service;
    this.register();
  }
  
  register() {
    ipcMain.handle('feature:getData', async () => {
      return await this.service.getData();
    });
  }
}
```

2. **Register in index.js**:
```javascript
import { NewFeatureIPCHandler } from './handlers/NewFeatureIPCHandler.js';
new NewFeatureIPCHandler(newFeatureService);
```

3. **Add to preload.js**:
```javascript
feature: {
  getData: () => ipcRenderer.invoke('feature:getData')
}
```

4. **Use in frontend**:
```javascript
const data = await window.electronAPI.feature.getData();
```

## State Management

### Redux Slice Pattern

```javascript
// src/frontend/store/slices/featureSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export const fetchData = createAsyncThunk(
  'feature/fetchData',
  async () => {
    return await window.electronAPI.feature.getData();
  }
);

const featureSlice = createSlice({
  name: 'feature',
  initialState: {
    items: [],
    loading: false,
    error: null
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchData.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchData.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  }
});

export default featureSlice.reducer;
```

## Adding New Features

### Step-by-Step Guide

1. **Database Schema**
   - Define table structure
   - Add to DatabaseService initialization

2. **Create Service**
   - Create service class in `src/services/`
   - Implement CRUD operations
   - Add business logic

3. **Create IPC Handler**
   - Create handler in `src/backend/ipc/handlers/`
   - Register IPC channels
   - Connect to service

4. **Create Redux Slice**
   - Create slice in `src/frontend/store/slices/`
   - Define async thunks
   - Handle states (loading, success, error)

5. **Create UI Components**
   - Create page component
   - Create modals/forms
   - Connect to Redux store

6. **Add Route**
   - Add route in App.jsx
   - Add navigation link

## Testing

### Manual Testing

```bash
npm run test
```

### Test Checklist

- [ ] Create operations
- [ ] Read/List operations
- [ ] Update operations
- [ ] Delete operations
- [ ] Validation errors
- [ ] Edge cases
- [ ] UI responsiveness

## Building & Deployment

### Build Configuration

**electron-builder** (if using):
```json
{
  "appId": "com.agricultural.inventory",
  "productName": "Agricultural Inventory Management System",
  "win": {
    "target": "nsis"
  }
}
```

### Creating Installer

```bash
npm run package
```

Output: `Agricultural-Inventory-System-INSTALLER.zip`

## Best Practices

### Code Style

- Use ES6+ features
- Async/await for asynchronous operations
- Meaningful variable and function names
- Comment complex logic
- Keep functions small and focused

### Error Handling

```javascript
try {
  const result = await operation();
  return { success: true, data: result };
} catch (error) {
  console.error('Operation failed:', error);
  return { success: false, error: error.message };
}
```

### Security

- Validate all user inputs
- Use parameterized queries (prevent SQL injection)
- Hash passwords (bcrypt)
- Sanitize outputs
- Keep dependencies updated

### Performance

- Use indexes in database queries
- Implement pagination for large lists
- Debounce search inputs
- Lazy load components
- Optimize re-renders

## Debugging

### Development Tools

```javascript
// Enable DevTools in development
if (isDev) {
  mainWindow.webContents.openDevTools();
}
```

### Logging

```javascript
console.log('[ProductService] Fetching products...');
console.error('[ProductService] Error:', error);
```

### Database Debugging

```javascript
// Log SQL queries
db.pragma('trace', console.log);
```

## Common Issues

### "Cannot find module"
- Run `npm install`
- Check import paths
- Verify file exists

### "Database locked"
- Close other connections
- Check for long-running queries
- Implement proper connection management

### "IPC Error"
- Verify handler registered
- Check preload exposed API
- Validate channel names match

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev/)
- [Redux Toolkit](https://redux-toolkit.js.org/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [TailwindCSS](https://tailwindcss.com/docs)

## Getting Help

- Check this Developer Guide
- Review existing code examples
- Refer to technology documentation
- Contact senior developers

## Contributing Guidelines

1. Follow existing code structure
2. Write clear commit messages
3. Test thoroughly before committing
4. Document new features
5. Update relevant guides
