from app.db.session import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("ALTER TABLE tax_settings ADD COLUMN description VARCHAR(255) DEFAULT ''"))
    conn.commit()
    print('Column added successfully')
