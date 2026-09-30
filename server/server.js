import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app.js';
import {scheduleHistory} from './services/history.js';
import {connectClubsDatabase,disconnectClubsDatabase} from './config/clubsDatabase.js';

async function startServer(){
  try{
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');

    await connectClubsDatabase();

    scheduleHistory();
    setInterval(scheduleHistory,86400000).unref();

    const server=app.listen(process.env.PORT||5000,'0.0.0.0',()=>console.log('GG Matchday API is ready'));

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