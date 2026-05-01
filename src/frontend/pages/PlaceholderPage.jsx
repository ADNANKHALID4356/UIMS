import React from 'react';
import { useAppSelector } from '../store/hooks';

/**
 * Placeholder page for features that are coming in future sprints.
 * Displays a friendly "coming soon" message with the feature name.
 */
const PlaceholderPage = ({ title, description, sprint }) => {
  const { industryConfig } = useAppSelector((state) => state.organization);
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {title || 'Feature Coming Soon'}
        </h1>
        <p className="text-gray-500 mb-4">
          {description || 'This feature is under development and will be available in an upcoming sprint.'}
        </p>
        {sprint && (
          <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-sm font-medium">
            Expected in {sprint}
          </span>
        )}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-left">
          <p className="text-xs text-gray-500">
            <strong>Industry:</strong> {industryConfig?.displayName || 'Not configured'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            <strong>Status:</strong> In Development
          </p>
        </div>
      </div>
    </div>
  );
};

// Pre-configured placeholder pages for each upcoming feature

export const EntitiesCustomersPage = () => (
  <PlaceholderPage 
    title="Customer Management" 
    description="Manage your customers, patients, clients, or farmers with full CRUD operations, search, and ledger tracking."
    sprint="Sprint 2"
  />
);

export const EntitiesDealersPage = () => (
  <PlaceholderPage 
    title="Dealer / Distributor Management" 
    description="Manage dealers, distributors, or agents with contact information, balances, and transaction history."
    sprint="Sprint 2"
  />
);

export const EntitiesSuppliersPage = () => (
  <PlaceholderPage 
    title="Supplier Management" 
    description="Manage suppliers, pharmaceutical companies, or property owners."
    sprint="Sprint 2"
  />
);

export const InventoryItemsPage = () => (
  <PlaceholderPage 
    title="Inventory Management" 
    description="Manage products, medicines, or properties with categories, stock tracking, and alerts."
    sprint="Sprint 3"
  />
);

export const InventorySecondaryPage = () => (
  <PlaceholderPage 
    title="Secondary Inventory" 
    description="Manage grain types and secondary inventory items."
    sprint="Sprint 3"
  />
);

export const StockManagementPage = () => (
  <PlaceholderPage 
    title="Stock Management" 
    description="View stock levels, track movements, manage batch entries, and monitor reorder alerts."
    sprint="Sprint 3"
  />
);

export const LedgerPage = () => (
  <PlaceholderPage 
    title="Ledger & Payments" 
    description="View entity ledgers, record payments, track outstanding balances, and manage credit."
    sprint="Sprint 5"
  />
);

export const ReportsPage = () => (
  <PlaceholderPage 
    title="Reports" 
    description="Generate daily sales, stock, outstanding balances, profit/loss, and industry-specific reports."
    sprint="Sprint 6"
  />
);

export const BackupPage = () => (
  <PlaceholderPage 
    title="Backup & Restore" 
    description="Create manual and scheduled backups, restore from backup, and export data."
    sprint="Sprint 6"
  />
);

export const PrescriptionsPage = () => (
  <PlaceholderPage 
    title="Prescriptions" 
    description="Manage prescriptions, track dispensing, and maintain controlled substance records."
    sprint="Sprint 4"
  />
);

export const CommissionsPage = () => (
  <PlaceholderPage 
    title="Commissions" 
    description="Track agent commissions, manage splits, and generate commission reports."
    sprint="Sprint 4"
  />
);

export default PlaceholderPage;
