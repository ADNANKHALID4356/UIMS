"""
Database Migration Script: Fix Irregular Entity Tables
======================================================

PROBLEM:
Old transactions might have entity_table = 'Irregular' for walk-in customers.
This is incorrect because walk-in is a STATUS (entity_type), not a CATEGORY (entity_table).

SOLUTION:
This script updates old transactions where entity_table='Irregular' to have a proper 
category (Farmer/Company/Dealer). Since we can't determine the actual category from 
old data, we'll need manual review or default to 'Farmer' for agricultural contexts.

CORRECT SYSTEM:
- entity_table: ONLY 'Farmer', 'Company', or 'Dealer' (3 categories)
- entity_type: ONLY 'regular' or 'irregular' (2 statuses)
"""

import sqlite3
import os
from datetime import datetime

def get_database_path():
    """Get the database path"""
    db_path = os.path.join(
        os.path.dirname(__file__),
        'inventory.db'
    )
    return db_path

def analyze_irregular_entity_tables(cursor):
    """Analyze transactions with entity_table = 'Irregular'"""
    print("\n" + "="*70)
    print("ANALYZING TRANSACTIONS WITH entity_table = 'Irregular'")
    print("="*70)
    
    query = """
    SELECT 
        transaction_id,
        transaction_number,
        transaction_date,
        entity_type,
        entity_table,
        entity_name,
        transaction_type,
        item_type
    FROM Transactions
    WHERE entity_table = 'Irregular'
    ORDER BY transaction_date DESC
    """
    
    cursor.execute(query)
    rows = cursor.fetchall()
    
    if not rows:
        print("✅ No transactions found with entity_table = 'Irregular'")
        print("   Database is already using correct categorization!")
        return []
    
    print(f"\n⚠️  Found {len(rows)} transaction(s) with incorrect entity_table\n")
    
    for row in rows:
        print(f"Transaction #{row[1]} (ID: {row[0]})")
        print(f"  Date: {row[2]}")
        print(f"  Entity Type: {row[3]}")
        print(f"  Entity Table: {row[4]} ← INCORRECT")
        print(f"  Entity Name: {row[5]}")
        print(f"  Transaction Type: {row[6]}")
        print(f"  Item Type: {row[7]}")
        print()
    
    return rows

def fix_irregular_entity_tables(cursor, conn, default_category='Farmer'):
    """
    Fix transactions with entity_table = 'Irregular'
    
    Args:
        cursor: Database cursor
        conn: Database connection
        default_category: Default category to use ('Farmer', 'Company', or 'Dealer')
    """
    print("\n" + "="*70)
    print("FIXING IRREGULAR ENTITY TABLES")
    print("="*70)
    
    # Get all transactions with incorrect entity_table
    cursor.execute("""
        SELECT transaction_id, entity_name, transaction_type, item_type
        FROM Transactions
        WHERE entity_table = 'Irregular'
    """)
    
    rows = cursor.fetchall()
    
    if not rows:
        print("\n✅ No transactions need fixing!")
        return
    
    print(f"\n📝 Will update {len(rows)} transaction(s)")
    print(f"   Default category: {default_category}")
    print(f"\n   Strategy:")
    print(f"   - If item_type is 'grain': likely Farmer")
    print(f"   - If item_type is 'product': could be any category")
    print(f"   - Default fallback: {default_category}")
    
    # Ask for confirmation
    print(f"\n⚠️  This will permanently modify the database!")
    response = input(f"\n   Proceed with fixing? (yes/no): ").strip().lower()
    
    if response != 'yes':
        print("\n❌ Operation cancelled by user")
        return
    
    # Update transactions
    updated_count = 0
    for row in rows:
        txn_id, entity_name, txn_type, item_type = row
        
        # Determine category based on heuristics
        category = default_category
        
        # If dealing with grain, likely a Farmer
        if item_type and item_type.lower() == 'grain':
            category = 'Farmer'
        
        # Update the transaction
        cursor.execute("""
            UPDATE Transactions
            SET entity_table = ?
            WHERE transaction_id = ?
        """, (category, txn_id))
        
        updated_count += 1
        print(f"   ✓ Updated transaction ID {txn_id}: entity_table = '{category}'")
    
    # Commit changes
    conn.commit()
    
    print(f"\n✅ Successfully updated {updated_count} transaction(s)")

