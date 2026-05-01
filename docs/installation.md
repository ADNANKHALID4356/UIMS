# Installation Guide

## Prerequisites

Before installing the Agricultural Inventory Management System, ensure your system meets the following requirements:

- Windows 10 (64-bit) or Windows 11
- Intel Core i3 processor or equivalent
- 4 GB RAM minimum (8 GB recommended)
- 500 MB free disk space
- 1366x768 minimum screen resolution

## For End Users

### Download

Contact your system administrator to obtain the installation package:
- `Agricultural-Inventory-System-INSTALLER.zip`

### Installation Steps

1. **Extract the ZIP file**
   - Locate the downloaded ZIP file
   - Right-click and select "Extract All..."
   - Choose a location (Desktop recommended)
   - Click "Extract"

2. **Run the Installer**
   - Open the extracted folder
   - Double-click `INSTALL.bat`
   - Click "Yes" when prompted for Administrator permission

3. **Follow the Installation Wizard**
   - The installer will guide you through 6 steps
   - Installation takes approximately 1-2 minutes
   - Choose whether to launch immediately when prompted

4. **Launch the Application**
   - From Desktop shortcut
   - From Start Menu → Agricultural Inventory Management System
   - Or navigate to installation folder

## For Developers

### Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/agricultural-inventory-system.git
cd agricultural-inventory-system
```

### Install Dependencies (First Time Only)

```bash
npm install
```

**What this does:**
- Reads `package.json` to identify all required packages
- Downloads ~200-300 MB of dependencies into `node_modules/` folder
- Takes approximately 2-3 minutes (varies by internet speed)
- Installs platform-specific binaries:
  - Electron 33.2.1 (~150 MB)
  - better-sqlite3 with native bindings
  - Vite, React, Redux Toolkit, and all frontend dependencies
  - Babel, PostCSS, TailwindCSS, and build tools
- Creates/updates `package-lock.json` for version locking

**You only need to run this:**
- ✅ First time after cloning the repository
- ✅ When switching branches with different `package.json`
- ✅ After pulling changes that modified dependencies
- ✅ If `node_modules/` gets corrupted or deleted

**Why node_modules is NOT in the repository:**
- **Size**: 200-500 MB (slows down cloning)
- **Platform-specific**: Windows binaries won't work on Mac/Linux
- **Security**: Fresh installation ensures latest security patches
- **Best Practice**: Standard in Node.js/Electron development
- **Reproducibility**: `package.json` + `package-lock.json` ensure exact same versions

This will install all required dependencies including:
- Electron 33.2.1
- React 18
- Redux Toolkit
- SQLite3
- TailwindCSS
- And other dependencies listed in package.json

### Run in Development Mode

```bash
npm run dev
```

The application will start in development mode with hot-reload enabled.

### Build for Production

```bash
npm run build
```

This compiles the backend and frontend code.

### Create Installer Package

```bash
npm run package
```

The installer package will be created in the project root.

## Default Credentials

**For First Login:**
- Username: `admin`
- Password: `Admin@123`

⚠️ **Important**: Change the default password immediately after first login for security.

## Installation Directory

The application installs to:
```
C:\Program Files\Agricultural Inventory Management System\
```

## Data Location

Application data is stored at:
```
%AppData%\Roaming\agricultural-inventory-system\
```

This includes:
- Database file (inventory.db)
- User configurations
- Application logs

## Uninstallation

### Method 1: Windows Settings (Recommended)
- Windows 11: Settings → Apps → Installed Apps
- Windows 10: Settings → Apps → Apps & Features
- Find "Agricultural Inventory Management System"
- Click Uninstall

### Method 2: Control Panel
- Open Control Panel
- Programs → Programs and Features
- Find "Agricultural Inventory Management System"
- Click Uninstall

### Method 3: Direct Uninstaller
Run the uninstaller script:
```
C:\Program Files\Agricultural Inventory Management System\Uninstall.ps1
```

## Troubleshooting

### "Windows protected your PC" Warning
- Click "More info"
- Click "Run anyway"
- This is normal for unsigned applications

### Installation Fails
- Ensure Administrator privileges
- Check available disk space (500 MB required)
- Temporarily disable antivirus
- Restart computer and try again

### Application Won't Start
- Check Windows Event Viewer for errors
- Verify database file exists in AppData folder
- Run as Administrator once
- Check antivirus isn't blocking the application

### Database Errors
- Ensure AppData folder is accessible
- Check disk space availability
- Verify file permissions
- Restore from backup if available

## Updating

To update to a new version:
1. Uninstall the current version
2. Install the new version
3. Your data will be preserved (stored in AppData)

## Backup Recommendation

Regular backups are recommended. Backup location:
```
%AppData%\Roaming\agricultural-inventory-system\
```

Copy this folder to a safe location regularly.

## Support

For installation assistance:
- Contact system administrator
- Refer to README.txt in the installation package
- Check the User Guide for common issues
