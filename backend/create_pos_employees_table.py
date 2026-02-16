import sqlite3
conn = sqlite3.connect('app.db')
c = conn.cursor()
c.execute('''CREATE TABLE IF NOT EXISTS pos_employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    user_id INTEGER REFERENCES users(id),
    name VARCHAR(200) NOT NULL,
    email VARCHAR(255) DEFAULT '',
    pin VARCHAR(10) DEFAULT '',
    role VARCHAR(50) DEFAULT 'cashier',
    is_active BOOLEAN DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)''')
conn.commit()
print('pos_employees table created successfully')
c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='pos_employees'")
print('Table exists:', c.fetchone())
conn.close()
