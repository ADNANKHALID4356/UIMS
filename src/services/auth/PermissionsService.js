/**
 * PermissionsService — Role-Based Access Control (RBAC)
 * SRS v2.0 Sprint 6 — FR-11.4.1
 * 
 * Roles: OWNER > ADMIN > USER > VIEWER
 * 10 permission flags per SRS Section 16.5
 */

const ROLE_PERMISSIONS = {
  OWNER: {
    can_manage_users: true,
    can_manage_subscription: true,
    can_view_billing: true,
    can_cloud_sync: true,
    can_create_entities: true,
    can_edit_entities: true,
    can_delete_entities: true,
    can_create_transactions: true,
    can_view_reports: true,
    can_export_data: true,
  },
  ADMIN: {
    can_manage_users: false,
    can_manage_subscription: false,
    can_view_billing: false,
    can_cloud_sync: true,
    can_create_entities: true,
    can_edit_entities: true,
    can_delete_entities: true,
    can_create_transactions: true,
    can_view_reports: true,
    can_export_data: true,
  },
  // 'admin' maps to ADMIN (backward compatibility with existing "admin" role)
  admin: {
    can_manage_users: true,
    can_manage_subscription: true,
    can_view_billing: true,
    can_cloud_sync: true,
    can_create_entities: true,
    can_edit_entities: true,
    can_delete_entities: true,
    can_create_transactions: true,
    can_view_reports: true,
    can_export_data: true,
  },
  USER: {
    can_manage_users: false,
    can_manage_subscription: false,
    can_view_billing: false,
    can_cloud_sync: false,
    can_create_entities: true,
    can_edit_entities: true,
    can_delete_entities: false,
    can_create_transactions: true,
    can_view_reports: true,
    can_export_data: false,
  },
  VIEWER: {
    can_manage_users: false,
    can_manage_subscription: false,
    can_view_billing: false,
    can_cloud_sync: false,
    can_create_entities: false,
    can_edit_entities: false,
    can_delete_entities: false,
    can_create_transactions: false,
    can_view_reports: true,
    can_export_data: false,
  },
};

const ROLE_HIERARCHY = ['OWNER', 'ADMIN', 'admin', 'USER', 'VIEWER'];

/**
 * Check if a user has a specific permission
 * @param {object} user - User object with role property
 * @param {string} permission - Permission key (e.g., 'can_delete_entities')
 * @returns {boolean}
 */
export function hasPermission(user, permission) {
  if (!user || !user.role) return false;
  const rolePerms = ROLE_PERMISSIONS[user.role];
  if (!rolePerms) return false;
  return rolePerms[permission] === true;
}

/**
 * Get all permissions for a role
 * @param {string} role - Role name
 * @returns {object} Permission flags
 */
export function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.VIEWER;
}

/**
 * Check if role A outranks role B
 */
export function isHigherRole(roleA, roleB) {
  const indexA = ROLE_HIERARCHY.indexOf(roleA);
  const indexB = ROLE_HIERARCHY.indexOf(roleB);
  if (indexA === -1 || indexB === -1) return false;
  return indexA < indexB;
}

/**
 * Get available roles (for user management dropdown)
 */
export function getAvailableRoles() {
  return [
    { value: 'OWNER', label: 'Owner', description: 'Full access. Can manage users and billing.' },
    { value: 'ADMIN', label: 'Admin', description: 'Full operational access. Cannot manage users.' },
    { value: 'USER', label: 'User', description: 'Can create/edit entities and transactions.' },
    { value: 'VIEWER', label: 'Viewer', description: 'Read-only access to reports.' },
  ];
}

export { ROLE_PERMISSIONS, ROLE_HIERARCHY };
export default { hasPermission, getPermissionsForRole, isHigherRole, getAvailableRoles, ROLE_PERMISSIONS };
