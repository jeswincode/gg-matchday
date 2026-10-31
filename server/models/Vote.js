import mongoose from "mongoose";
import { worldDataScopePlugin } from "../services/worldDataScope.js";
const schema=new mongoose.Schema({
  worldId:{type:mongoose.Schema.Types.ObjectId,ref:"World",default:null,index:true},
  match:{type:mongoose.Schema.Types.ObjectId,ref:"Match",required:true},
  voter:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
  player:{type:mongoose.Schema.Types.ObjectId,ref:"Player",required:true}
},{timestamps:true});
schema.index({worldId:1,match:1,voter:1},{unique:true,name:"vote_world_match_voter_unique"});
schema.index({worldId:1,match:1,player:1});
schema.plugin(worldDataScopePlugin);

export default mongoose.model("Vote",schema);
