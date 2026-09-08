import mongoose from "mongoose";
const schema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},targetType:{type:String,enum:['gallery','news','moment'],required:true},targetId:{type:mongoose.Schema.Types.ObjectId,required:true}});schema.index({targetType:1,targetId:1,user:1},{unique:true});export default mongoose.model('Like',schema);
