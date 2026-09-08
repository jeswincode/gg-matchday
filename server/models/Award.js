import mongoose from "mongoose";
const schema=new mongoose.Schema({key:{type:String,unique:true,required:true},type:{type:String,required:true},year:Number,month:{type:Number,default:null},match:{type:mongoose.Schema.Types.ObjectId,ref:'Match',default:null},player:{type:mongoose.Schema.Types.ObjectId,ref:'Player',required:true},playerName:String,value:Number,metric:String},{timestamps:true});
schema.index({year:-1,month:1});schema.index({player:1,year:-1});
export default mongoose.model('Award',schema);
