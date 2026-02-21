const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// --- METRICS DASHBOARD (EXTENDED FOR INTELLIGENCE) ---
router.get('/metrics', (req, res) => {
    // We will do several queries using Promises to keep it clean
    const dbGet = (query, params = []) => {
        return new Promise((resolve, reject) => {
            db.get(query, params, (err, row) => err ? reject(err) : resolve(row));
        });
    };
    const dbAll = (query, params = []) => {
        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows));
        });
    };

    async function fetchMetrics() {
        try {
            // 1. Ejecutiva
            const currentMonthWon = await dbGet("SELECT SUM(value) as val FROM crm_deals WHERE status = 'won' AND strftime('%Y-%m', updated_at) = strftime('%Y-%m', 'now')");
            const forecast30 = await dbGet("SELECT SUM(value*probability/100) as val FROM crm_deals WHERE status NOT IN ('won', 'lost')");
            const pipelineTotal = await dbGet("SELECT SUM(value) as val FROM crm_deals WHERE status NOT IN ('won', 'lost')");

            const convData = await dbGet("SELECT COUNT(*) as won, (SELECT COUNT(*) FROM crm_deals WHERE status IN ('won', 'lost')) as total FROM crm_deals WHERE status = 'won'");
            const totalWonVal = await dbGet("SELECT SUM(value) as val, COUNT(id) as cnt FROM crm_deals WHERE status = 'won'");

            const conversionRate = (convData && convData.total > 0) ? Math.round((convData.won / convData.total) * 100) : 0;
            const ticketPromedio = (totalWonVal && totalWonVal.cnt > 0) ? (totalWonVal.val / totalWonVal.cnt) : 0;

            // 2. Inteligencia
            const originStats = await dbAll("SELECT source, COUNT(*) as count FROM crm_deals GROUP BY source");
            const inactive45 = await dbAll("SELECT id, title, client_id, last_contact_date FROM crm_deals WHERE status NOT IN ('won', 'lost') AND last_contact_date < datetime('now', '-45 days')");

            res.json({
                ejecutiva: {
                    ventasMes: currentMonthWon ? currentMonthWon.val || 0 : 0,
                    forecast30: forecast30 ? forecast30.val || 0 : 0,
                    pipelineTotal: pipelineTotal ? pipelineTotal.val || 0 : 0,
                    conversionRate: conversionRate,
                    ticketPromedio: ticketPromedio
                },
                inteligencia: {
                    origenes: originStats || [],
                    inactivos: inactive45 || []
                }
            });

        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    }

    fetchMetrics();
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
    db.run(sql, [id, client_id, title, value || 0, status || 'prospect', probability || 10, source || 'Directo', lat || null, lng || null, zone || ''], function (err) {
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
router.get('/activities/pending', (req, res) => {
    db.all("SELECT * FROM crm_activities WHERE completed = 0 ORDER BY due_date ASC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

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

            if (deal_id && completed) {
                db.run("UPDATE crm_deals SET last_contact_date = datetime('now') WHERE id = ?", [deal_id]);
            }
            res.json({ success: true, id });
        });
});

module.exports = router;
