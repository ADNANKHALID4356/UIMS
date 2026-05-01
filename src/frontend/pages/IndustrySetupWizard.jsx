import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setupOrganization, fetchAvailableIndustries } from '../store/slices/organizationSlice';

/**
 * Industry Setup Wizard
 * =====================
 * First-time setup flow shown when no organization is configured.
 * SRS v2.0 Sprint 2 — Industry Setup & Configuration
 * 
 * Steps:
 *   1. Select Industry Type
 *   2. Enter Business Details
 *   3. Review & Confirm
 */
const IndustrySetupWizard = ({ onComplete }) => {
  const dispatch = useAppDispatch();
  const { isSettingUp, setupError, availableIndustries } = useAppSelector(
    (state) => state.organization
  );

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const [businessDetails, setBusinessDetails] = useState({
    businessName: '',
    ownerName: '',
    address: '',
    phone: '',
    email: '',
    currency: 'PKR',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    dispatch(fetchAvailableIndustries());
  }, [dispatch]);

  // Industry options (fallback if API hasn't loaded yet)
  const industries = availableIndustries.length > 0 ? availableIndustries : [
    {
      value: 'RETAIL',
      label: 'General Store / Retail',
      description: 'Shopping marts, electronics, showrooms, plazas, clothing, hardware stores',
      icon: '🏪',
    },
    {
      value: 'MEDICAL',
      label: 'Medical Store / Pharmacy',
      description: 'Medicine inventory, prescriptions, patient management, batch & expiry tracking',
      icon: '🏥',
    },
    {
      value: 'REAL_ESTATE',
      label: 'Real Estate Business',
      description: 'Properties, clients, deals, commissions, installment tracking',
      icon: '🏠',
    },
    {
      value: 'AGRICULTURAL',
      label: 'Agricultural Business',
      description: 'Farmers, grain trading, agricultural products, dealer management',
      icon: '🌾',
    },
  ];

  const validateStep2 = () => {
    const newErrors = {};
    if (!businessDetails.businessName.trim()) {
      newErrors.businessName = 'Business name is required';
    }
    if (!businessDetails.ownerName.trim()) {
      newErrors.ownerName = 'Owner name is required';
    }
    if (businessDetails.phone && !/^[\d\-+() ]{7,20}$/.test(businessDetails.phone)) {
      newErrors.phone = 'Invalid phone number format';
    }
    if (businessDetails.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessDetails.email)) {
      newErrors.email = 'Invalid email format';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1 && !selectedIndustry) {
      setErrors({ industry: 'Please select an industry type' });
      return;
    }
    if (currentStep === 2 && !validateStep2()) {
      return;
    }
    setErrors({});
    setCurrentStep((prev) => Math.min(prev + 1, 3));
  };

  const handleBack = () => {
    setErrors({});
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    const setupData = {
      industryType: selectedIndustry,
      businessName: businessDetails.businessName.trim(),
      ownerName: businessDetails.ownerName.trim(),
      address: businessDetails.address.trim() || undefined,
      phone: businessDetails.phone.trim() || undefined,
      email: businessDetails.email.trim() || undefined,
      currency: businessDetails.currency,
    };

    const result = await dispatch(setupOrganization(setupData));
    if (setupOrganization.fulfilled.match(result)) {
      onComplete?.();
    }
  };

  const handleInputChange = (field, value) => {
    setBusinessDetails((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const selectedIndustryInfo = industries.find((i) => i.value === selectedIndustry);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome to Enterprise Inventory System
          </h1>
          <p className="text-gray-600 mt-2">
            Let's set up your business in just a few steps
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((step) => (
            <React.Fragment key={step}>
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm transition-all ${
                  currentStep >= step
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {currentStep > step ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step
                )}
              </div>
              {step < 3 && (
                <div
                  className={`w-20 h-1 mx-2 rounded ${
                    currentStep > step ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step Labels */}
        <div className="flex justify-between mb-8 px-4 text-sm text-gray-500">
          <span className={currentStep >= 1 ? 'text-blue-600 font-medium' : ''}>Select Industry</span>
          <span className={currentStep >= 2 ? 'text-blue-600 font-medium' : ''}>Business Details</span>
          <span className={currentStep >= 3 ? 'text-blue-600 font-medium' : ''}>Review & Confirm</span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="p-8">
            {/* Step 1: Select Industry */}
            {currentStep === 1 && (
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">
                  What type of business do you run?
                </h2>
                <p className="text-gray-500 mb-6">
                  This determines the terminology, features, and workflows available in your system.
                </p>

                {errors.industry && (
                  <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                    {errors.industry}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {industries.map((industry) => (
                    <button
                      key={industry.value}
                      onClick={() => {
                        setSelectedIndustry(industry.value);
                        setErrors({});
                      }}
                      className={`p-5 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                        selectedIndustry === industry.value
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="text-3xl mb-3">{industry.icon}</div>
                      <h3 className="font-bold text-gray-800 mb-1">{industry.label}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">
                        {industry.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Business Details */}
            {currentStep === 2 && (
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">
                  Business Details
                </h2>
                <p className="text-gray-500 mb-6">
                  Enter your business information. This will appear on receipts and reports.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Business Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={businessDetails.businessName}
                      onChange={(e) => handleInputChange('businessName', e.target.value)}
                      className={`w-full px-4 py-3 rounded-lg border ${
                        errors.businessName ? 'border-red-500' : 'border-gray-300'
                      } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all`}
                      placeholder="e.g., Ali General Store, City Pharmacy, Prime Realtors"
                    />
                    {errors.businessName && (
                      <p className="mt-1 text-sm text-red-500">{errors.businessName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Owner Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={businessDetails.ownerName}
                      onChange={(e) => handleInputChange('ownerName', e.target.value)}
                      className={`w-full px-4 py-3 rounded-lg border ${
                        errors.ownerName ? 'border-red-500' : 'border-gray-300'
                      } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all`}
                      placeholder="Full name of the business owner"
                    />
                    {errors.ownerName && (
                      <p className="mt-1 text-sm text-red-500">{errors.ownerName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Business Address
                    </label>
                    <input
                      type="text"
                      value={businessDetails.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="Street address, city"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        value={businessDetails.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className={`w-full px-4 py-3 rounded-lg border ${
                          errors.phone ? 'border-red-500' : 'border-gray-300'
                        } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all`}
                        placeholder="e.g., 03XX-XXXXXXX"
                      />
                      {errors.phone && (
                        <p className="mt-1 text-sm text-red-500">{errors.phone}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={businessDetails.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className={`w-full px-4 py-3 rounded-lg border ${
                          errors.email ? 'border-red-500' : 'border-gray-300'
                        } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all`}
                        placeholder="business@example.com"
                      />
                      {errors.email && (
                        <p className="mt-1 text-sm text-red-500">{errors.email}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Currency
                    </label>
                    <select
                      value={businessDetails.currency}
                      onChange={(e) => handleInputChange('currency', e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    >
                      <option value="PKR">PKR - Pakistani Rupee</option>
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="AED">AED - UAE Dirham</option>
                      <option value="SAR">SAR - Saudi Riyal</option>
                      <option value="INR">INR - Indian Rupee</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Review & Confirm */}
            {currentStep === 3 && (
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">
                  Review Your Setup
                </h2>
                <p className="text-gray-500 mb-6">
                  Please review your settings before confirming. You can change these later in Settings.
                </p>

                {setupError && (
                  <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                    Setup failed: {setupError}
                  </div>
                )}

                <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                  <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
                    <span className="text-4xl">{selectedIndustryInfo?.icon}</span>
                    <div>
                      <h3 className="font-bold text-gray-800 text-lg">
                        {selectedIndustryInfo?.label}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {selectedIndustryInfo?.description}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-500">Business Name</span>
                      <p className="font-medium text-gray-800">{businessDetails.businessName}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Owner Name</span>
                      <p className="font-medium text-gray-800">{businessDetails.ownerName}</p>
                    </div>
                    {businessDetails.address && (
                      <div>
                        <span className="text-sm text-gray-500">Address</span>
                        <p className="font-medium text-gray-800">{businessDetails.address}</p>
                      </div>
                    )}
                    {businessDetails.phone && (
                      <div>
                        <span className="text-sm text-gray-500">Phone</span>
                        <p className="font-medium text-gray-800">{businessDetails.phone}</p>
                      </div>
                    )}
                    {businessDetails.email && (
                      <div>
                        <span className="text-sm text-gray-500">Email</span>
                        <p className="font-medium text-gray-800">{businessDetails.email}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-sm text-gray-500">Currency</span>
                      <p className="font-medium text-gray-800">{businessDetails.currency}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>What happens next:</strong> Your system will be configured with 
                    {' '}{selectedIndustryInfo?.label} terminology and features. All labels, 
                    navigation, and workflows will adapt to your industry. You can always 
                    change your industry type later from Settings.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer with navigation buttons */}
          <div className="px-8 py-5 bg-gray-50 border-t border-gray-100 flex justify-between">
            <button
              onClick={handleBack}
              disabled={currentStep === 1}
              className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
                currentStep === 1
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              Back
            </button>

            {currentStep < 3 ? (
              <button
                onClick={handleNext}
                className="px-8 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-md hover:shadow-lg transition-all"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSettingUp}
                className={`px-8 py-2.5 rounded-lg font-medium shadow-md transition-all ${
                  isSettingUp
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700 hover:shadow-lg'
                }`}
              >
                {isSettingUp ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Setting up...
                  </span>
                ) : (
                  'Confirm & Start'
                )}
              </button>
            )}
          </div>
        </div>

        {/* Version info */}
        <p className="text-center text-xs text-gray-400 mt-4">
          Universal Enterprise Inventory System v2.0
        </p>
      </div>
    </div>
  );
};

export default IndustrySetupWizard;
