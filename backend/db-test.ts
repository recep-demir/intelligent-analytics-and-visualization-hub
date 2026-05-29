import path = require('path');
import sqlite3 = require('sqlite3');
import sqlite = require('sqlite');

async function verifyDatabaseConnection(): Promise<void> {
    try {
        const dbPath = path.resolve(__dirname, 'database.sqlite');
        
        const db = await sqlite.open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        console.log('Database connection established successfully.');

        interface SqliteTable {
            name: string;
        }

        const tables = await db.all<SqliteTable[]>(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
        );

        console.log('Available database tables:');
        tables.forEach((table) => {
            console.log(` - ${table.name}`);
        });

        await db.close();
    } catch (error) {
        console.error('Database verification failed:', error);
        process.exit(1);
    }
}

verifyDatabaseConnection();