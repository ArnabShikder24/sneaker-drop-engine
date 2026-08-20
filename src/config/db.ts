import { Sequelize } from 'sequelize';
import { env } from './env';

/**
 * Sequelize instance built from DATABASE_URL.
 * Reads the connection string once at startup — swapping from local Postgres
 * to Neon (or any hosted provider) is a one-line change in the .env.
 */
export const sequelize = new Sequelize(env.DATABASE_URL, {
  dialect: 'postgres',
  logging: env.NODE_ENV === 'development' ? (msg) => console.log(`[SQL] ${msg}`) : false,
  pool: {
    max: 10,
    min: 2,
    acquire: 30_000,
    idle: 10_000,
  },
  dialectOptions: {
    // Required for Neon/SSL-based hosted Postgres in production
    ssl:
      env.NODE_ENV === 'production'
        ? { require: true, rejectUnauthorized: false }
        : false,
  },
});

/**
 * Tests the database connection. Called once at server startup.
 * Throws on failure so the process exits rather than silently running broken.
 */
export async function connectDatabase(): Promise<void> {
  await sequelize.authenticate();
  console.log('✅ Database connection established.');
}