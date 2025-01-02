import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { logWithTimestamp } from '../utils';

// Initialize SQLite database
const sqlite = new Database('sqlite.db');
logWithTimestamp('[Database] Initialized SQLite database');

// Create and export the database instance
export const db = drizzle(sqlite);
logWithTimestamp('[Database] Created Drizzle instance');

// Export the database type
export type DB = typeof db; 