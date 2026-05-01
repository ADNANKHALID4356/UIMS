import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import PermissionGate from '../components/PermissionGate';

// Farmer thunks
import {
  fetchAllFarmers,
  createFarmer,
  updateFarmer,
  deleteFarmer,
  searchFarmers,
  clearError as clearFarmerError,
  setSelectedFarmer,
  clearSelectedFarmer,
} from '../store/slices/farmerSlice';

// Dealer thunks
import {
  fetchAllDealers,
  createDealer,
  updateDealer,
  deleteDealer,
  searchDealers,
  clearDealerError,
  selectDealer,
  clearSelectedDealer,
} from '../store/slices/dealerSlice';

// Company thunks
import {
  fetchAllCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  searchCompanies,
  clearCompanyError,
  selectCompany,
  clearSelectedCompany,
} from '../store/slices/companySlice';

/**
 * Universal EntitiesPage - Renders Customers, Dealers, or Suppliers
 * based on `entityType` prop and industry configuration.
 *
 * Props:
 *   entityType: 'customer' | 'dealer' | 'supplier'
 */
const EntitiesPage = ({ entityType = 'customer' }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const { industryConfig } = useAppSelector((state) => state.organization);

  // Map entity type to the correct Redux slice
  const sliceMap = {
    customer: useAppSelector((state) => state.farmer),
    dealer: useAppSelector((state) => state.dealer),
    supplier: useAppSelector((state) => state.company),
  };

  const sliceState = sliceMap[entityType] || sliceMap.customer;

  // Get terminology from industry config
  const terminology = industryConfig?.terminology || {};
  const entityLabel = terminology[entityType] || entityType;
  const entitiesLabel = terminology[`${entityType}s`] || `${entityType}s`;
  const idPrefix = terminology[`${entityType}IdPrefix`] || '';

  // Determine which fields this entity type uses
  const entityFields = useMemo(() => {
    const customFields = terminology[`${entityType}Fields`] || [];
    // Base fields common to all entity types
    const baseFields = ['name', 'father_name', 'phone', 'address'];
    // Merge: use custom if available, otherwise base
    return customFields.length > 0 ? customFields : baseFields;
  }, [entityType, terminology]);

  // Determine if CNIC is used (Farmers and Dealers have it, Companies don't)
  const hasCNIC = entityType !== 'supplier';
  // Determine the name field (Companies use company_name, others use name)
  const nameField = entityType === 'supplier' ? 'company_name' : 'name';
  // Companies and Dealers have contact_person
  const hasContactPerson = entityType === 'dealer' || entityType === 'supplier';
  // Companies have certifications
  const hasCertifications = entityType === 'supplier';

  // Industry-specific extra fields
  const hasCustomerGroup = entityType === 'customer' && entityFields.includes('customer_group');
  const hasDateOfBirth = entityType === 'customer' && entityFields.includes('date_of_birth');
  const hasAllergies = entityType === 'customer' && entityFields.includes('allergies');
  const hasChronicConditions = entityType === 'customer' && entityFields.includes('chronic_conditions');
  const hasClientType = entityType === 'customer' && entityFields.includes('client_type');
  const hasBudget = entityType === 'customer' && (entityFields.includes('budget_min') || entityFields.includes('budget_max'));
  const hasPreferredLocations = entityType === 'customer' && entityFields.includes('preferred_locations');
  const hasCommissionRate = entityType === 'dealer' && entityFields.includes('commission_rate');
  const hasDrugLicense = entityType === 'supplier' && entityFields.includes('drug_license_number');

  // Action dispatchers mapped by entity type
  const actions = useMemo(() => ({
    customer: {
      fetchAll: (active) => dispatch(fetchAllFarmers(active)),
      create: (data) => dispatch(createFarmer({ farmerData: data, userId: user?.user_id })),
      update: (id, data) => dispatch(updateFarmer({ farmerId: id, farmerData: data, userId: user?.user_id })),
      remove: (id) => dispatch(deleteFarmer({ farmerId: id, userId: user?.user_id })),
      search: (term) => dispatch(searchFarmers(term)),
      clearError: () => dispatch(clearFarmerError()),
      select: (entity) => dispatch(setSelectedFarmer(entity)),
      clearSelected: () => dispatch(clearSelectedFarmer()),
      idField: 'farmer_id',
      specificIdField: 'specific_id',
    },
    dealer: {
      fetchAll: (active) => dispatch(fetchAllDealers(active)),
      create: (data) => dispatch(createDealer({ dealerData: data, userId: user?.user_id })),
      update: (id, data) => dispatch(updateDealer({ dealerId: id, dealerData: data, userId: user?.user_id })),
      remove: (id) => dispatch(deleteDealer({ dealerId: id, userId: user?.user_id })),
      search: (term) => dispatch(searchDealers(term)),
      clearError: () => dispatch(clearDealerError()),
      select: (entity) => dispatch(selectDealer(entity)),
      clearSelected: () => dispatch(clearSelectedDealer()),
      idField: 'dealer_id',
      specificIdField: 'specific_id',
    },
    supplier: {
      fetchAll: (active) => dispatch(fetchAllCompanies(active)),
      create: (data) => dispatch(createCompany({ companyData: data, userId: user?.user_id })),
      update: (id, data) => dispatch(updateCompany({ companyId: id, companyData: data, userId: user?.user_id })),
      remove: (id) => dispatch(deleteCompany({ companyId: id, userId: user?.user_id })),
      search: (term) => dispatch(searchCompanies(term)),
      clearError: () => dispatch(clearCompanyError()),
      select: (entity) => dispatch(selectCompany(entity)),
      clearSelected: () => dispatch(clearSelectedCompany()),
      idField: 'company_id',
      specificIdField: 'specific_id',
    },
  }), [dispatch, user, entityType]);

  const entityActions = actions[entityType] || actions.customer;

  // Get the correct array from the slice
  const getEntities = () => {
    if (entityType === 'customer') return sliceState.farmers || [];
    if (entityType === 'dealer') return sliceState.dealers || [];
    if (entityType === 'supplier') return sliceState.companies || [];
    return [];
  };

  const getSelected = () => {
    if (entityType === 'customer') return sliceState.selectedFarmer;
    if (entityType === 'dealer') return sliceState.selectedDealer;
    if (entityType === 'supplier') return sliceState.selectedCompany;
    return null;
  };

  const entities = getEntities();
  const selectedEntity = getSelected();
  const { loading, error } = sliceState;

  // Local state
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteResults, setAutocompleteResults] = useState([]);

  // Initialize form data based on entity type
  const getEmptyForm = useCallback(() => {
    const base = {
      [nameField]: '',
      father_name: '',
      phone: '',
      address: '',
    };
    if (hasCNIC) base.cnic = '';
    if (hasContactPerson) base.contact_person = '';
    if (hasCertifications) base.certifications = '';
    if (hasCustomerGroup) base.customer_group = '';
    if (hasDateOfBirth) base.date_of_birth = '';
    if (hasAllergies) base.allergies = '';
    if (hasChronicConditions) base.chronic_conditions = '';
    if (hasClientType) base.client_type = '';
    if (hasBudget) { base.budget_min = ''; base.budget_max = ''; }
    if (hasPreferredLocations) base.preferred_locations = '';
    if (hasCommissionRate) base.commission_rate = '';
    if (hasDrugLicense) base.drug_license_number = '';
    base.is_permanent = true;
    return base;
  }, [nameField, hasCNIC, hasContactPerson, hasCertifications, hasCustomerGroup, hasDateOfBirth, hasAllergies, hasChronicConditions, hasClientType, hasBudget, hasPreferredLocations, hasCommissionRate, hasDrugLicense]);

  // Load entities on mount
  useEffect(() => {
    entityActions.fetchAll(true);
  }, [entityType]);

  // Debounced search with autocomplete support
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim()) {
        entityActions.search(searchTerm.trim());
        // Build autocomplete from current entities matching the search term
        const term = searchTerm.trim().toLowerCase();
        const matches = entities.filter(e => {
          const eName = getEntityName(e).toLowerCase();
          const eId = (e[entityActions.specificIdField] || '').toLowerCase();
          const eCnic = (e.cnic || '').toLowerCase();
          const ePhone = (e.phone || '').toLowerCase();
          return eName.includes(term) || eId.includes(term) || eCnic.includes(term) || ePhone.includes(term);
        }).slice(0, 8);
        setAutocompleteResults(matches);
        setShowAutocomplete(matches.length > 0);
      } else {
        entityActions.fetchAll(true);
        setAutocompleteResults([]);
        setShowAutocomplete(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Auto-dismiss errors
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => entityActions.clearError(), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // CNIC validation
  const validateCNIC = (cnic) => {
    if (!cnic) return true; // Optional if not required
    const cleaned = cnic.replace(/-/g, '');
    return /^\d{13}$/.test(cleaned);
  };

  // Phone validation (10-15 digits, optional + prefix)
  const validatePhone = (phone) => {
    if (!phone) return true; // Phone is optional
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    return /^\+?\d{10,15}$/.test(cleaned);
  };

  // Format CNIC for display
  const formatCNIC = (cnic) => {
    if (!cnic) return '-';
    const cleaned = cnic.replace(/-/g, '');
    if (cleaned.length === 13) {
      return `${cleaned.slice(0, 5)}-${cleaned.slice(5, 12)}-${cleaned.slice(12)}`;
    }
    return cnic;
  };

  // Form validation
  const validateForm = () => {
    const errors = {};
    if (!formData[nameField]?.trim()) {
      errors[nameField] = `${entityLabel} name is required`;
    }
    // CNIC validation for customers AND dealers (both have CNIC field)
    if (hasCNIC && formData.cnic && !validateCNIC(formData.cnic)) {
      errors.cnic = 'CNIC must be exactly 13 digits';
    }
    // Phone validation for all entity types
    if (formData.phone && !validatePhone(formData.phone)) {
      errors.phone = 'Phone must be 10-15 digits (e.g. 03XX-XXXXXXX or +92XXXXXXXXXX)';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Open create modal
  const handleCreate = () => {
    setFormData(getEmptyForm());
    setFormErrors({});
    setIsEditing(false);
    setShowModal(true);
  };

  // Open edit modal
  const handleEdit = (entity) => {
    const data = { ...entity };
    // Normalize is_permanent to boolean for the toggle
    data.is_permanent = entity.is_permanent === 1 || entity.is_permanent === true || entity.is_permanent === undefined;
    setFormData(data);
    setFormErrors({});
    setIsEditing(true);
    entityActions.select(entity);
    setShowModal(true);
  };

  // Delete flow
  const handleDeleteClick = (entity) => {
    setDeleteTarget(entity);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget[entityActions.idField];
    try {
      await entityActions.remove(id);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    } catch (err) {
      // Error handled by Redux
    }
  };

  // Submit form
  const handleSubmit = async () => {
    if (!validateForm()) return;
    try {
      if (isEditing) {
        const id = selectedEntity?.[entityActions.idField] || formData[entityActions.idField];
        await entityActions.update(id, formData);
      } else {
        await entityActions.create(formData);
      }
      setShowModal(false);
      setFormData(getEmptyForm());
      entityActions.clearSelected();
    } catch (err) {
      // Error handled by Redux
    }
  };

  // Handle autocomplete selection
  const handleAutocompleteSelect = (entity) => {
    setSearchTerm(getEntityName(entity));
    setShowAutocomplete(false);
    handleEdit(entity);
  };

  // Get display name for an entity
  const getEntityName = (entity) => {
    return entity[nameField] || entity.name || entity.company_name || '-';
  };

  // Get entity balance display
  const getBalance = (entity) => {
    return typeof entity.balance === 'number' ? entity.balance.toLocaleString() : '0';
  };
  const getCredit = (entity) => {
    return typeof entity.credit === 'number' ? entity.credit.toLocaleString() : '0';
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{entitiesLabel}</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage your {entitiesLabel.toLowerCase()} — add, edit, search, and view balances
          </p>
        </div>
        <PermissionGate permission="can_create_entities">
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add {entityLabel}
        </button>
        </PermissionGate>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <span className="text-red-700 text-sm">{error}</span>
          <button onClick={() => entityActions.clearError()} className="text-red-500 hover:text-red-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-4 relative">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Search ${entitiesLabel.toLowerCase()} by name, ID, CNIC, or phone...`}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
          {searchTerm && (
            <button
              onClick={() => { setSearchTerm(''); setShowAutocomplete(false); }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Search Autocomplete Dropdown */}
        {showAutocomplete && searchTerm.trim() && (
          <div className="absolute z-40 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {autocompleteResults.map((entity) => (
              <button
                key={entity[entityActions.idField]}
                onClick={() => handleAutocompleteSelect(entity)}
                className="w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0 flex items-center gap-3"
              >
                <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">
                  {entity[entityActions.specificIdField]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{getEntityName(entity)}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {entity.cnic ? formatCNIC(entity.cnic) : ''}{entity.cnic && entity.phone ? ' · ' : ''}{entity.phone || ''}
                  </p>
                </div>
                {entity.is_permanent === 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 shrink-0">Temp</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Total {entitiesLabel}</p>
          <p className="text-lg font-bold text-gray-800">{entities.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Active</p>
          <p className="text-lg font-bold text-green-600">
            {entities.filter(e => e.is_active !== 0).length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Total Balance</p>
          <p className="text-lg font-bold text-blue-600">
            {entities.reduce((sum, e) => sum + (e.balance || 0), 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Total Credit</p>
          <p className="text-lg font-bold text-orange-600">
            {entities.reduce((sum, e) => sum + (e.credit || 0), 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          <span className="ml-3 text-gray-500 text-sm">Loading {entitiesLabel.toLowerCase()}...</span>
        </div>
      )}

      {/* Table */}
      {!loading && entities.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                  {hasCNIC && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">CNIC</th>
                  )}
                  {hasContactPerson && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Contact Person</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Phone</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  {hasClientType && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                  )}
                  {hasCustomerGroup && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Group</th>
                  )}
                  {hasCommissionRate && (
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Commission %</th>
                  )}
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Balance</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Credit</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entities.map((entity) => (
                  <tr key={entity[entityActions.idField]} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        {entity[entityActions.specificIdField] || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{getEntityName(entity)}</p>
                        {entity.father_name && (
                          <p className="text-xs text-gray-500">S/O {entity.father_name}</p>
                        )}
                      </div>
                    </td>
                    {hasCNIC && (
                      <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                        {formatCNIC(entity.cnic)}
                      </td>
                    )}
                    {hasContactPerson && (
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {entity.contact_person || '-'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm text-gray-600">{entity.phone || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      {entity.is_permanent === 0 ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Temporary</span>
                      ) : (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">Permanent</span>
                      )}
                    </td>
                    {hasClientType && (
                      <td className="px-4 py-3">
                        {entity.client_type ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 capitalize">{entity.client_type}</span>
                        ) : <span className="text-sm text-gray-400">-</span>}
                      </td>
                    )}
                    {hasCustomerGroup && (
                      <td className="px-4 py-3">
                        {entity.customer_group ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 capitalize">{entity.customer_group}</span>
                        ) : <span className="text-sm text-gray-400">-</span>}
                      </td>
                    )}
                    {hasCommissionRate && (
                      <td className="px-4 py-3 text-right text-sm text-gray-600">
                        {entity.commission_rate != null ? `${entity.commission_rate}%` : '-'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-medium ${Number(entity.balance) > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                        {getBalance(entity)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-medium ${Number(entity.credit) > 0 ? 'text-orange-600' : 'text-gray-600'}`}>
                        {getCredit(entity)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {/* Ledger Button */}
                        <button
                          onClick={() => {
                            const ledgerId = entity[entityActions.idField];
                            navigate(`/ledger/${entityType}/${ledgerId}`, {
                              state: {
                                from: 'ledger',
                                entityType: entityType,
                                entityId: ledgerId,
                                entityName: getEntityName(entity),
                                displayLabel: entityLabel,
                                entitiesLabel: entitiesLabel
                              }
                            });
                          }}
                          className="p-1.5 text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                          title={`View ${entityLabel} Ledger`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        </button>
                        <PermissionGate permission="can_edit_entities">
                        <button
                          onClick={() => handleEdit(entity)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title={`Edit ${entityLabel}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        </PermissionGate>
                        <PermissionGate permission="can_delete_entities">
                        <button
                          onClick={() => handleDeleteClick(entity)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title={`Delete ${entityLabel}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        </PermissionGate>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && entities.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-800 mb-1">No {entitiesLabel.toLowerCase()} found</h3>
          <p className="text-gray-500 text-sm mb-4">
            {searchTerm
              ? `No ${entitiesLabel.toLowerCase()} match "${searchTerm}". Try a different search.`
              : `Get started by adding your first ${entityLabel.toLowerCase()}.`
            }
          </p>
          {!searchTerm && (
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Add {entityLabel}
            </button>
          )}
        </div>
      )}

      {/* ===== Create/Edit Modal ===== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">
                {isEditing ? `Edit ${entityLabel}` : `Add New ${entityLabel}`}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              {/* Name field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {entityType === 'supplier' ? 'Company Name' : 'Name'} *
                </label>
                <input
                  type="text"
                  value={formData[nameField] || ''}
                  onChange={(e) => setFormData({ ...formData, [nameField]: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                    formErrors[nameField] ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder={`Enter ${entityLabel.toLowerCase()} name`}
                />
                {formErrors[nameField] && (
                  <p className="text-red-500 text-xs mt-1">{formErrors[nameField]}</p>
                )}
              </div>

              {/* Father Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Father/Guardian Name</label>
                <input
                  type="text"
                  value={formData.father_name || ''}
                  onChange={(e) => setFormData({ ...formData, father_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Enter father/guardian name"
                />
              </div>

              {/* CNIC (if applicable) */}
              {hasCNIC && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CNIC {entityType === 'customer' ? '*' : ''}
                  </label>
                  <input
                    type="text"
                    value={formData.cnic || ''}
                    onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                      formErrors.cnic ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="12345-6789012-3"
                    maxLength={15}
                  />
                  {formErrors.cnic && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.cnic}</p>
                  )}
                </div>
              )}

              {/* Contact Person (Dealers & Companies) */}
              {hasContactPerson && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={formData.contact_person || ''}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Enter contact person name"
                  />
                </div>
              )}

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                    formErrors.phone ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="03XX-XXXXXXX"
                />
                {formErrors.phone && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.phone}</p>
                )}
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  rows={2}
                  placeholder="Enter address"
                />
              </div>

              {/* Permanent vs Temporary Toggle */}
              <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {formData.is_permanent ? 'Permanent' : 'Temporary'} {entityLabel}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formData.is_permanent
                      ? 'Regular entity with ledger tracking and credit/balance management'
                      : 'Walk-in / one-time entity — cash transactions only, no ledger'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_permanent: !formData.is_permanent })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                    formData.is_permanent ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.is_permanent ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Certifications (Companies only) */}
              {hasCertifications && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Certifications</label>
                  <input
                    type="text"
                    value={formData.certifications || ''}
                    onChange={(e) => setFormData({ ...formData, certifications: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Enter certifications"
                  />
                </div>
              )}

              {/* === Industry-specific fields === */}

              {/* Medical: Date of Birth */}
              {hasDateOfBirth && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.date_of_birth || ''}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
              )}

              {/* Medical: Allergies */}
              {hasAllergies && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Allergies</label>
                  <textarea
                    value={formData.allergies || ''}
                    onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    rows={2}
                    placeholder="List any known allergies"
                  />
                </div>
              )}

              {/* Medical: Chronic Conditions */}
              {hasChronicConditions && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chronic Conditions</label>
                  <textarea
                    value={formData.chronic_conditions || ''}
                    onChange={(e) => setFormData({ ...formData, chronic_conditions: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    rows={2}
                    placeholder="List any chronic conditions"
                  />
                </div>
              )}

              {/* Retail: Customer Group */}
              {hasCustomerGroup && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Group</label>
                  <select
                    value={formData.customer_group || ''}
                    onChange={(e) => setFormData({ ...formData, customer_group: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="">Select group...</option>
                    <option value="regular">Regular</option>
                    <option value="wholesale">Wholesale</option>
                    <option value="vip">VIP</option>
                  </select>
                </div>
              )}

              {/* Real Estate: Client Type */}
              {hasClientType && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client Type</label>
                  <select
                    value={formData.client_type || ''}
                    onChange={(e) => setFormData({ ...formData, client_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="">Select type...</option>
                    <option value="buyer">Buyer</option>
                    <option value="seller">Seller</option>
                    <option value="renter">Renter</option>
                    <option value="landlord">Landlord</option>
                  </select>
                </div>
              )}

              {/* Real Estate: Budget Range */}
              {hasBudget && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Budget</label>
                    <input
                      type="number"
                      value={formData.budget_min || ''}
                      onChange={(e) => setFormData({ ...formData, budget_min: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Budget</label>
                    <input
                      type="number"
                      value={formData.budget_max || ''}
                      onChange={(e) => setFormData({ ...formData, budget_max: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="0"
                    />
                  </div>
                </div>
              )}

              {/* Real Estate: Commission Rate (for Agents/Dealers) */}
              {hasCommissionRate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Commission Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.commission_rate || ''}
                    onChange={(e) => setFormData({ ...formData, commission_rate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="2.5"
                  />
                </div>
              )}

              {/* Real Estate: Preferred Locations */}
              {hasPreferredLocations && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Locations</label>
                  <textarea
                    value={formData.preferred_locations || ''}
                    onChange={(e) => setFormData({ ...formData, preferred_locations: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    rows={2}
                    placeholder="e.g. DHA, Bahria Town, Gulberg"
                  />
                </div>
              )}

              {/* Medical: Drug License Number (for Suppliers) */}
              {hasDrugLicense && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Drug License Number</label>
                  <input
                    type="text"
                    value={formData.drug_license_number || ''}
                    onChange={(e) => setFormData({ ...formData, drug_license_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Enter drug license number"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => { setShowModal(false); entityActions.clearSelected(); }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {loading ? 'Saving...' : isEditing ? `Update ${entityLabel}` : `Add ${entityLabel}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Delete Confirmation Modal ===== */}
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Delete {entityLabel}?</h3>
              <p className="text-gray-500 text-sm mb-6">
                Are you sure you want to delete <strong>{getEntityName(deleteTarget)}</strong>?
                This action will deactivate the record.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-sm font-medium"
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EntitiesPage;
