const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// --- METRICS DASHBOARD ---
router.get('/metrics', (req, res) => {
    // Basic CRM metrics
    const metrics = {
        totalDeals: 0,
        wonValue: 0,
        conversionRate: 0,
        activeClients: 0
    };

    db.get("SELECT COUNT(id) as cnt FROM crm_deals WHERE status != 'lost'", [], (err, row1) => {
        if (!err && row1) metrics.totalDeals = row1.cnt;

        db.get("SELECT SUM(value) as val FROM crm_deals WHERE status = 'won'", [], (err, row2) => {
            if (!err && row2 && row2.val) metrics.wonValue = row2.val;

            db.get("SELECT COUNT(*) as won, (SELECT COUNT(*) FROM crm_deals WHERE status IN ('won', 'lost')) as total FROM crm_deals WHERE status = 'won'", [], (err, row3) => {
                if (!err && row3 && row3.total > 0) {
                    metrics.conversionRate = Math.round((row3.won / row3.total) * 100);
                }

                db.get("SELECT COUNT(DISTINCT client_id) as act FROM crm_deals WHERE status NOT IN ('won', 'lost')", [], (err, row4) => {
                    if (!err && row4) metrics.activeClients = row4.act;

                    res.json(metrics);
                });
            });
        });
    });
});

// --- DEALS CRUD ---
router.get('/deals', (req, res) => {
    db.all(`
        SELECT d.*, c.name as client_name, c.company as client_company, c.phone as client_phone 
        FROM crm_deals d 
        LEFT JOIN clients c ON d.client_id = c.id
        ORDER BY d.updated_at DESC
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

router.post('/deals', (req, res) => {
    const { client_id, title, value, status, probability, source, lat, lng, zone } = req.body;
    const id = "deal_" + Date.now();
    const sql = `INSERT INTO crm_deals (id, client_id, title, value, status, probability, source, lat, lng, zone, last_contact_date) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`;
    db.run(sql, [id, client_id, title, value || 0, status || 'prospect', probability || 10, source || 'organico', lat || null, lng || null, zone || ''], function (err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ success: true, id });
    });
});

router.patch('/deals/:id/status', (req, res) => {
    const { status, lost_reason } = req.body;
    db.run(`UPDATE crm_deals SET status = ?, lost_reason = ?, updated_at = datetime('now') WHERE id = ?`,
        [status, lost_reason || null, req.params.id], function (err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ success: true });
        });
});

// --- ACTIVITIES CRUD ---
router.get('/deals/:id/activities', (req, res) => {
    db.all("SELECT * FROM crm_activities WHERE deal_id = ? ORDER BY created_at DESC", [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

router.post('/activities', (req, res) => {
    const { deal_id, client_id, type, description, completed, due_date } = req.body;
    const id = "act_" + Date.now();
    db.run(`INSERT INTO crm_activities (id, deal_id, client_id, type, description, completed, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, deal_id, client_id, type, description, completed ? 1 : 0, due_date || null], function (err) {
            if (err) return res.status(400).json({ error: err.message });
            // Update deal's last_contact_date automatically
            if (deal_id) {
                db.run("UPDATE crm_deals SET last_contact_date = datetime('now') WHERE id = ?", [deal_id]);
            }
            res.json({ success: true, id });
        });
});

module.exports = router;
