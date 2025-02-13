import pkg from 'pg';
import { consul } from './consul'; // Import Consul client

const { Pool } = pkg;

// Define PoolConfig interface
interface PoolConfig {
  user: string;
  host: string;
  database: string;
  password: string;
  port: number;
}

// Function to fetch PoolConfig safely from Consul
const getPoolConfig = async (): Promise<PoolConfig> => {
  try {
    const data = await consul.kv.get('config/db/pool');
    if (!data || !data.Value) {
      throw new Error('Database configuration not found in Consul');
    }
    return JSON.parse(data.Value) as PoolConfig;
  } catch (error) {
    console.error('Error fetching DB config from Consul:', error);
    process.exit(1);
  }
};

// Create a promise that resolves when the pool is initialized
export const poolPromise = getPoolConfig().then((config) => new Pool(config));

// Export the pool (initialized after poolPromise resolves)
export let pool: pkg.Pool;

poolPromise.then((initializedPool) => {
  pool = initializedPool;
  console.log('Database pool initialized');
});

// ✅ Updated function to wait for `poolPromise`
export const initializeDatabase = async () => {
  await poolPromise; // Ensure the pool is initialized before using it
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('Connection successful:', res.rows[0]);
  } catch (err) {
    console.error('Connection error:', (err as Error).message);
  }
};
 