/**
 * PropertyService - Sprint 4 (FR-4.7)
 * Manages property listings for the Real Estate industry.
 * CRUD operations, search/filter, status management, statistics.
 */

import { DatabaseService } from '../database/DatabaseService.js';

class PropertyService {
  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * Generate next property code (PR001, PR002, etc.)
   */
  async generatePropertyCode() {
    try {
      const result = this.db.db.prepare(`
        SELECT property_code FROM PropertyListings
        ORDER BY property_id DESC LIMIT 1
      `).get();

      if (!result) return 'PR001';

      const match = result.property_code.match(/(\d+)$/);
      const nextNumber = (match ? parseInt(match[1]) : 0) + 1;
      return `PR${nextNumber.toString().padStart(3, '0')}`;
    } catch (error) {
      console.error('Error generating property code:', error);
      throw error;
    }
  }

  /**
   * Create a new property listing
   */
  async create(propertyData, userId) {
    try {
      const propertyCode = await this.generatePropertyCode();

      const stmt = this.db.db.prepare(`
        INSERT INTO PropertyListings (
          property_code, title, property_type, listing_type, status,
          address, city, area, land_area, built_area, area_unit,
          bedrooms, bathrooms, floors, parking_spaces,
          price, price_per_unit, description, features, image_paths,
          owner_id, agent_id, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        propertyCode,
        propertyData.title,
        propertyData.property_type,
        propertyData.listing_type || 'Sale',
        propertyData.status || 'Available',
        propertyData.address || null,
        propertyData.city || null,
        propertyData.area || null,
        propertyData.land_area || null,
        propertyData.built_area || null,
        propertyData.area_unit || 'sq_ft',
        propertyData.bedrooms || 0,
        propertyData.bathrooms || 0,
        propertyData.floors || 1,
        propertyData.parking_spaces || 0,
        propertyData.price || 0,
        propertyData.price_per_unit || 0,
        propertyData.description || null,
        propertyData.features ? JSON.stringify(propertyData.features) : null,
        propertyData.image_paths ? JSON.stringify(propertyData.image_paths) : null,
        propertyData.owner_id || null,
        propertyData.agent_id || null,
        userId
      );

      const property = await this.getById(result.lastInsertRowid);
      await this.db.createHistoryEntry('PropertyListings', result.lastInsertRowid, 'CREATE', null, property, userId);

      return {
        success: true,
        property_id: result.lastInsertRowid,
        property_code: propertyCode,
        message: 'Property listing created successfully'
      };
    } catch (error) {
      console.error('Error creating property:', error);
      throw error;
    }
  }

  /**
   * Get property by ID
   */
  async getById(propertyId) {
    try {
      const property = this.db.db.prepare(`
        SELECT pl.*,
               c.company_name as owner_name,
               d.name as agent_name,
               u.username as created_by_username
        FROM PropertyListings pl
        LEFT JOIN Companies c ON pl.owner_id = c.company_id
        LEFT JOIN Dealers d ON pl.agent_id = d.dealer_id
        LEFT JOIN Users u ON pl.created_by = u.user_id
        WHERE pl.property_id = ?
      `).get(propertyId);

      if (property) {
        // Parse JSON fields
        property.features = property.features ? JSON.parse(property.features) : [];
        property.image_paths = property.image_paths ? JSON.parse(property.image_paths) : [];
      }

      return property || null;
    } catch (error) {
      console.error('Error fetching property:', error);
      throw error;
    }
  }

  /**
   * Get property by code
   */
  async getByCode(propertyCode) {
    try {
      const property = this.db.db.prepare(`
        SELECT pl.*,
               c.company_name as owner_name,
               d.name as agent_name
        FROM PropertyListings pl
        LEFT JOIN Companies c ON pl.owner_id = c.company_id
        LEFT JOIN Dealers d ON pl.agent_id = d.dealer_id
        WHERE pl.property_code = ?
      `).get(propertyCode);

      if (property) {
        property.features = property.features ? JSON.parse(property.features) : [];
        property.image_paths = property.image_paths ? JSON.parse(property.image_paths) : [];
      }

      return property || null;
    } catch (error) {
      console.error('Error fetching property by code:', error);
      throw error;
    }
  }

  /**
   * Get all properties with optional filters
   */
  async getAll(filters = {}) {
    try {
      let query = `
        SELECT pl.*,
               c.company_name as owner_name,
               d.name as agent_name,
               u.username as created_by_username
        FROM PropertyListings pl
        LEFT JOIN Companies c ON pl.owner_id = c.company_id
        LEFT JOIN Dealers d ON pl.agent_id = d.dealer_id
        LEFT JOIN Users u ON pl.created_by = u.user_id
      `;

      const conditions = [];
      const params = [];

      if (filters.is_active !== undefined) {
        conditions.push('pl.is_active = ?');
        params.push(filters.is_active ? 1 : 0);
      }

      if (filters.property_type) {
        conditions.push('pl.property_type = ?');
        params.push(filters.property_type);
      }

      if (filters.listing_type) {
        conditions.push('pl.listing_type = ?');
        params.push(filters.listing_type);
      }

      if (filters.status) {
        conditions.push('pl.status = ?');
        params.push(filters.status);
      }

      if (filters.city) {
        conditions.push('pl.city LIKE ?');
        params.push(`%${filters.city}%`);
      }

      if (filters.min_price) {
        conditions.push('pl.price >= ?');
        params.push(filters.min_price);
      }

      if (filters.max_price) {
        conditions.push('pl.price <= ?');
        params.push(filters.max_price);
      }

      if (filters.min_area) {
        conditions.push('pl.land_area >= ?');
        params.push(filters.min_area);
      }

      if (filters.max_area) {
        conditions.push('pl.land_area <= ?');
        params.push(filters.max_area);
      }

      if (filters.bedrooms_min) {
        conditions.push('pl.bedrooms >= ?');
        params.push(filters.bedrooms_min);
      }

      if (filters.agent_id) {
        conditions.push('pl.agent_id = ?');
        params.push(filters.agent_id);
      }

      if (filters.owner_id) {
        conditions.push('pl.owner_id = ?');
        params.push(filters.owner_id);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY pl.created_at DESC';

      const properties = this.db.db.prepare(query).all(...params);

      // Parse JSON fields
      return properties.map(p => ({
        ...p,
        features: p.features ? JSON.parse(p.features) : [],
        image_paths: p.image_paths ? JSON.parse(p.image_paths) : []
      }));
    } catch (error) {
      console.error('Error fetching properties:', error);
      throw error;
    }
  }

  /**
   * Update a property listing
   */
  async update(propertyId, updateData, userId) {
    try {
      const oldProperty = await this.getById(propertyId);
      if (!oldProperty) throw new Error('Property not found');

      const stmt = this.db.db.prepare(`
        UPDATE PropertyListings
        SET title = ?,
            property_type = ?,
            listing_type = ?,
            status = ?,
            address = ?,
            city = ?,
            area = ?,
            land_area = ?,
            built_area = ?,
            area_unit = ?,
            bedrooms = ?,
            bathrooms = ?,
            floors = ?,
            parking_spaces = ?,
            price = ?,
            price_per_unit = ?,
            description = ?,
            features = ?,
            image_paths = ?,
            owner_id = ?,
            agent_id = ?,
            is_active = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE property_id = ?
      `);

      stmt.run(
        updateData.title,
        updateData.property_type,
        updateData.listing_type || 'Sale',
        updateData.status || oldProperty.status,
        updateData.address || null,
        updateData.city || null,
        updateData.area || null,
        updateData.land_area || null,
        updateData.built_area || null,
        updateData.area_unit || 'sq_ft',
        updateData.bedrooms || 0,
        updateData.bathrooms || 0,
        updateData.floors || 1,
        updateData.parking_spaces || 0,
        updateData.price || 0,
        updateData.price_per_unit || 0,
        updateData.description || null,
        updateData.features ? JSON.stringify(updateData.features) : null,
        updateData.image_paths ? JSON.stringify(updateData.image_paths) : null,
        updateData.owner_id || null,
        updateData.agent_id || null,
        updateData.is_active !== undefined ? (updateData.is_active ? 1 : 0) : 1,
        propertyId
      );

      const newProperty = await this.getById(propertyId);
      await this.db.createHistoryEntry('PropertyListings', propertyId, 'UPDATE', oldProperty, newProperty, userId);

      return { success: true, message: 'Property updated successfully' };
    } catch (error) {
      console.error('Error updating property:', error);
      throw error;
    }
  }

  /**
   * Update property status (quick action)
   */
  async updateStatus(propertyId, newStatus, userId) {
    try {
      const property = await this.getById(propertyId);
      if (!property) throw new Error('Property not found');

      this.db.db.prepare(`
        UPDATE PropertyListings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE property_id = ?
      `).run(newStatus, propertyId);

      const updatedProperty = await this.getById(propertyId);
      await this.db.createHistoryEntry('PropertyListings', propertyId, 'STATUS_CHANGE', property, updatedProperty, userId);

      return { success: true, message: `Property status changed to ${newStatus}` };
    } catch (error) {
      console.error('Error updating property status:', error);
      throw error;
    }
  }

  /**
   * Delete property (soft delete)
   */
  async delete(propertyId, userId) {
    try {
      const property = await this.getById(propertyId);
      if (!property) throw new Error('Property not found');

      this.db.db.prepare('UPDATE PropertyListings SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE property_id = ?').run(propertyId);
      await this.db.createHistoryEntry('PropertyListings', propertyId, 'DELETE', property, null, userId);

      return { success: true, message: 'Property listing removed' };
    } catch (error) {
      console.error('Error deleting property:', error);
      throw error;
    }
  }

  /**
   * Search properties
   */
  async search(searchTerm) {
    try {
      const pattern = `%${searchTerm}%`;
      const properties = this.db.db.prepare(`
        SELECT pl.*,
               c.company_name as owner_name,
               d.name as agent_name
        FROM PropertyListings pl
        LEFT JOIN Companies c ON pl.owner_id = c.company_id
        LEFT JOIN Dealers d ON pl.agent_id = d.dealer_id
        WHERE pl.title LIKE ?
           OR pl.property_code LIKE ?
           OR pl.city LIKE ?
           OR pl.area LIKE ?
           OR pl.address LIKE ?
        ORDER BY pl.created_at DESC
      `).all(pattern, pattern, pattern, pattern, pattern);

      return properties.map(p => ({
        ...p,
        features: p.features ? JSON.parse(p.features) : [],
        image_paths: p.image_paths ? JSON.parse(p.image_paths) : []
      }));
    } catch (error) {
      console.error('Error searching properties:', error);
      throw error;
    }
  }

  /**
   * Get property statistics for dashboard
   */
  async getStatistics() {
    try {
      return this.db.db.prepare(`
        SELECT
          COUNT(*) as total_properties,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_listings,
          SUM(CASE WHEN status = 'Available' AND is_active = 1 THEN 1 ELSE 0 END) as available,
          SUM(CASE WHEN status = 'Sold' AND is_active = 1 THEN 1 ELSE 0 END) as sold,
          SUM(CASE WHEN status = 'Rented' AND is_active = 1 THEN 1 ELSE 0 END) as rented,
          SUM(CASE WHEN status = 'Under Negotiation' AND is_active = 1 THEN 1 ELSE 0 END) as under_negotiation,
          SUM(CASE WHEN status = 'Reserved' AND is_active = 1 THEN 1 ELSE 0 END) as reserved,
          COALESCE(SUM(CASE WHEN status = 'Available' AND is_active = 1 THEN price ELSE 0 END), 0) as total_available_value,
          COALESCE(SUM(CASE WHEN status = 'Sold' AND is_active = 1 THEN price ELSE 0 END), 0) as total_sold_value
        FROM PropertyListings
      `).get();
    } catch (error) {
      console.error('Error fetching property statistics:', error);
      throw error;
    }
  }
}

export default PropertyService;
