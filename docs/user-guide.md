# User Guide

## Getting Started

### First Launch

1. Launch the application from Desktop shortcut or Start Menu
2. You'll see the login screen
3. Enter default credentials (provided by administrator)
4. Change your password immediately for security

### Dashboard Overview

The dashboard displays:
- **Real-time Statistics**: Active entities, inventory items, transactions
- **Quick Actions**: Shortcuts to common tasks
- **System Information**: Application version, license status
- **Recent Activity**: Latest transactions and updates

## Core Features

### 1. Inventory Management

#### Managing Products

**Add New Product:**
1. Navigate to Products page
2. Click "Add Product" button
3. Fill in product details:
   - Product name
   - Category
   - Description
   - Unit of measure
   - Initial stock quantity
4. Click "Save"

**Edit Product:**
1. Find the product in the list
2. Click the edit icon
3. Modify details as needed
4. Click "Update"

**Delete Product:**
1. Select the product
2. Click delete icon
3. Confirm deletion
4. Note: Products with transaction history cannot be deleted

#### Managing Categories

**Add Category:**
1. Go to Product Categories page
2. Click "Add Category"
3. Enter category name and description
4. Save

**Edit/Delete Categories:**
- Similar process to products
- Categories with products cannot be deleted

### 2. Entity Management

#### Farmers

**Add New Farmer:**
1. Navigate to Farmers page
2. Click "Add Farmer"
3. Enter details:
   - Name
   - Contact information
   - Address
   - CNIC/ID number
4. Save

**View Farmer Ledger:**
1. Select farmer from list
2. Click "View Ledger"
3. See all transactions and current balance

#### Suppliers

Similar process to farmers, with supplier-specific fields.

#### Customers

Manage customer records with contact details and transaction history.

### 3. Transaction Management

#### Creating a New Transaction

**Sales Transaction:**
1. Go to Transactions page
2. Click "New Transaction"
3. Select transaction type: Sale
4. Choose customer/entity
5. Add products:
   - Select product
   - Enter quantity
   - Price auto-fills (can be modified)
6. Add multiple items as needed
7. Review total amount
8. Save transaction

**Purchase Transaction:**
- Similar process
- Select supplier as entity
- Products added to inventory

**Payment Transaction:**
- Record payment received or made
- Link to entity account
- Updates ledger automatically

#### Multi-Item Invoices

1. Start new transaction
2. Click "Add Item" for each product
3. System calculates:
   - Subtotal for each item
   - Total amount
   - Running balance
4. Print invoice after saving

#### Editing Transactions

1. Find transaction in list
2. Click edit icon
3. Modify details (if within edit window)
4. Changes update ledger automatically

#### Viewing Transaction Details

- Click on any transaction
- View complete details:
  - Items purchased/sold
  - Amounts
  - Entity information
  - Date and time
  - User who created it

### 4. Financial Ledger

#### Understanding the Ledger

The ledger maintains double-entry accounting:
- **Debit**: Money owed to you, sales, payments received
- **Credit**: Money you owe, purchases, payments made
- **Balance**: Current standing with entity

#### Viewing Ledger

**Entity Ledger:**
1. Select entity (farmer, supplier, customer)
2. Click "View Ledger"
3. See all transactions
4. Filter by date range
5. Export or print

**General Ledger:**
- View all transactions across entities
- Filter by type, date, amount
- Search functionality

### 5. Reports & Analytics

#### Available Reports

**Inventory Reports:**
- Current stock levels
- Stock movements history
- Low stock items
- Product-wise analysis

**Financial Reports:**
- Transaction summary
- Entity-wise balances
- Payment history
- Profit/loss overview

**Entity Reports:**
- Farmer-wise transactions
- Supplier summaries
- Customer analytics

#### Generating Reports

1. Navigate to Reports page
2. Select report type
3. Choose date range
4. Apply filters if needed
5. Click "Generate"
6. Export to PDF or print

### 6. User Management (Admin Only)

#### Adding Users

1. Go to User Management
2. Click "Add User"
3. Enter details:
   - Username
   - Full name
   - Email
   - Role (Admin/User)
   - Initial password
4. Save

#### Managing Users

- **Edit**: Update user information
- **Deactivate**: Disable user access temporarily
- **Delete**: Remove user (admin only)
- **Reset Password**: Force password change

### 7. Backup & Data Management

#### Creating Backup

1. Go to Settings
2. Click "Backup Data"
3. Choose backup location
4. Backup file created with timestamp

#### Restoring from Backup

1. Go to Settings
2. Click "Restore Data"
3. Select backup file
4. Confirm restoration
5. Application will restart

## Best Practices

### Data Entry

- ✅ Enter accurate product information
- ✅ Keep entity contact details updated
- ✅ Double-check quantities before saving
- ✅ Add descriptions for clarity
- ✅ Use consistent naming conventions

### Security

- ✅ Change default password immediately
- ✅ Use strong passwords (8+ characters, mixed case, numbers)
- ✅ Log out when leaving workstation
- ✅ Limit user access based on roles
- ✅ Regular password changes

### Data Management

- ✅ Create regular backups (daily recommended)
- ✅ Store backups in safe location
- ✅ Review reports weekly
- ✅ Reconcile ledger entries monthly
- ✅ Clean up old test data

## Keyboard Shortcuts

- `Ctrl + N`: New transaction
- `Ctrl + S`: Save current form
- `Ctrl + P`: Print current view
- `Ctrl + F`: Search/Filter
- `Escape`: Close modal/Cancel
- `F5`: Refresh data

## Tips & Tricks

### Faster Data Entry

- Use Tab key to move between fields
- Press Enter to submit forms quickly
- Use search to find items faster
- Create favorite entities for quick access

### Avoiding Errors

- Verify quantities before saving
- Double-check entity selection
- Review totals before confirming
- Use preview before printing

### Troubleshooting

**Can't Find a Product:**
- Use the search bar
- Check spelling
- Verify product isn't deleted
- Check category filters

**Balance Doesn't Match:**
- Verify all transactions are entered
- Check for duplicate entries
- Review ledger for errors
- Reconcile with physical records

**Print Not Working:**
- Check printer connection
- Verify default printer set
- Try print preview first
- Check printer has paper

## Common Tasks Quick Reference

| Task | Steps |
|------|-------|
| Add Product | Products → Add Product → Fill form → Save |
| New Sale | Transactions → New → Select entity → Add items → Save |
| View Balance | Entities → Select → View Ledger |
| Generate Report | Reports → Select type → Set dates → Generate |
| Backup Data | Settings → Backup → Choose location → Backup |
| Change Password | Profile → Change Password → Enter new → Save |

## Getting Help

- Check this User Guide for detailed instructions
- Contact system administrator for support
- Refer to Installation Guide for setup issues
- See Developer Guide if customizing

## Support Information

For assistance:
- System Administrator: [Contact Info]
- User Guide: This document
- Installation Guide: docs/installation.md
- Technical Support: [Contact Info]
