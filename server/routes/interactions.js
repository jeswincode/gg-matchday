import express from 'express';import mongoose from 'mongoose';
import Like from '../models/Like.js';import Match from '../models/Match.js';import Gallery from '../models/Gallery.js';import News from '../models/News.js';
import {optionalAuth,requireAuth} from '../middleware/auth.js';
const router=express.Router();
async function target(req,res,next){const model={gallery:Gallery,news:News,moment:Match}[req.params.type];if(!model||!mongoose.isValidObjectId(req.params.id))return res.status(400).json({message:'Invalid content.'});if(!await model.exists({_id:req.params.id}))return res.status(404).json({message:'Content not found.'});next();}
async function state(req,res){const filter={targetType:req.params.type,targetId:req.params.id};const [count,liked]=await Promise.all([Like.countDocuments(filter),req.user?Like.exists({...filter,user:req.user._id}):null]);res.set('Cache-Control','no-store');res.json({count,liked:Boolean(liked)});}
router.get('/:type/:id',optionalAuth,target,state);
router.post('/:type/:id/like',requireAuth,target,async(req,res)=>{try{await Like.updateOne({targetType:req.params.type,targetId:req.params.id,user:req.user._id},{$setOnInsert:{targetType:req.params.type,targetId:req.params.id,user:req.user._id}},{upsert:true});await state(req,res);}catch(e){if(e.code===11000)return state(req,res);res.status(500).json({message:'Could not save like.'});}});
router.delete('/:type/:id/like',requireAuth,target,async(req,res)=>res.status(404).json({message:'Likes cannot be removed.'}));
export default router;
