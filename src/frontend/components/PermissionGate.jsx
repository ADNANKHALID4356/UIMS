/**
 * PermissionGate — Sprint 6 RBAC UI Guard
 * Conditionally renders children based on user permissions.
 *
 * Usage:
 *   <PermissionGate permission="can_delete_entities">
 *     <DeleteButton />
 *   </PermissionGate>
 *
 *   <PermissionGate permission="can_manage_users" fallback={<p>Access denied</p>}>
 *     <UserManagementPage />
 *   </PermissionGate>
 */

import React from 'react';
import { useSelector } from 'react-redux';
import { hasPermission, getPermissionsForRole } from '../../services/auth/PermissionsService';

const PermissionGate = ({ permission, permissions, children, fallback = null }) => {
  const { user } = useSelector((state) => state.auth);

  if (!user) return fallback;

  // Single permission check
  if (permission) {
    if (!hasPermission(user, permission)) return fallback;
  }

  // Multiple permissions (all required)
  if (permissions && Array.isArray(permissions)) {
    const allGranted = permissions.every((p) => hasPermission(user, p));
    if (!allGranted) return fallback;
  }

  return <>{children}</>;
};

/**
 * Hook for checking permissions in code (non-render scenarios)
 */
export const usePermission = (permission) => {
  const { user } = useSelector((state) => state.auth);
  if (!user) return false;
  return hasPermission(user, permission);
};

/**
 * Hook returning all permission flags for the current user
 */
export const usePermissions = () => {
  const { user } = useSelector((state) => state.auth);
  if (!user) return {};
  return getPermissionsForRole(user.role);
};

export default PermissionGate;
