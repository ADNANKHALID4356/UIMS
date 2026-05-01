import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import { registerIPCHandlers } from './ipc/index.js';
import { LicenseService } from '../services/license/LicenseService.js';
import { DatabaseService } from '../services/database/DatabaseService.js';
import fs from 'fs';

// Always use production mode when running from dist
const isDev = false;

let mainWindow = null;

/**
 * Create the main application window
 */
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1366,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../../assets/icon.png'),
  });

  const startURL = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../renderer/index.html')}`;

  console.log('Loading URL:', startURL);
  console.log('isDev:', isDev);
  console.log('__dirname:', __dirname);
  
  mainWindow.loadURL(startURL);

  // Always open DevTools to see errors
  mainWindow.webContents.openDevTools();

  // Log any errors from the renderer process
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message}`);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

/**
 * License validation before app starts
 */
const validateLicense = async () => {
  try {
    const licenseService = new LicenseService();
    const isValid = await licenseService.validateLicense();
    return isValid;
  } catch (error) {
    console.error('License validation error:', error);
    return false;
  }
};

/**
 * Initialize database
 */
const initializeDatabase = async () => {
  try {
    const dbService = DatabaseService.getInstance();
    await dbService.initialize();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
};

/**
 * Create application menu
 */
const createMenu = () => {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            console.log('About Agricultural Inventory Management System');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

/**
 * App event handlers
 */
app.on('ready', async () => {
  try {
    // Initialize database first (needed for license check)
    await initializeDatabase();

    // Create main window (will show license activation if needed)
    createWindow();

    // Register IPC handlers
    registerIPCHandlers();

    // Create menu
    createMenu();

    // Note: License validation is now handled by the renderer process
    // The app will show the license activation page if no valid license exists
  } catch (error) {
    console.error('Application startup error:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // In production, you might want to log this to a file or external service
});
