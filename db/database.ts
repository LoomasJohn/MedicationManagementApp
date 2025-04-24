import { openDatabaseSync, SQLiteDatabase } from 'expo-sqlite';

const db: SQLiteDatabase = openDatabaseSync('medication_manager.db');

const executeQuery = async (query: string) => {
  const statement = await db.prepareAsync(query);
  await statement.executeAsync();
  await statement.finalizeAsync();
};

export const setupDatabase = async () => {
  await executeQuery('PRAGMA foreign_keys = ON;');
  console.warn('🔌 SQLite database opened');

  // Dev mode: Uncomment to drop tables during development
  // await executeQuery('DROP TABLE IF EXISTS medication_logs;');
  // await executeQuery('DROP TABLE IF EXISTS medications;');

  await executeQuery(`
    CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      schedule TEXT NOT NULL, -- e.g., "8:00 AM", "Every 12 hours"
      side_effects TEXT,
      icon TEXT, -- Optional: emoji/icon name
      color TEXT  -- Optional: UI accent color for this medication
    );
  `);

  await executeQuery(`
    CREATE TABLE IF NOT EXISTS medication_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medication_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      taken INTEGER NOT NULL CHECK (taken IN (0, 1)),
      FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE
    );
  `);

  console.warn('✅ Medication database initialized');
};

export const getDBConnection = () => db;
