import mongoose from "mongoose";
import { worldDataScopePlugin } from "../services/worldDataScope.js";
const schema=new mongoose.Schema({
  worldId:{type:mongoose.Schema.Types.ObjectId,ref:"World",default:null,index:true},
  player:{type:mongoose.Schema.Types.ObjectId,ref:"Player",required:true},
  key:{type:String,required:true},
  label:String
},{timestamps:true});
schema.index({worldId:1,player:1,key:1},{unique:true,name:"achievement_world_player_key_unique"});
schema.plugin(worldDataScopePlugin);

export default mongoose.model("Achievement",schema);
