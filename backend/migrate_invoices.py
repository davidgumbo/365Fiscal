"""Migration script to add missing columns to invoices table"""
import sqlite3

# Connect to database
conn = sqlite3.connect("./app.db")
cursor = conn.cursor()

# Columns to add with their SQL definitions
columns = [
    ("invoice_date", "TEXT"),
    ("due_date", "TEXT"),
    ("subtotal", "REAL DEFAULT 0"),
    ("discount_amount", "REAL DEFAULT 0"),
    ("tax_amount", "REAL DEFAULT 0"),
    ("amount_paid", "REAL DEFAULT 0"),
    ("amount_due", "REAL DEFAULT 0"),
    ("currency", "TEXT DEFAULT 'USD'"),
    ("payment_terms", "TEXT DEFAULT ''"),
    ("payment_reference", "TEXT DEFAULT ''"),
    ("notes", "TEXT DEFAULT ''"),
    ("zimra_status", "TEXT DEFAULT 'not_submitted'"),
    ("zimra_receipt_id", "TEXT DEFAULT ''"),
    ("zimra_receipt_counter", "INTEGER DEFAULT 0"),
    ("zimra_receipt_global_no", "INTEGER DEFAULT 0"),
    ("zimra_device_signature", "TEXT DEFAULT ''"),
    ("zimra_device_hash", "TEXT DEFAULT ''"),
    ("zimra_server_signature", "TEXT DEFAULT ''"),
    ("zimra_server_hash", "TEXT DEFAULT ''"),
    ("zimra_verification_code", "TEXT DEFAULT ''"),
    ("zimra_verification_url", "TEXT DEFAULT ''"),
    ("zimra_payload", "TEXT DEFAULT ''"),
    ("zimra_errors", "TEXT DEFAULT ''"),
]

for col_name, col_def in columns:
    try:
        sql = f"ALTER TABLE invoices ADD COLUMN {col_name} {col_def}"
        cursor.execute(sql)
        print(f"Added: {col_name}")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print(f"Exists: {col_name}")
        else:
            print(f"Error adding {col_name}: {e}")

conn.commit()
conn.close()
print("\nMigration complete!")
