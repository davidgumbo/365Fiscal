from app.db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()
result = db.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
tables = [r[0] for r in result]
print("Tables:", tables)

# Check foreign key info for each table
for table in tables:
    try:
        fk_result = db.execute(text(f"PRAGMA foreign_key_list({table})"))
        fks = list(fk_result)
        if fks:
            print(f"\n{table} references:")
            for fk in fks:
                print(f"  -> {fk}")
    except Exception as e:
        print(f"Error with {table}: {e}")

db.close()
