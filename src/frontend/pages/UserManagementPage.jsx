/**
 * UserManagementPage — Sprint 6 RBAC
 * Full user CRUD: create, edit role, reset password, deactivate/reactivate, unlock
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { getAvailableRoles } from '../../services/auth/PermissionsService';
import PermissionGate from '../components/PermissionGate';

const ROLES = getAvailableRoles();

/**
 * Role hierarchy for authorization checks.
 * Higher rank = more privileged. Users can only manage users with a LOWER rank.
 */
const ROLE_RANK = { OWNER: 4, ADMIN: 3, USER: 2, VIEWER: 1 };

const UserManagementPage = () => {
  const { user: currentUser } = useSelector((state) => state.auth);

  /** Check if the current user can manage (edit / reset password) the target user */
  const canManageUser = (targetUser) => {
    if (!currentUser || !targetUser) return false;
    const myRank = ROLE_RANK[currentUser.role?.toUpperCase()] || 0;
    const theirRank = ROLE_RANK[targetUser.role?.toUpperCase()] || 0;
    // Must be OWNER or ADMIN to manage anyone, and target must be strictly lower rank
    if (myRank < ROLE_RANK.ADMIN) return false;
    return myRank > theirRank;
  };

  /** Get the list of roles the current user is allowed to assign */
  const getAssignableRoles = () => {
    const myRank = ROLE_RANK[currentUser?.role?.toUpperCase()] || 0;
    return ROLES.filter(r => (ROLE_RANK[r.value?.toUpperCase()] || 0) < myRank);
  };

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPwModal, setShowResetPwModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Create form
  const [createForm, setCreateForm] = useState({
    username: '', fullName: '', email: '', password: '', confirmPassword: '', role: 'USER',
  });

  // Edit form
  const [editForm, setEditForm] = useState({
    fullName: '', email: '', role: '', isActive: true,
  });

  // Reset password form
  const [resetPwForm, setResetPwForm] = useState({ newPassword: '', confirmPassword: '' });

  // Search / filter
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const result = await window.electronAPI.userManagement.list();
      if (Array.isArray(result)) {
        setUsers(result);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Auto-dismiss messages
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(null), 4000); return () => clearTimeout(t); }
  }, [success]);
  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(null), 6000); return () => clearTimeout(t); }
  }, [error]);

  // Filtered users
  const filteredUsers = users.filter((u) => {
    if (filterRole !== 'ALL' && u.role !== filterRole) return false;
    if (filterStatus === 'ACTIVE' && !u.is_active) return false;
    if (filterStatus === 'INACTIVE' && u.is_active) return false;
    if (filterStatus === 'LOCKED' && !u.locked_until) return false;
    if (search) {
      const q = search.toLowerCase();
      return (u.username?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
    }
    return true;
  });

  // ---- Create User ----
  const handleCreate = async () => {
    try {
      if (!createForm.username || !createForm.fullName || !createForm.password) {
        setError('Username, full name, and password are required'); return;
      }
      if (createForm.password !== createForm.confirmPassword) {
        setError('Passwords do not match'); return;
      }
      setProcessing(true);
      const result = await window.electronAPI.userManagement.create(
        { username: createForm.username, fullName: createForm.fullName, email: createForm.email, password: createForm.password, role: createForm.role },
        currentUser?.user_id
      );
      if (result?.success === false) { setError(result.message); return; }
      setSuccess(`User "${createForm.username}" created successfully`);
      setShowCreateModal(false);
      setCreateForm({ username: '', fullName: '', email: '', password: '', confirmPassword: '', role: 'USER' });
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  // ---- Edit User ----
  const openEditModal = (u) => {
    setSelectedUser(u);
    setEditForm({ fullName: u.full_name || '', email: u.email || '', role: u.role, isActive: !!u.is_active });
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    try {
      setProcessing(true);
      const result = await window.electronAPI.userManagement.update(
        selectedUser.user_id,
        { fullName: editForm.fullName, email: editForm.email, role: editForm.role, isActive: editForm.isActive },
        currentUser?.user_id
      );
      if (result?.success === false) { setError(result.message); return; }
      setSuccess(`User "${selectedUser.username}" updated`);
      setShowEditModal(false);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  // ---- Reset Password ----
  const openResetPw = (u) => {
    setSelectedUser(u);
    setResetPwForm({ newPassword: '', confirmPassword: '' });
    setShowResetPwModal(true);
  };

  const handleResetPassword = async () => {
    try {
      if (resetPwForm.newPassword !== resetPwForm.confirmPassword) {
        setError('Passwords do not match'); return;
      }
      setProcessing(true);
      const result = await window.electronAPI.userManagement.resetPassword(
        selectedUser.user_id, resetPwForm.newPassword, currentUser?.user_id
      );
      if (result?.success === false) { setError(result.message); return; }
      setSuccess(`Password reset for "${selectedUser.username}"`);
      setShowResetPwModal(false);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  // ---- Deactivate / Reactivate ----
  const handleToggleActive = async (u) => {
    try {
      setProcessing(true);
      if (u.is_active) {
        const result = await window.electronAPI.userManagement.deactivate(u.user_id, currentUser?.user_id);
        if (result?.success === false) { setError(result.message); return; }
        setSuccess(`User "${u.username}" deactivated`);
      } else {
        const result = await window.electronAPI.userManagement.reactivate(u.user_id);
        if (result?.success === false) { setError(result.message); return; }
        setSuccess(`User "${u.username}" reactivated`);
      }
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  // ---- Unlock ----
  const handleUnlock = async (u) => {
    try {
      setProcessing(true);
      await window.electronAPI.userManagement.unlock(u.user_id);
      setSuccess(`User "${u.username}" unlocked`);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  // ---- Role badge colors ----
  const roleBadge = (role) => {
    const colors = {
      OWNER: 'bg-purple-100 text-purple-800',
      admin: 'bg-blue-100 text-blue-800',
      ADMIN: 'bg-blue-100 text-blue-800',
      USER: 'bg-green-100 text-green-800',
      VIEWER: 'bg-gray-100 text-gray-800',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const isLocked = (u) => {
    if (!u.locked_until) return false;
    return new Date(u.locked_until) > new Date();
  };

  // ================================================================
  // RENDER
  // ================================================================
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage users, roles, and permissions</p>
        </div>
        <PermissionGate permission="can_manage_users">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add User
          </button>
        </PermissionGate>
      </div>

      {/* Alerts */}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm">
          <option value="ALL">All Roles</option>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm">
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="LOCKED">Locked</option>
        </select>
        <div className="ml-auto text-sm text-gray-500 self-center">
          {filteredUsers.length} of {users.length} users
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading users...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map((u) => (
                <tr key={u.user_id} className={`hover:bg-gray-50 ${!u.is_active ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
                        {(u.full_name || u.username || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{u.full_name || u.username}</div>
                        <div className="text-xs text-gray-500">@{u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{u.email || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge(u.role)}`}>
                      {u.role?.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {isLocked(u) ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Locked</span>
                    ) : u.is_active ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEditModal(u)} title="Edit"
                        className={`p-1.5 rounded ${canManageUser(u) ? 'text-gray-500 hover:text-blue-600 hover:bg-blue-50' : 'text-gray-300 cursor-not-allowed'}`}
                        disabled={!canManageUser(u)}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => openResetPw(u)} title="Reset Password"
                        className={`p-1.5 rounded ${canManageUser(u) ? 'text-gray-500 hover:text-orange-600 hover:bg-orange-50' : 'text-gray-300 cursor-not-allowed'}`}
                        disabled={!canManageUser(u)}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                      </button>
                      {isLocked(u) && (
                        <button onClick={() => handleUnlock(u)} title="Unlock Account"
                          className="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                          </svg>
                        </button>
                      )}
                      {u.user_id !== currentUser?.user_id && (
                        <button onClick={() => handleToggleActive(u)} title={u.is_active ? 'Deactivate' : 'Reactivate'}
                          className={`p-1.5 rounded ${u.is_active ? 'text-gray-500 hover:text-red-600 hover:bg-red-50' : 'text-gray-500 hover:text-green-600 hover:bg-green-50'}`}>
                          {u.is_active ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    {search || filterRole !== 'ALL' || filterStatus !== 'ALL' ? 'No users match your filters' : 'No users found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ====================== CREATE MODAL ====================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Create New User</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                <input type="text" value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="e.g., john.doe" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input type="text" value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="John Doe" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="john@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                  {getAssignableRoles().map((r) => (
                    <option key={r.value} value={r.value}>{r.label} — {r.description}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input type="password" value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="Min 8 chars, upper + lower + number" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
                <input type="password" value={createForm.confirmPassword}
                  onChange={(e) => setCreateForm({ ...createForm, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={handleCreate} disabled={processing}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {processing ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================== EDIT MODAL ====================== */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Edit User — @{selectedUser.username}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input type="text" value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                  {getAssignableRoles().map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isActive" checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="rounded border-gray-300" />
                <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={handleEdit} disabled={processing}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {processing ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================== RESET PASSWORD MODAL ====================== */}
      {showResetPwModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Reset Password — @{selectedUser.username}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input type="password" value={resetPwForm.newPassword}
                  onChange={(e) => setResetPwForm({ ...resetPwForm, newPassword: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Min 8 chars, upper + lower + number" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input type="password" value={resetPwForm.confirmPassword}
                  onChange={(e) => setResetPwForm({ ...resetPwForm, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowResetPwModal(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={handleResetPassword} disabled={processing}
                className="px-4 py-2 text-sm text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50">
                {processing ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPage;
