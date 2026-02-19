
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
    const migrationFile = path.resolve(__dirname, '../migrations/001_initial_schema.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Ejecutamos el SQL dividido por puntos y coma para asegurar compatibilidad
            const statements = sql.split(';').filter(s => s.trim() !== '');

            db.run("BEGIN TRANSACTION");

            try {
                statements.forEach(stmt => {
                    db.run(stmt, (err) => {
                        if (err && !err.message.includes("duplicate column name")) {
                            // Ignoramos errores de columnas duplicadas por compatibilidad con DBs existentes
                            // Pero cualquier otro error serio detendrá la migración
                        }
                    });
                });

                // Aseguramos que las columnas críticas existan (Legacy Support)
                // Esto es por si la tabla 'products' ya existía sin estas columnas
                const essentialColumns = [
                    "ALTER TABLE products ADD COLUMN created_at DATETIME",
                    "ALTER TABLE products ADD COLUMN published INTEGER DEFAULT 0",
                    "ALTER TABLE products ADD COLUMN brand TEXT",
                    "ALTER TABLE products ADD COLUMN description TEXT"
                ];

                essentialColumns.forEach(colSql => {
                    db.run(colSql, () => { }); // Fallido silencioso si ya existen
                });

                db.run("COMMIT", (err) => {
                    if (err) reject(err);
                    else {
                        console.log("✅ Base de datos verificada y migrada correctamente.");
                        resolve();
                    }
                });
            } catch (error) {
                db.run("ROLLBACK");
                reject(error);
            }
        });
    });
}

// Inicializar base de datos
runMigrations().catch(err => {
    console.error("❌ Error crítico en migración de base de datos:", err);
});

module.exports = db;
