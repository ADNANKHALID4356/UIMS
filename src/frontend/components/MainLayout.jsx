import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logoutUser } from '../store/slices/authSlice';
import { setTheme } from '../store/slices/uiSlice';
import Sidebar from './Sidebar';
import Breadcrumb from './Breadcrumb';
import useKeyboardShortcuts from './useKeyboardShortcuts';

/**
 * MainLayout Component
 * ====================
 * Layout wrapper providing sidebar navigation + header + content area.
 * Adapts to industry configuration for labels and navigation.
 * SRS v2.0 Sprint 1 — Layout Restructuring
 */
const MainLayout = ({ children }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const { industryConfig } = useAppSelector((state) => state.organization);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Global keyboard shortcuts (Ctrl+N, Ctrl+P, Ctrl+B, Ctrl+D, Ctrl+F)
  useKeyboardShortcuts();

  // Restore theme from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('ais-theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
      dispatch(setTheme('dark'));
    }
  }, [dispatch]);

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 dark:text-gray-100">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content Area */}
      <div
        className={`transition-all duration-300 ${
          sidebarCollapsed ? 'ml-16' : 'ml-64'
        }`}
      >
        {/* Top Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-3 flex justify-between items-center">
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {industryConfig?.businessName || 'Enterprise Inventory System'}
              </h1>
              <p className="text-xs text-gray-500">
                {industryConfig?.displayName || 'Universal Enterprise Inventory System v2.0'}
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* User info */}
              <div className="text-right">
                <p className="text-sm font-medium text-gray-800">
                  {user?.full_name || 'User'}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {user?.role || 'admin'}
                </p>
              </div>

              {/* User avatar */}
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">
                  {(user?.full_name || 'U').charAt(0).toUpperCase()}
                </span>
              </div>

              {/* Logout button */}
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                title="Logout"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          <Breadcrumb />
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
