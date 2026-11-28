import mongoose from "mongoose";
const schema=new mongoose.Schema({player:{type:mongoose.Schema.Types.ObjectId,ref:'Player',required:true},key:{type:String,required:true},label:String},{timestamps:true});schema.index({player:1,key:1},{unique:true});export default mongoose.model('Achievement',schema);
