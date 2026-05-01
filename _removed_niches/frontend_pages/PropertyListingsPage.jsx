import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useToast } from '../components/common/Toast';

const PROPERTY_TYPES = ['Residential', 'Commercial', 'Plot', 'Industrial', 'Agricultural'];
const LISTING_TYPES = ['Sale', 'Rent', 'Lease'];
const STATUS_OPTIONS = ['Available', 'Sold', 'Rented', 'Under Negotiation', 'Reserved'];
const AREA_UNITS = [
  { value: 'sq_ft', label: 'Sq. Ft.' },
  { value: 'sq_yards', label: 'Sq. Yards' },
  { value: 'marla', label: 'Marla' },
  { value: 'kanal', label: 'Kanal' },
  { value: 'acre', label: 'Acre' },
];

const PropertyListingsPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useSelector((state) => state.auth);

  const [properties, setProperties] = useState([]);
  const [owners, setOwners] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [deletingProperty, setDeletingProperty] = useState(null);
  const [statusProperty, setStatusProperty] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [newStatus, setNewStatus] = useState('');

  const initialFormState = {
    title: '',
    property_type: '',
    listing_type: 'Sale',
    address: '',
    city: '',
    area: '',
    land_area: '',
    built_area: '',
    area_unit: 'sq_ft',
    bedrooms: '0',
    bathrooms: '0',
    floors: '1',
    parking_spaces: '0',
    price: '0',
    price_per_unit: '0',
    description: '',
    features: '',
    owner_id: '',
    agent_id: '',
  };

  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const filters = { is_active: 1 };
      if (filterType) filters.property_type = filterType;
      if (filterStatus) filters.status = filterStatus;
      if (filterCity) filters.city = filterCity;

      const [propData, ownerData, agentData, statsData] = await Promise.all([
        searchTerm
          ? window.electronAPI.property.search(searchTerm)
          : window.electronAPI.property.getAll(filters),
        window.electronAPI.company.getAll(true),
        window.electronAPI.dealer.getAll(true),
        window.electronAPI.property.getStatistics(),
      ]);

      setProperties(propData || []);
      setOwners(ownerData || []);
      setAgents(agentData || []);
      setStatistics(statsData);
    } catch (error) {
      console.error('Error loading properties:', error);
      toast.error('Failed to load properties');
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus, filterCity, searchTerm]);

  useEffect(() => { loadData(); }, [loadData]);

  const resetForm = () => {
    setFormData(initialFormState);
    setFormErrors({});
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.title.trim()) errors.title = 'Title is required';
    if (!formData.property_type) errors.property_type = 'Property type is required';
    if (parseFloat(formData.price) < 0) errors.price = 'Price must be >= 0';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const data = {
        title: formData.title.trim(),
        property_type: formData.property_type,
        listing_type: formData.listing_type,
        address: formData.address || null,
        city: formData.city || null,
        area: formData.area || null,
        land_area: formData.land_area ? parseFloat(formData.land_area) : null,
        built_area: formData.built_area ? parseFloat(formData.built_area) : null,
        area_unit: formData.area_unit,
        bedrooms: parseInt(formData.bedrooms) || 0,
        bathrooms: parseInt(formData.bathrooms) || 0,
        floors: parseInt(formData.floors) || 1,
        parking_spaces: parseInt(formData.parking_spaces) || 0,
        price: parseFloat(formData.price) || 0,
        price_per_unit: parseFloat(formData.price_per_unit) || 0,
        description: formData.description || null,
        features: formData.features ? formData.features.split(',').map(f => f.trim()).filter(Boolean) : [],
        owner_id: formData.owner_id ? parseInt(formData.owner_id) : null,
        agent_id: formData.agent_id ? parseInt(formData.agent_id) : null,
      };

      let result;
      if (editingProperty) {
        result = await window.electronAPI.property.update(editingProperty.property_id, data, user.user_id);
      } else {
        result = await window.electronAPI.property.create(data, user.user_id);
      }

      if (result?.success) {
        toast.success(editingProperty ? 'Property updated' : 'Property listed successfully');
        setShowModal(false);
        setEditingProperty(null);
        resetForm();
        loadData();
      } else {
        toast.error(result?.message || 'Operation failed');
      }
    } catch (error) {
      console.error('Error saving property:', error);
      toast.error('Error: ' + error.message);
    }
  };

  const handleEdit = (property) => {
    setEditingProperty(property);
    setFormData({
      title: property.title,
      property_type: property.property_type,
      listing_type: property.listing_type || 'Sale',
      address: property.address || '',
      city: property.city || '',
      area: property.area || '',
      land_area: property.land_area?.toString() || '',
      built_area: property.built_area?.toString() || '',
      area_unit: property.area_unit || 'sq_ft',
      bedrooms: property.bedrooms?.toString() || '0',
      bathrooms: property.bathrooms?.toString() || '0',
      floors: property.floors?.toString() || '1',
      parking_spaces: property.parking_spaces?.toString() || '0',
      price: property.price?.toString() || '0',
      price_per_unit: property.price_per_unit?.toString() || '0',
      description: property.description || '',
      features: Array.isArray(property.features) ? property.features.join(', ') : '',
      owner_id: property.owner_id?.toString() || '',
      agent_id: property.agent_id?.toString() || '',
    });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deletingProperty) return;
    try {
      const result = await window.electronAPI.property.delete(deletingProperty.property_id, user.user_id);
      if (result?.success) {
        toast.success('Property removed');
        setShowDeleteModal(false);
        setDeletingProperty(null);
        loadData();
      }
    } catch (error) {
      toast.error('Error: ' + error.message);
    }
  };

  const handleStatusChange = async () => {
    if (!statusProperty || !newStatus) return;
    try {
      const result = await window.electronAPI.property.updateStatus(statusProperty.property_id, newStatus, user.user_id);
      if (result?.success) {
        toast.success(`Status changed to ${newStatus}`);
        setShowStatusModal(false);
        setStatusProperty(null);
        loadData();
      }
    } catch (error) {
      toast.error('Error: ' + error.message);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'Available': 'bg-green-100 text-green-800 border-green-300',
      'Sold': 'bg-gray-100 text-gray-800 border-gray-300',
      'Rented': 'bg-blue-100 text-blue-800 border-blue-300',
      'Under Negotiation': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'Reserved': 'bg-purple-100 text-purple-800 border-purple-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatPrice = (price) => {
    const num = parseFloat(price);
    if (num >= 10000000) return `Rs. ${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000) return `Rs. ${(num / 100000).toFixed(2)} Lac`;
    if (num >= 1000) return `Rs. ${(num / 1000).toFixed(1)}K`;
    return `Rs. ${num.toLocaleString()}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Back
            </button>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Property Listings</h1>
          <p className="text-gray-600 mt-2">Manage properties, listings, and deals</p>
        </div>

        {/* Statistics */}
        {statistics && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4 text-center border-l-4 border-blue-500">
              <p className="text-2xl font-bold text-gray-800">{statistics.active_listings || 0}</p>
              <p className="text-xs text-gray-500">Total Listings</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 text-center border-l-4 border-green-500">
              <p className="text-2xl font-bold text-green-600">{statistics.available || 0}</p>
              <p className="text-xs text-gray-500">Available</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 text-center border-l-4 border-gray-500">
              <p className="text-2xl font-bold text-gray-600">{statistics.sold || 0}</p>
              <p className="text-xs text-gray-500">Sold</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 text-center border-l-4 border-yellow-500">
              <p className="text-2xl font-bold text-yellow-600">{statistics.under_negotiation || 0}</p>
              <p className="text-xs text-gray-500">Under Negotiation</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 text-center border-l-4 border-purple-500">
              <p className="text-2xl font-bold text-purple-600">{formatPrice(statistics.total_available_value || 0)}</p>
              <p className="text-xs text-gray-500">Available Value</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by title, code, city, area..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
              <option value="">All Types</option>
              {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
              <option value="">All Status</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              onClick={() => { resetForm(); setEditingProperty(null); setShowModal(true); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              Add Property
            </button>
          </div>
        </div>

        {/* Property Cards Grid */}
        <div className="mb-6">
          {loading ? (
            <div className="text-center text-gray-500 py-12">Loading properties...</div>
          ) : properties.length === 0 ? (
            <div className="text-center text-gray-500 py-12 bg-white rounded-lg shadow-sm">
              <p className="text-lg">No properties found</p>
              <p className="text-sm mt-1">Add your first property listing</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {properties.map((property) => (
                <div key={property.property_id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow overflow-hidden">
                  {/* Card Header with Status */}
                  <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-gray-100 border-b flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-indigo-700">{property.property_code}</span>
                    <button
                      onClick={() => { setStatusProperty(property); setNewStatus(property.status); setShowStatusModal(true); }}
                      className={`px-2.5 py-1 text-xs font-bold rounded-full border cursor-pointer hover:opacity-80 ${getStatusColor(property.status)}`}
                    >
                      {property.status}
                    </button>
                  </div>

                  {/* Card Body */}
                  <div className="p-5">
                    <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-1">{property.title}</h3>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded">{property.property_type}</span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">{property.listing_type}</span>
                    </div>

                    {/* Location */}
                    {(property.city || property.area) && (
                      <p className="text-sm text-gray-600 mb-2">
                        📍 {[property.area, property.city].filter(Boolean).join(', ')}
                      </p>
                    )}

                    {/* Key Details */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {property.land_area > 0 && (
                        <div className="text-center bg-gray-50 rounded p-1.5">
                          <p className="text-xs text-gray-500">Area</p>
                          <p className="text-sm font-bold">{property.land_area} {AREA_UNITS.find(u => u.value === property.area_unit)?.label || property.area_unit}</p>
                        </div>
                      )}
                      {property.bedrooms > 0 && (
                        <div className="text-center bg-gray-50 rounded p-1.5">
                          <p className="text-xs text-gray-500">Beds</p>
                          <p className="text-sm font-bold">{property.bedrooms}</p>
                        </div>
                      )}
                      {property.bathrooms > 0 && (
                        <div className="text-center bg-gray-50 rounded p-1.5">
                          <p className="text-xs text-gray-500">Baths</p>
                          <p className="text-sm font-bold">{property.bathrooms}</p>
                        </div>
                      )}
                    </div>

                    {/* Price */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xl font-bold text-green-700">{formatPrice(property.price)}</span>
                      {property.price_per_unit > 0 && (
                        <span className="text-xs text-gray-500">Rs. {parseFloat(property.price_per_unit).toLocaleString()}/unit</span>
                      )}
                    </div>

                    {/* Agent / Owner */}
                    <div className="text-xs text-gray-500 flex justify-between">
                      {property.agent_name && <span>Agent: {property.agent_name}</span>}
                      {property.owner_name && <span>Owner: {property.owner_name}</span>}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="px-5 py-3 bg-gray-50 border-t flex justify-end gap-2">
                    <button onClick={() => handleEdit(property)} className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100">
                      Edit
                    </button>
                    <button onClick={() => { setDeletingProperty(property); setShowDeleteModal(true); }} className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 rounded-lg hover:bg-red-100">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create/Edit Modal — full-featured property form */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">{editingProperty ? 'Edit Property' : 'Add New Property'}</h2>
                  <p className="text-indigo-100 text-sm">{editingProperty ? `Updating ${editingProperty.property_code}` : 'List a new property'}</p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-3">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Title *</label>
                    <input type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className={`w-full px-3 py-2 border-2 rounded-lg ${formErrors.title ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-indigo-500`} placeholder="e.g., 5 Marla House in DHA Phase 5" />
                    {formErrors.title && <p className="text-red-500 text-xs mt-1">{formErrors.title}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Property Type *</label>
                    <select value={formData.property_type} onChange={(e) => setFormData({...formData, property_type: e.target.value})} className={`w-full px-3 py-2 border-2 rounded-lg ${formErrors.property_type ? 'border-red-500' : 'border-gray-300'}`}>
                      <option value="">Select Type</option>
                      {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {formErrors.property_type && <p className="text-red-500 text-xs mt-1">{formErrors.property_type}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Listing Type</label>
                    <select value={formData.listing_type} onChange={(e) => setFormData({...formData, listing_type: e.target.value})} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg">
                      {LISTING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Price (PKR) *</label>
                    <input type="number" min="0" step="1" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg" />
                  </div>
                </div>

                {/* Location */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-sm font-bold text-gray-700 mb-3">📍 Location</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div><label className="block text-xs text-gray-600 mb-1">Address</label><input type="text" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Street address" /></div>
                    <div><label className="block text-xs text-gray-600 mb-1">City</label><input type="text" value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="e.g., Lahore" /></div>
                    <div><label className="block text-xs text-gray-600 mb-1">Area / Sector</label><input type="text" value={formData.area} onChange={(e) => setFormData({...formData, area: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="e.g., DHA Phase 5" /></div>
                  </div>
                </div>

                {/* Dimensions & Features */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-sm font-bold text-gray-700 mb-3">📐 Dimensions & Features</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div><label className="block text-xs text-gray-600 mb-1">Land Area</label><input type="number" min="0" step="0.01" value={formData.land_area} onChange={(e) => setFormData({...formData, land_area: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                    <div><label className="block text-xs text-gray-600 mb-1">Built Area</label><input type="number" min="0" step="0.01" value={formData.built_area} onChange={(e) => setFormData({...formData, built_area: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                    <div><label className="block text-xs text-gray-600 mb-1">Area Unit</label><select value={formData.area_unit} onChange={(e) => setFormData({...formData, area_unit: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">{AREA_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}</select></div>
                    <div><label className="block text-xs text-gray-600 mb-1">Price/Unit</label><input type="number" min="0" step="1" value={formData.price_per_unit} onChange={(e) => setFormData({...formData, price_per_unit: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                    <div><label className="block text-xs text-gray-600 mb-1">Bedrooms</label><input type="number" min="0" value={formData.bedrooms} onChange={(e) => setFormData({...formData, bedrooms: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                    <div><label className="block text-xs text-gray-600 mb-1">Bathrooms</label><input type="number" min="0" value={formData.bathrooms} onChange={(e) => setFormData({...formData, bathrooms: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                    <div><label className="block text-xs text-gray-600 mb-1">Floors</label><input type="number" min="1" value={formData.floors} onChange={(e) => setFormData({...formData, floors: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                    <div><label className="block text-xs text-gray-600 mb-1">Parking</label><input type="number" min="0" value={formData.parking_spaces} onChange={(e) => setFormData({...formData, parking_spaces: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                  </div>
                </div>

                {/* Owner & Agent */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Owner</label>
                    <select value={formData.owner_id} onChange={(e) => setFormData({...formData, owner_id: e.target.value})} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg">
                      <option value="">Select Owner</option>
                      {owners.map(o => <option key={o.company_id} value={o.company_id}>{o.company_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Agent</label>
                    <select value={formData.agent_id} onChange={(e) => setFormData({...formData, agent_id: e.target.value})} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg">
                      <option value="">Select Agent</option>
                      {agents.map(a => <option key={a.dealer_id} value={a.dealer_id}>{a.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Description & Features */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg" rows="3" placeholder="Property description..." />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Features (comma-separated)</label>
                  <input type="text" value={formData.features} onChange={(e) => setFormData({...formData, features: e.target.value})} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg" placeholder="e.g., Garden, Servant Quarter, Corner Plot, Near Park" />
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-100">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700">{editingProperty ? 'Update' : 'List Property'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Status Change Modal */}
        {showStatusModal && statusProperty && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-sm w-full p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-3">Change Status</h2>
              <p className="text-sm text-gray-600 mb-4">Update status for <strong>{statusProperty.title}</strong></p>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg mb-4">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="flex gap-3">
                <button onClick={() => setShowStatusModal(false)} className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold">Cancel</button>
                <button onClick={handleStatusChange} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700">Update</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        {showDeleteModal && deletingProperty && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Remove Listing?</h2>
              <p className="text-gray-600 mb-4">Remove <strong>{deletingProperty.title}</strong> ({deletingProperty.property_code})?</p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold">Cancel</button>
                <button onClick={handleDelete} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700">Remove</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyListingsPage;
