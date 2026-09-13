import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app.js';
import {repairMatchScores,scheduleHistory} from './services/history.js';
async function startServer(){try{await mongoose.connect(process.env.MONGODB_URI);console.log('MongoDB connected');const repaired=await repairMatchScores();if(repaired)console.log(`Repaired ${repaired} match score(s).`);scheduleHistory();setInterval(scheduleHistory,86400000).unref();app.listen(process.env.PORT||5000,'0.0.0.0',()=>console.log('GG Matchday API is ready'));}catch(error){console.error('Could not start GG Matchday:',error.message);process.exitCode=1;}}
startServer();
