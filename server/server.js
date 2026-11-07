import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app.js';
import {scheduleHistory} from './services/history.js';
import {connectClubsDatabase,disconnectClubsDatabase} from './config/clubsDatabase.js';
import { resolveV4PreviewDatabaseNames } from './config/previewDatabaseGuard.js';
import {startClubSyncWorker} from './services/clubsSync.js';
import {startClubsMaintenanceWorker} from './services/clubsMaintenance.js';
import {startStatisticsMaintenanceWorker} from './services/persistedStatistics.js';

async function startServer(){
  try{
    if (process.env.NODE_ENV === "production" && (process.env.E2E_TEST_AUTH_SECRET || process.env.VITE_E2E_TEST_AUTH_SECRET)) {
      throw new Error("E2E test authentication secrets must never be configured in production.");
    }
    // V4 preview is a separate API process and must use distinct staging
    // databases before connecting. Fail closed rather than writing World data
    // into the V3 Core or Clubs databases.
    const previewDatabaseNames = resolveV4PreviewDatabaseNames(process.env);
    const previewMode = Boolean(previewDatabaseNames);
    await mongoose.connect(
      process.env.MONGODB_URI,
      previewMode ? { dbName: previewDatabaseNames.coreDbName } : undefined,
    );
    console.log(previewMode ? "V4 preview Core database connected" : 'MongoDB connected');

    try {
      await connectClubsDatabase({
        databaseNameOverride: previewMode ? previewDatabaseNames.clubsDbName : undefined,
      });
    } catch (clubsError) {
      console.warn('Clubs MongoDB unavailable; core Matchday will continue without Clubs:', clubsError.message);
    }
    if (previewMode) {
      console.log("V4 preview mode enabled; legacy background workers are disabled.");
    } else {
      scheduleHistory();
      setInterval(scheduleHistory,86400000).unref();

      startClubSyncWorker();
      startClubsMaintenanceWorker();
      startStatisticsMaintenanceWorker();
    }

    const port=Number(process.env.PORT)||5000;
    const server=app.listen(port,'0.0.0.0',()=>console.log(`GG Matchday API is ready on port ${port}`));

    const shutdown=async(signal)=>{
      console.log(`GG Matchday shutting down (${signal})`);
      server.close(async()=>{
        await Promise.allSettled([
          mongoose.disconnect(),
          disconnectClubsDatabase(),
        ]);
        process.exit(0);
      });
    };

    process.once('SIGINT',()=>shutdown('SIGINT'));
    process.once('SIGTERM',()=>shutdown('SIGTERM'));
  }catch(error){
    console.error('Could not start GG Matchday:',error.message);
    process.exitCode=1;
  }
}

startServer();