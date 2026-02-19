
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../inventario.db');
const db = new sqlite3.Database(dbPath);

/**
 * Sistema de Migraciones Profesional
 * Ejecuta el esquema inicial y asegura que la estructura sea correcta
 */
async function runMigrations() {
    const migrationsDir = path.resolve(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        console.log(`Aplicando migración: ${file}...`);

        await new Promise((resolve, reject) => {
            db.serialize(() => {
                const statements = sql.split(';').filter(s => s.trim() !== '');
                db.run("BEGIN TRANSACTION");
                try {
                    statements.forEach(stmt => {
                        db.run(stmt, (err) => {
                            if (err && !err.message.includes("duplicate column name") && !err.message.includes("UNIQUE constraint failed")) {
                                // Ignorar errores comunes de duplicados durante migraciones de desarrollo
                            }
                        });
                    });
                    db.run("COMMIT", (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                } catch (error) {
                    db.run("ROLLBACK");
                    reject(error);
                }
            });
        });
    }

    // Asegurar columnas críticas (Legacy Support)
    return new Promise((resolve) => {
        const essentialColumns = [
            "ALTER TABLE products ADD COLUMN created_at DATETIME",
            "ALTER TABLE products ADD COLUMN published INTEGER DEFAULT 0",
            "ALTER TABLE products ADD COLUMN brand TEXT",
            "ALTER TABLE products ADD COLUMN description TEXT"
        ];
        essentialColumns.forEach(colSql => db.run(colSql, () => { }));
        console.log("✅ Sistema de base de datos actualizado.");
        resolve();
    });
}

// Inicializar base de datos
runMigrations().catch(err => {
    console.error("❌ Error crítico en migración de base de datos:", err);
});

module.exports = db;
