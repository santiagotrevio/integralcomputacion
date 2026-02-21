CREATE TABLE IF NOT EXISTS crm_deals (
    id TEXT PRIMARY KEY,
    client_id TEXT,
    title TEXT NOT NULL,
    value REAL DEFAULT 0,
    status TEXT DEFAULT 'prospect',
    probability INTEGER DEFAULT 10,
    expected_close_date DATETIME,
    lost_reason TEXT,
    source TEXT DEFAULT 'organico',
    last_contact_date DATETIME,
    next_followup_date DATETIME,
    lat REAL,
    lng REAL,
    zone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(client_id) REFERENCES clients(id)
);

CREATE TABLE IF NOT EXISTS crm_activities (
    id TEXT PRIMARY KEY,
    deal_id TEXT,
    client_id TEXT,
    type TEXT DEFAULT 'note', 
    description TEXT,
    due_date DATETIME,
    completed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(deal_id) REFERENCES crm_deals(id),
    FOREIGN KEY(client_id) REFERENCES clients(id)
);