def verify_entity_categorization(cursor):
    """Verify all transactions have correct categorization"""
    print("\n" + "="*70)
    print("VERIFICATION: Checking Entity Categorization")
    print("="*70)
    
    # Check for invalid entity_table values
    cursor.execute("""
        SELECT COUNT(*)
        FROM Transactions
        WHERE entity_table NOT IN ('Farmer', 'Company', 'Dealer', 'Stock')
    """)
    invalid_table = cursor.fetchone()[0]
    
    # Check for invalid entity_type values
    cursor.execute("""
        SELECT COUNT(*)
        FROM Transactions
        WHERE entity_type NOT IN ('regular', 'irregular')
    """)
    invalid_type = cursor.fetchone()[0]
    
    # Check for regular without entity_id
    cursor.execute("""
        SELECT COUNT(*)
        FROM Transactions
        WHERE entity_type = 'regular' AND entity_id IS NULL
    """)
    regular_no_id = cursor.fetchone()[0]
    
    # Check for irregular with entity_id
    cursor.execute("""
        SELECT COUNT(*)
        FROM Transactions
        WHERE entity_type = 'irregular' AND entity_id IS NOT NULL
    """)
    irregular_with_id = cursor.fetchone()[0]
    
    # Display results
    print("\n📊 Validation Results:")
    print(f"   Invalid entity_table values: {invalid_table}")
    print(f"   Invalid entity_type values: {invalid_type}")
    print(f"   Regular without entity_id: {regular_no_id}")
    print(f"   Irregular with entity_id: {irregular_with_id}")
    
    total_issues = invalid_table + invalid_type + regular_no_id + irregular_with_id
    
    if total_issues == 0:
        print("\n✅ All transactions have correct categorization!")
    else:
        print(f"\n⚠️  Found {total_issues} issue(s) that need attention")
    
    # Show distribution
    print("\n📊 Entity Distribution:")
    cursor.execute("""
        SELECT 
            entity_table,
            entity_type,
            COUNT(*) as count
        FROM Transactions
        GROUP BY entity_table, entity_type
        ORDER BY entity_table, entity_type
    """)
    
    for row in cursor.fetchall():
        entity_table, entity_type, count = row
        status = "Permanent" if entity_type == "regular" else "Walk-in"
        print(f"   {entity_table:10s} + {status:10s} = {count:4d} transaction(s)")
    
    return total_issues == 0

def main():
    """Main execution"""
    print("\n" + "="*70)
    print("Entity Table Migration Script")
    print("="*70)
    print("Purpose: Fix entity_table = 'Irregular' to proper categories")
    print("="*70)
    
    db_path = get_database_path()
    
    if not os.path.exists(db_path):
        print(f"\n❌ Database not found: {db_path}")
        return
    
    print(f"\n📁 Database: {db_path}")
    
    # Connect to database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Step 1: Analyze current state
        irregular_rows = analyze_irregular_entity_tables(cursor)
        
        # Step 2: Fix if needed
        if irregular_rows:
            fix_irregular_entity_tables(cursor, conn, default_category='Farmer')
        
        # Step 3: Verify
        is_valid = verify_entity_categorization(cursor)
        
        # Summary
        print("\n" + "="*70)
        print("MIGRATION COMPLETE")
        print("="*70)
        
        if is_valid:
            print("\n✅ Database now uses correct entity categorization system!")
            print("\n   Three Categories: Farmer, Company, Dealer")
            print("   Two Statuses: Permanent (regular), Walk-in (irregular)")
        else:
            print("\n⚠️  Some issues remain - manual review recommended")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        conn.rollback()
    
    finally:
        conn.close()
    
    print("\n" + "="*70 + "\n")

if __name__ == "__main__":
    main()
