import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  ArrowLeftIcon,
  CloudArrowUpIcon,
  CloudArrowDownIcon,
  TrashIcon,
  FolderArrowDownIcon,
  DocumentArrowDownIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowPathIcon,
  CalendarIcon,
  ServerStackIcon,
  TableCellsIcon,
  ArchiveBoxArrowDownIcon,
  DocumentTextIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';

/**
 * BackupPage - Sprint 8: Backup & Restore + Data Archive
 * Data backup, restore, export, and archive functionality
 */
const BackupPage = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [backups, setBackups] = useState([]);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  // Archive state
  const [archiveSummary, setArchiveSummary] = useState(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [exportedData, setExportedData] = useState(null);
  const [showDeleteArchiveModal, setShowDeleteArchiveModal] = useState(false);
  const [deleteOptions, setDeleteOptions] = useState({
    deleteTransactions: true,
    deleteLedgers: true,
    deleteMovements: true
  });
  const [dateRange, setDateRange] = useState({
    dateFrom: '',
    dateTo: ''
  });

  // Load backup history on mount
  useEffect(() => {
    loadBackups();
    loadArchiveSummary();
  }, []);

  const loadBackups = async () => {
    try {
      // Use backup.list() which is the actual exposed API method
      const result = await window.electronAPI.backup.list();
      if (result.success) {
        // The data is returned directly as an array
        setBackups(result.data || []);
      } else {
        console.error('Failed to load backups:', result.message);
      }
    } catch (err) {
      console.error('Error loading backups:', err);
    }
  };

  const loadArchiveSummary = async () => {
    try {
      const result = await window.electronAPI.archive.getSummary();
      if (result.success) {
        setArchiveSummary(result.data);
      }
    } catch (err) {
      console.error('Error loading archive summary:', err);
    }
  };

  const createBackup = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Pass description and userId (null for current user)
      const result = await window.electronAPI.backup.create('Manual backup', null);
      if (result.success) {
        setSuccess(`Backup created successfully: ${result.data.backup_name}`);
        loadBackups();
      } else {
        setError(result.message || 'Failed to create backup');
      }
    } catch (err) {
      console.error('Error creating backup:', err);
      setError(err.message || 'An error occurred while creating backup');
    } finally {
      setLoading(false);
    }
  };

  const restoreBackup = async () => {
    if (!selectedBackup && !restoreConfirm) {
      setError('Please select a backup to restore');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // If no backup selected, use backup.import() to trigger file dialog
      // Otherwise, restore from backupId
      const result = selectedBackup 
        ? await window.electronAPI.backup.restore(selectedBackup, user?.user_id)
        : await window.electronAPI.backup.import(user?.user_id);
        
      if (result.success) {
        setSuccess('Database restored successfully! The application will need to restart.');
        setRestoreConfirm(false);
        setSelectedBackup(null);
        loadBackups();
      } else {
        setError(result.message || 'Failed to restore backup');
      }
    } catch (err) {
      console.error('Error restoring backup:', err);
      setError(err.message || 'An error occurred while restoring backup');
    } finally {
      setLoading(false);
      setRestoreConfirm(false);
    }
  };

  // Validation feature removed - not available in preload API

  const deleteBackup = async (backupId) => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const result = await window.electronAPI.backup.delete(backupId, user?.user_id);
      if (result.success) {
        setSuccess('Backup deleted successfully');
        setDeleteConfirm(null);
        loadBackups();
      } else {
        setError(result.message || 'Failed to delete backup');
      }
    } catch (err) {
      console.error('Error deleting backup:', err);
      setError(err.message || 'An error occurred while deleting backup');
    } finally {
      setLoading(false);
    }
  };

  const exportBackupFile = async () => {
    if (!selectedBackup) {
      setError('Please select a backup to export');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const result = await window.electronAPI.backup.export(selectedBackup);
      if (result.success) {
        setSuccess(`Backup exported successfully to: ${result.data.exportPath}`);
      } else {
        setError(result.message || 'Failed to export backup');
      }
    } catch (err) {
      console.error('Error exporting backup:', err);
      setError(err.message || 'An error occurred while exporting backup');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // ========== DATA ARCHIVE FUNCTIONS ==========
  
  const exportDataToCSV = async () => {
    setArchiveLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const options = {
        dateFrom: dateRange.dateFrom || undefined,
        dateTo: dateRange.dateTo || undefined,
        includeTransactions: true,
        includeLedgers: true,
        includeMovements: true
      };
      
      const result = await window.electronAPI.archive.exportCSV(options);
      if (result.success) {
        setExportedData(result.data);
        setSuccess(`Data exported successfully! ${result.data.counts.transactions} transactions, ${result.data.counts.ledgerEntries} ledger entries, ${result.data.counts.movements} movements saved to CSV.`);
        loadArchiveSummary();
      } else {
        if (result.message !== 'Export cancelled') {
          setError(result.message || 'Failed to export data');
        }
      }
    } catch (err) {
      console.error('Error exporting data:', err);
      setError(err.message || 'An error occurred while exporting data');
    } finally {
      setArchiveLoading(false);
    }
  };

  const deleteArchivedData = async () => {
    if (!exportedData) {
      setError('Please export data first before deleting');
      return;
    }
    
    setArchiveLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const options = {
        transactionIds: exportedData.exportedIds.transactionIds,
        ledgerIds: exportedData.exportedIds.ledgerIds,
        movementIds: exportedData.exportedIds.movementIds,
        deleteTransactions: deleteOptions.deleteTransactions,
        deleteLedgers: deleteOptions.deleteLedgers,
        deleteMovements: deleteOptions.deleteMovements
      };
      
      const result = await window.electronAPI.archive.deleteData(options);
      if (result.success) {
        const deleted = result.data;
        setSuccess(`Archived data deleted successfully! Removed: ${deleted.transactions} transactions, ${deleted.ledgerEntries} ledger entries, ${deleted.movements} movements.`);
        setExportedData(null);
        setShowDeleteArchiveModal(false);
        loadArchiveSummary();
      } else {
        setError(result.message || 'Failed to delete archived data');
      }
    } catch (err) {
      console.error('Error deleting archived data:', err);
      setError(err.message || 'An error occurred while deleting archived data');
    } finally {
      setArchiveLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeftIcon className="h-5 w-5" />
              <span>Back</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ServerStackIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Backup & Restore</h1>
                <p className="text-sm text-gray-500">Manage database backups and exports</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <XCircleIcon className="h-5 w-5" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5" />
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Actions Panel */}
          <div className="lg:col-span-1 space-y-6">
            {/* Create Backup */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CloudArrowUpIcon className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">Create Backup</h2>
                  <p className="text-sm text-gray-500">Save current database state</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Create a complete backup of your database including all entities, 
                transactions, and configuration data.
              </p>
              <button
                onClick={createBackup}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <CloudArrowUpIcon className="h-5 w-5" />
                    <span>Create Backup Now</span>
                  </>
                )}
              </button>
            </div>

            {/* Restore from File */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <CloudArrowDownIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">Restore Backup</h2>
                  <p className="text-sm text-gray-500">Restore from a backup file</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Restore your database from a previous backup. This will replace 
                all current data with the backup data.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-700">
                    Warning: Restoring a backup will overwrite all current data. 
                    Create a backup first!
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedBackup(null);
                  setRestoreConfirm(true);
                }}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                <FolderArrowDownIcon className="h-5 w-5" />
                <span>Choose Backup File</span>
              </button>
            </div>

            {/* Export Backup */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <DocumentArrowDownIcon className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">Export Backup</h2>
                  <p className="text-sm text-gray-500">Export selected backup to a location</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                {selectedBackup 
                  ? 'Click below to export the selected backup file to a location of your choice.' 
                  : 'Select a backup from the history below to export it.'}
              </p>
              <button
                onClick={exportBackupFile}
                disabled={loading || !selectedBackup}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                <DocumentArrowDownIcon className="h-5 w-5" />
                <span>Export Backup File</span>
              </button>
            </div>
          </div>

          {/* Backup History */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ClockIcon className="h-5 w-5 text-gray-500" />
                  <h2 className="font-semibold text-gray-900">Backup History</h2>
                </div>
                <button
                  onClick={loadBackups}
                  disabled={loading}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              
              {backups.length === 0 ? (
                <div className="p-12 text-center">
                  <ServerStackIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Backups Yet</h3>
                  <p className="text-gray-500 mb-4">Create your first backup to protect your data</p>
                  <button
                    onClick={createBackup}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                  >
                    <CloudArrowUpIcon className="h-5 w-5" />
                    <span>Create First Backup</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {backups.map((backup, index) => (
                    <div
                      key={index}
                      className={`p-4 hover:bg-gray-50 transition-colors ${
                        selectedBackup === backup.backup_id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-green-100">
                            <CloudArrowUpIcon className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{backup.backup_name}</h3>
                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <CalendarIcon className="h-4 w-4" />
                                {formatDate(backup.backup_date)}
                              </span>
                              <span>{formatFileSize(backup.backup_size)}</span>
                              {backup.description && (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                                  {backup.description}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedBackup(backup.backup_id);
                              setRestoreConfirm(true);
                            }}
                            disabled={loading}
                            className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Restore Backup"
                          >
                            <CloudArrowDownIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(backup.backup_id)}
                            disabled={loading}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Backup"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Validation Result */}
            {validationResult && (
              <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <ShieldCheckIcon className={`h-6 w-6 ${validationResult.isValid ? 'text-green-600' : 'text-red-600'}`} />
                  <h3 className="font-semibold text-gray-900">Validation Result</h3>
                </div>
                
                {validationResult.isValid ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800">Backup is Valid</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                      {validationResult.tables && Object.entries(validationResult.tables).map(([table, count]) => (
                        <div key={table} className="bg-white rounded-lg p-3 border border-green-200">
                          <div className="text-gray-500 capitalize">{table.replace('_', ' ')}</div>
                          <div className="font-semibold text-gray-900">{count} records</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <XCircleIcon className="h-5 w-5 text-red-600" />
                      <span className="font-medium text-red-800">Backup is Invalid or Corrupted</span>
                    </div>
                    {validationResult.error && (
                      <p className="mt-2 text-sm text-red-700">{validationResult.error}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ========== DATA ARCHIVE SECTION ========== */}
        <div className="mt-8">
          <div className="bg-gradient-to-r from-orange-600 to-amber-600 rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <ArchiveBoxArrowDownIcon className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Data Archive & Export</h2>
                <p className="text-orange-100">Export transactions, ledgers, and movements to CSV file, then delete to free space</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Archive Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <TableCellsIcon className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Data Summary</h3>
                  <p className="text-sm text-gray-500">Records available for export</p>
                </div>
              </div>
              
              {archiveSummary ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm font-medium text-blue-900">Transactions</span>
                    <span className="text-lg font-bold text-blue-600">{archiveSummary.transactions?.total || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="text-sm font-medium text-green-900">Ledger Entries</span>
                    <span className="text-lg font-bold text-green-600">{archiveSummary.ledgerEntries?.total || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                    <span className="text-sm font-medium text-purple-900">Stock Movements</span>
                    <span className="text-lg font-bold text-purple-600">{archiveSummary.movements?.total || 0}</span>
                  </div>
                  <button
                    onClick={loadArchiveSummary}
                    className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                  >
                    <ArrowPathIcon className="h-4 w-4" />
                    Refresh Summary
                  </button>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto mb-2" />
                  Loading summary...
                </div>
              )}
            </div>

            {/* Export to CSV */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <DocumentTextIcon className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Export to CSV</h3>
                  <p className="text-sm text-gray-500">Download data as CSV file</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Range (Optional)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={dateRange.dateFrom}
                      onChange={(e) => setDateRange(prev => ({ ...prev, dateFrom: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      placeholder="From"
                    />
                    <input
                      type="date"
                      value={dateRange.dateTo}
                      onChange={(e) => setDateRange(prev => ({ ...prev, dateTo: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      placeholder="To"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Leave empty to export all data</p>
                </div>
                
                <button
                  onClick={exportDataToCSV}
                  disabled={archiveLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {archiveLoading ? (
                    <>
                      <ArrowPathIcon className="h-5 w-5 animate-spin" />
                      <span>Exporting...</span>
                    </>
                  ) : (
                    <>
                      <DocumentArrowDownIcon className="h-5 w-5" />
                      <span>Export Data to CSV</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Delete Archived Data */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-lg">
                  <TrashIcon className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Delete Exported Data</h3>
                  <p className="text-sm text-gray-500">Free up space after export</p>
                </div>
              </div>
              
              {exportedData ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800">Export Complete</span>
                    </div>
                    <div className="text-sm text-green-700 space-y-1">
                      <p>• {exportedData.counts.transactions} transactions</p>
                      <p>• {exportedData.counts.ledgerEntries} ledger entries</p>
                      <p>• {exportedData.counts.movements} movements</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setShowDeleteArchiveModal(true)}
                    disabled={archiveLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    <TrashIcon className="h-5 w-5" />
                    <span>Delete Exported Records</span>
                  </button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <ArchiveBoxArrowDownIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Export data first to enable deletion</p>
                  <p className="text-xs text-gray-400 mt-1">This ensures you have a copy before deleting</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Restore Confirmation Modal */}
      {restoreConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-yellow-100 rounded-full">
                <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Confirm Restore</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Are you sure you want to restore from this backup? This action will:
            </p>
            <ul className="text-sm text-gray-600 mb-6 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-red-500">•</span>
                <span>Replace ALL current data with backup data</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500">•</span>
                <span>This action cannot be undone</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">•</span>
                <span>A safety backup will be created first</span>
              </li>
            </ul>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setRestoreConfirm(false);
                  setSelectedBackup(null);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={restoreBackup}
                disabled={loading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Restoring...' : 'Yes, Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <TrashIcon className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Backup</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this backup? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteBackup(deleteConfirm)}
                disabled={loading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Archive Data Modal */}
      {showDeleteArchiveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <TrashIcon className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Exported Data</h3>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Warning: This action cannot be undone!</p>
                  <p className="text-sm text-yellow-700 mt-1">Make sure you have saved the exported CSV file before deleting.</p>
                </div>
              </div>
            </div>

            <p className="text-gray-600 mb-4">
              Select which data types to delete from the database:
            </p>
            
            <div className="space-y-3 mb-6">
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                <input
                  type="checkbox"
                  checked={deleteOptions.deleteTransactions}
                  onChange={(e) => setDeleteOptions(prev => ({ ...prev, deleteTransactions: e.target.checked }))}
                  className="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                />
                <div>
                  <span className="font-medium text-gray-900">Transactions</span>
                  <span className="text-sm text-gray-500 ml-2">({exportedData?.counts.transactions || 0} records)</span>
                </div>
              </label>
              
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                <input
                  type="checkbox"
                  checked={deleteOptions.deleteLedgers}
                  onChange={(e) => setDeleteOptions(prev => ({ ...prev, deleteLedgers: e.target.checked }))}
                  className="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                />
                <div>
                  <span className="font-medium text-gray-900">Ledger Entries</span>
                  <span className="text-sm text-gray-500 ml-2">({exportedData?.counts.ledgerEntries || 0} records)</span>
                </div>
              </label>
              
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                <input
                  type="checkbox"
                  checked={deleteOptions.deleteMovements}
                  onChange={(e) => setDeleteOptions(prev => ({ ...prev, deleteMovements: e.target.checked }))}
                  className="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                />
                <div>
                  <span className="font-medium text-gray-900">Stock Movements</span>
                  <span className="text-sm text-gray-500 ml-2">({exportedData?.counts.movements || 0} records)</span>
                </div>
              </label>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteArchiveModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteArchivedData}
                disabled={archiveLoading || (!deleteOptions.deleteTransactions && !deleteOptions.deleteLedgers && !deleteOptions.deleteMovements)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {archiveLoading ? 'Deleting...' : 'Delete Selected Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupPage;
