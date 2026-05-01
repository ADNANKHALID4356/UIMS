import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { HomeIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import { useSelector } from 'react-redux';

/**
 * Breadcrumb Component
 * ====================
 * Auto-generates breadcrumb trail from current route.
 * Niche-aware: Uses industryConfig terminology.
 */

const ROUTE_MAP = {
  dashboard: 'Dashboard',
  entities: 'Entities',
  'product-categories': 'Product Categories',
  products: 'Products',
  'stock-movements': 'Stock Movements',
  transactions: 'Transactions',
  new: 'New Transaction',
  edit: 'Edit',
  reports: 'Reports',
  backup: 'Backup & Restore',
  ledger: 'Ledger',
  'medicine-batches': 'Medicine Batches',
  properties: 'Properties',
  prescriptions: 'Prescriptions',
  commissions: 'Commissions',
  history: 'Activity Log',
  settings: 'Settings',
  'user-management': 'User Management',
};

const Breadcrumb = () => {
  const location = useLocation();
  const params = useParams();
  const { industryConfig } = useSelector((state) => state.organization);
  const terminology = industryConfig?.terminology || {};

  const ENTITY_TYPE_LABELS = {
    customer: terminology.customer || 'Customer',
    customers: terminology.customers || 'Customers',
    dealer: terminology.dealer || 'Dealer',
    dealers: terminology.dealers || 'Dealers',
    supplier: terminology.supplier || 'Supplier',
    suppliers: terminology.suppliers || 'Suppliers',
    farmer: terminology.customer || 'Customer',
    company: terminology.supplier || 'Supplier',
    patient: terminology.customer || 'Patient',
    client: terminology.customer || 'Client',
    distributor: terminology.dealer || 'Distributor',
    agent: terminology.dealer || 'Agent',
  };

  const pathSegments = location.pathname.split('/').filter(Boolean);
  if (pathSegments.length === 0) return null;

  const crumbs = [];
  let accumulatedPath = '';

  pathSegments.forEach((segment, index) => {
    accumulatedPath += '/' + segment;
    const isLast = index === pathSegments.length - 1;

    // Skip UUID-like IDs or numeric IDs in display but keep path
    const isId = /^[0-9a-f-]{8,}$/i.test(segment) || /^\d+$/.test(segment);

    let label = ROUTE_MAP[segment];

    // Entity type sub-route: /entities/customers
    if (pathSegments[index - 1] === 'entities') {
      if (segment === 'customers') label = terminology.customers || 'Customers';
      if (segment === 'dealers') label = terminology.dealers || 'Dealers';
      if (segment === 'suppliers') label = terminology.suppliers || 'Suppliers';
    }

    // Explicit check for grains/secondary items
    if (segment === 'grains') {
      label = terminology.secondaryItems || 'Grains';
    }

    // Ledger sub-route: /ledger/:entityType/:entityId
    if (pathSegments[0] === 'ledger' && index === 1) {
      const type = segment.toLowerCase();
      const rawIndustry = industryConfig?.industry || 'RETAIL';
      const industryType = rawIndustry.toString().toUpperCase();
      
      let typeLabel = (segment.charAt(0).toUpperCase() + segment.slice(1));
      
      // Try to get from ENTITY_TYPE_LABELS first (which uses terminology)
      if (ENTITY_TYPE_LABELS[type]) {
        typeLabel = ENTITY_TYPE_LABELS[type];
      } else {
        // Fallback overrides
        if (industryType.includes('RETAIL') || industryType.includes('GENERAL_STORE')) {
          if (type === 'farmer' || type === 'customer' || type === 'patient' || type === 'client') typeLabel = 'Customer';
          else if (type === 'dealer' || type === 'distributor' || type === 'agent') typeLabel = 'Distributor';
          else if (type === 'company' || type === 'supplier' || type === 'owner') typeLabel = 'Supplier';
        } else if (industryType.includes('AGRI') || industryType.includes('FARM')) {
          if (type === 'farmer' || type === 'customer' || type === 'patient' || type === 'client') typeLabel = 'Farmer';
          else if (type === 'dealer' || type === 'distributor' || type === 'agent') typeLabel = 'Dealer';
          else if (type === 'company' || type === 'supplier' || type === 'owner') typeLabel = 'Company';
        } else if (industryType.includes('MEDICAL') || industryType.includes('PHARMA')) {
          if (type === 'farmer' || type === 'customer' || type === 'patient' || type === 'client') typeLabel = 'Patient';
          else if (type === 'dealer' || type === 'distributor' || type === 'agent') typeLabel = 'Distributor';
          else if (type === 'company' || type === 'supplier' || type === 'owner') typeLabel = 'Pharma Company';
        } else if (industryType.includes('REAL_ESTATE') || industryType.includes('PROPERTY')) {
          if (type === 'farmer' || type === 'customer' || type === 'patient' || type === 'client') typeLabel = 'Client';
          else if (type === 'dealer' || type === 'distributor' || type === 'agent') typeLabel = 'Agent';
          else if (type === 'company' || type === 'supplier' || type === 'owner') typeLabel = 'Property Owner';
        }
      }

      // Guard against mixed terminology after switching niche:
      // In Retail, singular label must not remain "Farmer/Dealer/Company".
      if (industryType.includes('RETAIL') || industryType.includes('GENERAL_STORE')) {
        const normalized = String(typeLabel || '').trim().toLowerCase();
        if (normalized === 'farmer') typeLabel = 'Customer';
        if (normalized === 'dealer') typeLabel = 'Distributor';
        if (normalized === 'company') typeLabel = 'Supplier';
      }
      
      label = `${typeLabel} Ledger`;
    }

    // Transaction detail
    if (pathSegments[0] === 'transactions' && isId) {
      label = 'Details';
    }

    if (!label && !isId) {
      label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
    }

    if (isId && !label) {
      label = null; 
    }

    if (label) {
      crumbs.push({ label, path: accumulatedPath, isLast });
    }
  });

  if (crumbs.length <= 1) return null; 

  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-sm text-gray-500 mb-4">
      <Link
        to="/dashboard"
        className="flex items-center hover:text-blue-600 transition-colors"
      >
        <HomeIcon className="h-4 w-4" />
      </Link>
      {crumbs.map((crumb, idx) => (
        <React.Fragment key={crumb.path}>
          <ChevronRightIcon className="h-3 w-3 mx-2 text-gray-400 flex-shrink-0" />
          {crumb.isLast ? (
            <span className="font-medium text-gray-800 truncate max-w-[200px]">
              {crumb.label}
            </span>
          ) : (
            <Link
              to={crumb.path}
              className="hover:text-blue-600 transition-colors truncate max-w-[200px]"
            >
              {crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumb;
