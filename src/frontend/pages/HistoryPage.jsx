import React, { useState, useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  fetchHistory,
  fetchTableNames,
  fetchHistoryStatistics,
  setHistoryFilters,
  resetHistoryFilters,
  clearHistoryError,
} from '../store/slices/historySlice';

import PermissionGate from '../components/PermissionGate';

/**
 * HistoryPage — Audit trail / activity log viewer
 * Shows all CREATE, UPDATE, DELETE operations across all entity tables.
 * Sprint 3 - SRS: "History logging for all CRUD operations"
 */
const HistoryPage = () => {
  const dispatch = useAppDispatch();
  const { entries, total, tableNames, statistics, loading, error, filters } = useAppSelector((s) => s.history);
  const { user: currentUser } = useAppSelector((s) => s.auth);
  const [expandedRow, setExpandedRow] = useState(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearBeforeDate, setClearBeforeDate] = useState('');
  const [clearProcessing, setClearProcessing] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(null);

  // Load on mount
  useEffect(() => {
    dispatch(fetchTableNames());
    dispatch(fetchHistoryStatistics());
    dispatch(fetchHistory(filters));
  }, []);

  // Reload when filters change
  const applyFilters = useCallback(() => {
    dispatch(fetchHistory(filters));
  }, [dispatch, filters]);

  useEffect(() => {
    const timer = setTimeout(() => applyFilters(), 400);
    return () => clearTimeout(timer);
  }, [filters]);

  // Auto-dismiss errors
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => dispatch(clearHistoryError()), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Auto-dismiss clear success
  useEffect(() => {
    if (clearSuccess) {
      const timer = setTimeout(() => setClearSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [clearSuccess]);

  const handleClearOldLogs = async () => {
    if (!clearBeforeDate) return;
    setClearProcessing(true);
    try {
      const result = await window.electronAPI.history.clearOlder(clearBeforeDate);
      if (result?.success) {
        setClearSuccess(`Deleted ${result.data?.deleted || 0} log entries older than ${clearBeforeDate}`);
        setShowClearModal(false);
        setClearBeforeDate('');
        // Refresh data
        dispatch(fetchHistory(filters));
        dispatch(fetchHistoryStatistics());
      } else {
        setClearSuccess(null);
        alert(result?.error || 'Failed to clear logs');
      }
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setClearProcessing(false);
    }
  };

  const handleFilterChange = (key, value) => {
    dispatch(setHistoryFilters({ [key]: value, offset: 0 }));
  };

  const handlePageChange = (direction) => {
    const newOffset = direction === 'next'
      ? filters.offset + filters.limit
      : Math.max(0, filters.offset - filters.limit);
    dispatch(setHistoryFilters({ offset: newOffset }));
  };

  const handleResetFilters = () => {
    dispatch(resetHistoryFilters());
  };

  // Format timestamp
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-PK', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return dateStr;
    }
  };

  // Safely parse JSON
  const safeParseJSON = (str) => {
    if (!str) return null;
    try { return JSON.parse(str); } catch { return null; }
  };

  // Action type badge colors
  const actionColors = {
    CREATE: 'bg-green-50 text-green-700',
    UPDATE: 'bg-blue-50 text-blue-700',
    DELETE: 'bg-red-50 text-red-700',
  };

  const currentPage = Math.floor(filters.offset / filters.limit) + 1;
  const totalPages = Math.ceil(total / filters.limit);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Activity Log</h1>
          <p className="text-gray-500 text-sm mt-1">
            Audit trail of all create, update, and delete operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PermissionGate permission="can_delete_entities">
            <button
              onClick={() => setShowClearModal(true)}
              className="px-3 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              Clear Old Logs
            </button>
          </PermissionGate>
          <button
            onClick={handleResetFilters}
            className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <span className="text-red-700 text-sm">{error}</span>
          <button onClick={() => dispatch(clearHistoryError())} className="text-red-500 hover:text-red-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Stats Bar */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">Total Entries</p>
            <p className="text-lg font-bold text-gray-800">{statistics.total_entries || 0}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">Creates</p>
            <p className="text-lg font-bold text-green-600">{statistics.creates || 0}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">Updates</p>
            <p className="text-lg font-bold text-blue-600">{statistics.updates || 0}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">Deletes</p>
            <p className="text-lg font-bold text-red-600">{statistics.deletes || 0}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">Tables Tracked</p>
            <p className="text-lg font-bold text-purple-600">{statistics.tables_affected || 0}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <input
              type="text"
              value={filters.searchTerm}
              onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
              placeholder="Search descriptions..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {/* Table filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Table</label>
            <select
              value={filters.tableName}
              onChange={(e) => handleFilterChange('tableName', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Tables</option>
              {tableNames.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          {/* Action filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
            <select
              value={filters.actionType}
              onChange={(e) => handleFilterChange('actionType', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Actions</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
            </select>
          </div>
          {/* Date filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          <span className="ml-3 text-gray-500 text-sm">Loading activity log...</span>
        </div>
      )}

      {/* Table */}
      {!loading && entries.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-10">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Table</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Record ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry, idx) => {
                  const isExpanded = expandedRow === entry.history_id;
                  const oldValues = safeParseJSON(entry.old_values);
                  const newValues = safeParseJSON(entry.new_values);

                  return (
                    <React.Fragment key={entry.history_id}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-400">{filters.offset + idx + 1}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(entry.performed_at)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${actionColors[entry.action_type] || 'bg-gray-50 text-gray-600'}`}>
                            {entry.action_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">{entry.table_name}</td>
                        <td className="px-4 py-3 text-sm font-mono text-blue-600">{entry.record_id || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={entry.description}>
                          {entry.description || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{entry.performed_by_name || `User #${entry.performed_by}`}</td>
                        <td className="px-4 py-3 text-center">
                          {(oldValues || newValues) && (
                            <button
                              onClick={() => setExpandedRow(isExpanded ? null : entry.history_id)}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                              title="View details"
                            >
                              <svg className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="px-4 py-3 bg-gray-50">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                              {oldValues && (
                                <div>
                                  <p className="font-semibold text-gray-700 mb-1">Previous Values:</p>
                                  <pre className="bg-white p-3 rounded border border-gray-200 overflow-x-auto max-h-48 text-gray-600">
                                    {JSON.stringify(oldValues, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {newValues && (
                                <div>
                                  <p className="font-semibold text-gray-700 mb-1">New Values:</p>
                                  <pre className="bg-white p-3 rounded border border-gray-200 overflow-x-auto max-h-48 text-gray-600">
                                    {JSON.stringify(newValues, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {filters.offset + 1}–{Math.min(filters.offset + filters.limit, total)} of {total} entries
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange('prev')}
                disabled={filters.offset === 0}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition-colors"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-600">
                Page {currentPage} of {totalPages || 1}
              </span>
              <button
                onClick={() => handlePageChange('next')}
                disabled={filters.offset + filters.limit >= total}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && entries.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-800 mb-1">No activity found</h3>
          <p className="text-gray-500 text-sm mb-4">
            {filters.tableName || filters.actionType || filters.searchTerm || filters.startDate
              ? 'No entries match your current filters. Try adjusting the search criteria.'
              : 'Activity will appear here as you create, edit, and delete records.'}
          </p>
        </div>
      )}

      {/* Clear Success Banner */}
      {clearSuccess && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 bg-green-50 border border-green-300 rounded-lg shadow-lg flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-green-800 font-medium">{clearSuccess}</span>
        </div>
      )}

      {/* Clear Old Logs Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Clear Old Activity Logs</h3>
                <p className="text-sm text-gray-500">This action is permanent and cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-4">
              All activity log entries <strong>older than</strong> the selected date will be permanently deleted.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Delete entries before:</label>
              <input
                type="date"
                value={clearBeforeDate}
                onChange={(e) => setClearBeforeDate(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowClearModal(false); setClearBeforeDate(''); }}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                disabled={clearProcessing}
              >
                Cancel
              </button>
              <button
                onClick={handleClearOldLogs}
                disabled={clearProcessing || !clearBeforeDate}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {clearProcessing ? 'Deleting...' : 'Delete Old Logs'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
