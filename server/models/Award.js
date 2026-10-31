import mongoose from "mongoose";
import { worldDataScopePlugin } from "../services/worldDataScope.js";
const schema=new mongoose.Schema({
  worldId:{type:mongoose.Schema.Types.ObjectId,ref:"World",default:null,index:true},
  key:{type:String,required:true},
  type:{type:String,required:true},
  year:Number,
  month:{type:Number,default:null},
  match:{type:mongoose.Schema.Types.ObjectId,ref:"Match",default:null},
  player:{type:mongoose.Schema.Types.ObjectId,ref:"Player",required:true},
  playerName:String,
  value:Number,
  metric:String
},{timestamps:true});
schema.index({worldId:1,key:1},{unique:true,name:"award_world_key_unique"});
schema.index({worldId:1,year:-1,month:1});
schema.index({worldId:1,player:1,year:-1});
schema.plugin(worldDataScopePlugin);

export default mongoose.model("Award",schema);
