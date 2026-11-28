import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app.js';
import {syncHistory} from './services/history.js';
import {connectClubsDatabase,disconnectClubsDatabase} from './config/clubsDatabase.js';
import {startClubSyncWorker} from './services/clubsSync.js';
import {startClubsMaintenanceWorker} from './services/clubsMaintenance.js';
import {startStatisticsMaintenanceWorker} from './services/persistedStatistics.js';
import {closeLiveData} from './services/liveData.js';
import {migrateV4ProfileLinks} from './services/profileLinks.js';
import ClubMatch from './models/clubs/ClubMatch.js';
import {ensureCreditBank} from './services/clubCreditBetting.js';
import {communitiesEnabled, prepareCommunityPlatform} from './services/communityPlatform.js';
import {forMatchdayWorkspaces} from './services/workspaceAccounts.js';

async function startServer(){
  try{
    if (process.env.NODE_ENV === "production" && (process.env.E2E_TEST_AUTH_SECRET || process.env.VITE_E2E_TEST_AUTH_SECRET)) {
      throw new Error("E2E test authentication secrets must never be configured in production.");
    }
    await mongoose.connect(process.env.MONGODB_URI);
    await migrateV4ProfileLinks(mongoose.connection);
    await prepareCommunityPlatform();
    console.log('MongoDB connected');

    try {
      await connectClubsDatabase();
      if (process.env.CLUBS_MONGODB_URI) {
        // A sparse unique index includes explicit nulls. Unlinked fixtures must omit the field.
        await ClubMatch.updateMany({ mainMatchId: { $type: "null" } }, { $unset: { mainMatchId: "" } }, { timestamps: false });
        await ensureCreditBank();
      }
    } catch (clubsError) {
      console.warn('Clubs MongoDB unavailable; core Matchday will continue without Clubs:', clubsError.message);
    }

    const workspaces = communitiesEnabled() ? forMatchdayWorkspaces : task => task();
    const scheduleHistory = () => workspaces(syncHistory).catch(() => console.error('Historical recognition could not be refreshed.'));
    void scheduleHistory();
    setInterval(scheduleHistory,86400000).unref();

    startClubSyncWorker(undefined, workspaces);
    startClubsMaintenanceWorker(undefined, workspaces);
    startStatisticsMaintenanceWorker(undefined, workspaces);

    const port=Number(process.env.PORT)||5000;
    const server=app.listen(port,'0.0.0.0',()=>console.log(`GG Matchday API is ready on port ${port}`));

    const shutdown=async(signal)=>{
      console.log(`GG Matchday shutting down (${signal})`);
      closeLiveData();
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
