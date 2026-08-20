import http from 'node:http';
import app from './app';
import { env } from './config/env';
import { connectDatabase, sequelize } from './config/db';
import { initSocket } from './sockets/index';
import { startExpireReservationsJob } from './jobs/expireReservations.job';

// Import all models so Sequelize registers them before sync
import './db/models/index';

async function bootstrap(): Promise<void> {
  // 1. Verify database connection
  await connectDatabase();

  // 2. Sync models → creates/alters tables if needed.
  //    alter:true is safe for development. For production, use proper migrations.
  await sequelize.sync({ alter: true });
  console.log('✅ Database models synced.');

  // 3. Create HTTP server (attach Express app)
  const httpServer = http.createServer(app);

  // 4. Attach Socket.io to the same HTTP server
  initSocket(httpServer);

  // 5. Start the reservation expiration background job
  startExpireReservationsJob();

  // 6. Start listening
  httpServer.listen(env.PORT, () => {
    console.log(`\n🚀 Server running in ${env.NODE_ENV} mode`);
    console.log(`   HTTP  → http://localhost:${env.PORT}`);
    console.log(`   WS    → ws://localhost:${env.PORT}`);
    console.log(`   Health→ http://localhost:${env.PORT}/health\n`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('[Server] SIGTERM received. Shutting down gracefully...');
    httpServer.close(async () => {
      await sequelize.close();
      console.log('[Server] Database connection closed. Goodbye.');
      process.exit(0);
    });
  });
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});