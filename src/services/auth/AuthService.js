import bcrypt from 'bcrypt';
import { DatabaseService } from '../database/DatabaseService';

/**
 * Authentication Service - Manages user login and session
 */
export class AuthService {
  dbService = null;
  currentUser = null;
  loginTime = null;
  SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

  constructor() {
    this.dbService = DatabaseService.getInstance();
    this.startSessionTimeout();
  }

  /**
   * User login - FR-1.1: Lock account after 5 failed attempts
   */
  async login(username, password) {
    try {
      // Query user from database with additional security fields
      const results = await this.dbService.query(
        `SELECT user_id, username, password_hash, full_name, role, is_active, 
                failed_login_attempts, locked_until 
         FROM Users WHERE username = ?`,
        [username]
      );

      if (results.length === 0) {
        console.error('User not found');
        return null;
      }

      const user = results[0];

      // Check if user is active
      if (!user.is_active) {
        console.error('User account is inactive');
        return null;
      }

      // Check if account is locked (SRS FR-1.1: Lock after 5 failed attempts)
      if (user.locked_until) {
        const lockExpiry = new Date(user.locked_until);
        const now = new Date();
        if (now < lockExpiry) {
          console.error('Account is locked. Try again later.');
          throw new Error(`Account locked until ${lockExpiry.toLocaleString()}`);
        } else {
          // Unlock account if lock period expired
          await this.dbService.execute(
            'UPDATE Users SET failed_login_attempts = 0, locked_until = NULL WHERE user_id = ?',
            [user.user_id]
          );
        }
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        // Increment failed login attempts
        const newFailedAttempts = user.failed_login_attempts + 1;
        
        // Lock account after 5 failed attempts (SRS FR-1.1)
        if (newFailedAttempts >= 5) {
          const lockUntil = new Date();
          lockUntil.setMinutes(lockUntil.getMinutes() + 30); // Lock for 30 minutes
          await this.dbService.execute(
            'UPDATE Users SET failed_login_attempts = ?, locked_until = ? WHERE user_id = ?',
            [newFailedAttempts, lockUntil.toISOString(), user.user_id]
          );
          console.error('Account locked due to 5 failed login attempts');
          throw new Error('Account locked due to multiple failed login attempts. Try again in 30 minutes.');
        } else {
          await this.dbService.execute(
            'UPDATE Users SET failed_login_attempts = ? WHERE user_id = ?',
            [newFailedAttempts, user.user_id]
          );
          console.error(`Invalid password. ${5 - newFailedAttempts} attempts remaining.`);
          throw new Error(`Invalid password. ${5 - newFailedAttempts} attempts remaining.`);
        }
      }

      // Reset failed login attempts on successful login
      await this.dbService.execute(
        'UPDATE Users SET last_login = CURRENT_TIMESTAMP, failed_login_attempts = 0, locked_until = NULL WHERE user_id = ?',
        [user.user_id]
      );

      // Set current user
      this.currentUser = {
        user_id: user.user_id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        is_active: user.is_active,
      };
      this.loginTime = new Date();

      console.log(`User ${username} logged in successfully`);
      return this.currentUser;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * User logout
   */
  async logout() {
    this.currentUser = null;
    this.loginTime = null;
    console.log('User logged out');
  }

  /**
   * Get current user
   */
  async getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Change password - FR-1.2: Strong password policy and password history
   */
  async changePassword(oldPassword, newPassword) {
    try {
      if (!this.currentUser) {
        console.error('No user logged in');
        throw new Error('No user logged in');
      }

      // Validate password strength (SRS FR-1.2: min 8 chars, uppercase, lowercase, number)
      if (!this.validatePasswordStrength(newPassword)) {
        throw new Error(
          'Password must be at least 8 characters long and contain uppercase, lowercase, and number'
        );
      }

      // Get user from database
      const results = await this.dbService.query(
        'SELECT password_hash FROM Users WHERE user_id = ?',
        [this.currentUser.user_id]
      );

      if (results.length === 0) {
        return false;
      }

      const user = results[0];

      // Verify old password
      const isPasswordValid = await bcrypt.compare(oldPassword, user.password_hash);
      if (!isPasswordValid) {
        console.error('Old password is incorrect');
        throw new Error('Old password is incorrect');
      }

      // Check password history (SRS FR-1.2: Last 3 passwords cannot be reused)
      const passwordHistory = await this.dbService.query(
        'SELECT password_hash FROM PasswordHistory WHERE user_id = ? ORDER BY created_at DESC LIMIT 3',
        [this.currentUser.user_id]
      );

      for (const historyEntry of passwordHistory) {
        const isReused = await bcrypt.compare(newPassword, historyEntry.password_hash);
        if (isReused) {
          throw new Error('Cannot reuse any of your last 3 passwords');
        }
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      // Start transaction
      this.dbService.beginTransaction();

      try {
        // Save current password to history before changing
        await this.dbService.execute(
          'INSERT INTO PasswordHistory (user_id, password_hash) VALUES (?, ?)',
          [this.currentUser.user_id, user.password_hash]
        );

        // Update password in database
        await this.dbService.execute(
          'UPDATE Users SET password_hash = ?, password_changed_at = CURRENT_TIMESTAMP WHERE user_id = ?',
          [newPasswordHash, this.currentUser.user_id]
        );

        // Commit transaction
        this.dbService.commit();

        console.log('Password changed successfully');
        return true;
      } catch (error) {
        // Rollback on error
        this.dbService.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  }

  /**
   * Validate password strength - FR-1.2: Strong password policy
   */
  validatePasswordStrength(password) {
    // Minimum 8 characters
    if (password.length < 8) {
      return false;
    }

    // Must contain uppercase
    if (!/[A-Z]/.test(password)) {
      return false;
    }

    // Must contain lowercase
    if (!/[a-z]/.test(password)) {
      return false;
    }

    // Must contain number
    if (!/[0-9]/.test(password)) {
      return false;
    }

    return true;
  }

  /**
   * Check if user is logged in
   */
  isLoggedIn() {
    return this.currentUser !== null;
  }

  /**
   * Check if this is a first-run scenario (no users exist yet)
   * SRS Sprint 2: "Local user credential setup screen (user sets own email + password on first run)"
   */
  async isFirstRun() {
    try {
      const results = await this.dbService.query('SELECT COUNT(*) as count FROM Users');
      return results[0].count === 0;
    } catch (error) {
      console.error('isFirstRun check error:', error);
      return true;
    }
  }

  /**
   * Create the first user account during first-run setup
   * SRS Sprint 2: User sets own email + password on first run
   * @param {string} fullName - User's full name
   * @param {string} username - Chosen username
   * @param {string} email - User's email address
   * @param {string} password - Chosen password (must pass policy)
   */
  async createFirstUser(fullName, username, email, password) {
    try {
      // Ensure this is actually a first run
      const firstRun = await this.isFirstRun();
      if (!firstRun) {
        throw new Error('Users already exist. First-run setup is not available.');
      }

      // Validate password strength (SRS FR-1.2)
      if (!this.validatePasswordStrength(password)) {
        throw new Error(
          'Password must be at least 8 characters long and contain uppercase, lowercase, and number'
        );
      }

      if (!fullName || fullName.trim().length < 2) {
        throw new Error('Full name is required (minimum 2 characters)');
      }

      if (!username || username.trim().length < 3) {
        throw new Error('Username is required (minimum 3 characters)');
      }

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('A valid email address is required');
      }

      const passwordHash = await bcrypt.hash(password, 10);

      await this.dbService.execute(
        `INSERT INTO Users (username, password_hash, full_name, email, role, is_active, password_changed_at)
         VALUES (?, ?, ?, ?, 'OWNER', 1, CURRENT_TIMESTAMP)`,
        [username.trim(), passwordHash, fullName.trim(), email.trim()]
      );

      console.log(`First user created: ${username} (${email})`);
      return { success: true, username: username.trim() };
    } catch (error) {
      console.error('createFirstUser error:', error);
      throw error;
    }
  }

  /**
   * Initialize default admin user if no users exist
   * Default credentials: admin / Admin@123
   */
  async initializeDefaultAdmin() {
    try {
      const results = await this.dbService.query('SELECT COUNT(*) as count FROM Users');
      const count = results[0].count;

      if (count === 0) {
        // Use strong password that meets SRS FR-1.2 requirements
        const defaultPassword = await bcrypt.hash('Admin@123', 10);
        await this.dbService.execute(
          `INSERT INTO Users (username, password_hash, full_name, role, is_active, password_changed_at)
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          ['admin', defaultPassword, 'Administrator', 'admin', 1]
        );
        console.log('Default admin user created (username: admin, password: Admin@123)');
        console.log('IMPORTANT: Change this password immediately after first login');
      }
    } catch (error) {
      console.error('Initialize default admin error:', error);
    }
  }

  // ========================================================================
  // User Management — Sprint 6 RBAC (FR-11.4)
  // ========================================================================

  /**
   * Create a new user — only OWNER / admin can create users
   */
  async createUser({ username, fullName, email, password, role }, createdByUserId) {
    try {
      if (!username || username.trim().length < 3) throw new Error('Username required (min 3 chars)');
      if (!fullName || fullName.trim().length < 2) throw new Error('Full name required (min 2 chars)');
      if (!password) throw new Error('Password is required');
      if (!this.validatePasswordStrength(password)) {
        throw new Error('Password must be ≥8 chars with uppercase, lowercase, and number');
      }

      // Duplicate check
      const existing = await this.dbService.query(
        'SELECT user_id FROM Users WHERE username = ?',
        [username.trim()]
      );
      if (existing.length > 0) throw new Error('Username already exists');

      if (email) {
        const emailDup = await this.dbService.query(
          'SELECT user_id FROM Users WHERE email = ?',
          [email.trim()]
        );
        if (emailDup.length > 0) throw new Error('Email already in use');
      }

      const validRoles = ['OWNER', 'ADMIN', 'USER', 'VIEWER'];
      const assignedRole = validRoles.includes(role) ? role : 'USER';

      const passwordHash = await bcrypt.hash(password, 10);

      await this.dbService.execute(
        `INSERT INTO Users (username, password_hash, full_name, email, role, is_active, created_by, password_changed_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)`,
        [username.trim(), passwordHash, fullName.trim(), email?.trim() || null, assignedRole, createdByUserId || null]
      );

      const newUser = await this.dbService.query(
        'SELECT user_id, username, full_name, email, role, is_active, created_at FROM Users WHERE username = ?',
        [username.trim()]
      );

      console.log(`User created: ${username} with role ${assignedRole}`);
      return newUser[0];
    } catch (error) {
      console.error('createUser error:', error);
      throw error;
    }
  }

  /**
   * Update an existing user (role, name, email, active status)
   */
  async updateUser(userId, updates, updatedByUserId) {
    try {
      const existing = await this.dbService.query(
        'SELECT user_id, username, role FROM Users WHERE user_id = ?',
        [userId]
      );
      if (existing.length === 0) throw new Error('User not found');

      const sets = [];
      const params = [];

      if (updates.fullName !== undefined) {
        sets.push('full_name = ?');
        params.push(updates.fullName.trim());
      }
      if (updates.email !== undefined) {
        if (updates.email) {
          const emailDup = await this.dbService.query(
            'SELECT user_id FROM Users WHERE email = ? AND user_id != ?',
            [updates.email.trim(), userId]
          );
          if (emailDup.length > 0) throw new Error('Email already in use');
        }
        sets.push('email = ?');
        params.push(updates.email?.trim() || null);
      }
      if (updates.role !== undefined) {
        const validRoles = ['OWNER', 'ADMIN', 'USER', 'VIEWER'];
        if (!validRoles.includes(updates.role)) throw new Error('Invalid role');
        sets.push('role = ?');
        params.push(updates.role);
      }
      if (updates.isActive !== undefined) {
        sets.push('is_active = ?');
        params.push(updates.isActive ? 1 : 0);
      }

      if (sets.length === 0) throw new Error('No updates provided');

      params.push(userId);
      await this.dbService.execute(
        `UPDATE Users SET ${sets.join(', ')} WHERE user_id = ?`,
        params
      );

      const updated = await this.dbService.query(
        'SELECT user_id, username, full_name, email, role, is_active, last_login, created_at FROM Users WHERE user_id = ?',
        [userId]
      );

      console.log(`User ${userId} updated by ${updatedByUserId}`);
      return updated[0];
    } catch (error) {
      console.error('updateUser error:', error);
      throw error;
    }
  }

  /**
   * Deactivate a user (soft-delete)
   */
  async deactivateUser(userId, deactivatedByUserId) {
    try {
      const existing = await this.dbService.query(
        'SELECT user_id, username FROM Users WHERE user_id = ?',
        [userId]
      );
      if (existing.length === 0) throw new Error('User not found');
      if (userId === deactivatedByUserId) throw new Error('Cannot deactivate your own account');

      await this.dbService.execute(
        'UPDATE Users SET is_active = 0 WHERE user_id = ?',
        [userId]
      );

      console.log(`User ${existing[0].username} deactivated by user ${deactivatedByUserId}`);
      return { success: true, userId };
    } catch (error) {
      console.error('deactivateUser error:', error);
      throw error;
    }
  }

  /**
   * Reactivate a previously deactivated user
   */
  async reactivateUser(userId) {
    try {
      await this.dbService.execute(
        'UPDATE Users SET is_active = 1, failed_login_attempts = 0, locked_until = NULL WHERE user_id = ?',
        [userId]
      );
      return { success: true, userId };
    } catch (error) {
      console.error('reactivateUser error:', error);
      throw error;
    }
  }

  /**
   * List all users (for User Management page)
   */
  async listUsers() {
    try {
      const users = await this.dbService.query(
        `SELECT user_id, username, full_name, email, role, is_active,
                last_login, created_at, failed_login_attempts, locked_until
         FROM Users ORDER BY created_at ASC`
      );
      return users;
    } catch (error) {
      console.error('listUsers error:', error);
      throw error;
    }
  }

  /**
   * Reset a user's password (admin action)
   */
  async resetUserPassword(userId, newPassword, resetByUserId) {
    try {
      if (!this.validatePasswordStrength(newPassword)) {
        throw new Error('Password must be ≥8 chars with uppercase, lowercase, and number');
      }

      const existing = await this.dbService.query(
        'SELECT user_id, password_hash FROM Users WHERE user_id = ?',
        [userId]
      );
      if (existing.length === 0) throw new Error('User not found');

      // Save old hash to history
      await this.dbService.execute(
        'INSERT INTO PasswordHistory (user_id, password_hash) VALUES (?, ?)',
        [userId, existing[0].password_hash]
      );

      const newHash = await bcrypt.hash(newPassword, 10);
      await this.dbService.execute(
        'UPDATE Users SET password_hash = ?, password_changed_at = CURRENT_TIMESTAMP, failed_login_attempts = 0, locked_until = NULL WHERE user_id = ?',
        [newHash, userId]
      );

      console.log(`Password reset for user ${userId} by ${resetByUserId}`);
      return { success: true };
    } catch (error) {
      console.error('resetUserPassword error:', error);
      throw error;
    }
  }

  /**
   * Unlock a locked user account (admin action)
   */
  async unlockUser(userId) {
    try {
      await this.dbService.execute(
        'UPDATE Users SET failed_login_attempts = 0, locked_until = NULL WHERE user_id = ?',
        [userId]
      );
      return { success: true };
    } catch (error) {
      console.error('unlockUser error:', error);
      throw error;
    }
  }

  /**
   * Start session timeout checker
   */
  startSessionTimeout() {
    setInterval(() => {
      if (this.isLoggedIn() && this.loginTime) {
        const now = new Date();
        const elapsed = now.getTime() - this.loginTime.getTime();

        if (elapsed > this.SESSION_TIMEOUT) {
          console.log('Session timeout - logging out user');
          this.logout();
        }
      }
    }, 60000); // Check every minute
  }
}
