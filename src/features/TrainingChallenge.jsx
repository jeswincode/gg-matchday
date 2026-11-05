import { useCallback, useEffect, useRef, useState } from "react";
import "./training-challenge.css";
import { api } from "../lib/api";

const WIDTH=640,HEIGHT=300,PLAYER_R=13;
const LANES=[58,116,174,232];

function randomObstacle(previousX=WIDTH+80){
  const lane=LANES[Math.floor(Math.random()*LANES.length)];
  const width=24+Math.floor(Math.random()*18);
  const height=24+Math.floor(Math.random()*22);
  return {x:Math.max(WIDTH+40,previousX),y:lane,width,height,passed:false};
}

export default function TrainingChallenge(){
  const canvasRef=useRef(null);
  const frameRef=useRef(null);
  const stateRef=useRef({running:false,startedAt:0,lastAt:0,player:{x:92,y:HEIGHT/2},obstacles:[],elapsed:0,over:false});
  const keysRef=useRef(new Set());
  const [status,setStatus]=useState("ready");
  const [elapsed,setElapsed]=useState(0);
  const [best,setBest]=useState(0);
  const [leaderboard,setLeaderboard]=useState([]);
  const [attempts,setAttempts]=useState(0);
  const runIdRef=useRef(null);
  const [message,setMessage]=useState("Dodge the training hurdles and stay on the pitch for as long as you can.");
  const touchDirection=useRef("");
  const finish=useCallback(async(now)=>{
    const game=stateRef.current;
    if(!game.running)return;
    game.running=false;game.over=true;game.elapsed=Math.max(0,(now-game.startedAt)/1000);
    setElapsed(game.elapsed);setStatus("saving");
    const score=Math.floor(game.elapsed*10)/10;
    setMessage("Full time · verifying your run…");
    try{
      const result=await api("/world/training/challenges/finish",{method:"POST",body:{runId:runIdRef.current,scoreSeconds:score}});
      runIdRef.current=null;
      setBest(result.bestSeconds||0);setAttempts(result.attempts||0);
      setMessage("Verified · "+Number(result.verifiedScore||score).toFixed(1)+" seconds. Your record is saved.");
      setStatus("over");
      const board=await api("/world/training/challenges/leaderboard");
      setLeaderboard(board.leaderboard||[]);
    }catch(error){
      runIdRef.current=null;
      setMessage((error.message||"Your run could not be verified.")+" Start another run to try again.");
      setStatus("over");
    }
  },[]);
  const start=useCallback(async()=>{
    if(status==="starting"||status==="saving")return;
    setStatus("starting");setMessage("Getting your training run ready…");
    try{
      const run=await api("/world/training/challenges/start",{method:"POST"});
      runIdRef.current=run.runId;
      const now=performance.now();
      stateRef.current={running:true,startedAt:now,lastAt:now,player:{x:92,y:HEIGHT/2},obstacles:[randomObstacle(WIDTH+80)],elapsed:0,over:false};
      keysRef.current.clear();setElapsed(0);setStatus("playing");setMessage("Keep moving. The hurdles get faster as your run continues.");
    }catch(error){
      setStatus("ready");setMessage(error.message||"Could not start a verified training run.");
    }
  },[status]);
  useEffect(()=>{
    let active=true;
    api("/world/training/challenges/leaderboard").then((result)=>{
      if(!active)return;
      setLeaderboard(result.leaderboard||[]);
      setBest(result.personalBestSeconds||0);
      setAttempts(result.attempts||0);
    }).catch(()=>{/* The game remains playable if the leaderboard is temporarily unavailable. */});
    return()=>{active=false;};
  },[]);
  useEffect(()=>{
    const canvas=canvasRef.current;
    const ctx=canvas?.getContext("2d");
    if(!ctx)return;
    let mounted=true;
    const draw=(now)=>{
      if(!mounted)return;
      const game=stateRef.current;
      const dt=Math.min(.04,Math.max(0,(now-game.lastAt)/1000));
      if(game.running){
        game.lastAt=now;game.elapsed=(now-game.startedAt)/1000;
        const speed=190+Math.min(190,game.elapsed*5);
        const keys=keysRef.current;
        const up=keys.has("ArrowUp")||keys.has("w")||touchDirection.current==="up";
        const down=keys.has("ArrowDown")||keys.has("s")||touchDirection.current==="down";
        const left=keys.has("ArrowLeft")||keys.has("a")||touchDirection.current==="left";
        const right=keys.has("ArrowRight")||keys.has("d")||touchDirection.current==="right";
        if(up)game.player.y-=245*dt;if(down)game.player.y+=245*dt;
        if(left)game.player.x-=210*dt;if(right)game.player.x+=210*dt;
        game.player.x=Math.max(PLAYER_R+8,Math.min(WIDTH-PLAYER_R-8,game.player.x));
        game.player.y=Math.max(PLAYER_R+8,Math.min(HEIGHT-PLAYER_R-8,game.player.y));
        game.obstacles.forEach(o=>{o.x-=speed*dt;});
        game.obstacles=game.obstacles.filter(o=>o.x+o.width>-10);
        if(game.obstacles.length===0||game.obstacles[game.obstacles.length-1].x<WIDTH-210)game.obstacles.push(randomObstacle());
        for(const o of game.obstacles){
          const nearestX=Math.max(o.x,Math.min(game.player.x,o.x+o.width));
          const nearestY=Math.max(o.y,Math.min(game.player.y,o.y+o.height));
          if(Math.hypot(game.player.x-nearestX,game.player.y-nearestY)<PLAYER_R+2){finish(now);break;}
        }
        if(Math.floor(game.elapsed*5)!==Math.floor((game.elapsed-dt)*5))setElapsed(game.elapsed);
      }
      ctx.clearRect(0,0,WIDTH,HEIGHT);
      const gradient=ctx.createLinearGradient(0,0,0,HEIGHT);gradient.addColorStop(0,"#254c36");gradient.addColorStop(1,"#122d20");ctx.fillStyle=gradient;ctx.fillRect(0,0,WIDTH,HEIGHT);
      ctx.strokeStyle="#d5e4c622";ctx.lineWidth=1;
      for(let x=0;x<=WIDTH;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,HEIGHT);ctx.stroke();}
      for(let y=0;y<=HEIGHT;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WIDTH,y);ctx.stroke();}
      ctx.strokeStyle="#f4e9c977";ctx.lineWidth=3;ctx.strokeRect(8,8,WIDTH-16,HEIGHT-16);
      ctx.setLineDash([9,10]);ctx.beginPath();ctx.moveTo(WIDTH/2,12);ctx.lineTo(WIDTH/2,HEIGHT-12);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle="#f5e5bd";ctx.font="bold 11px system-ui";ctx.fillText("GG TRAINING ARENA",22,27);
      for(const o of game.obstacles){
        ctx.fillStyle="#a94d3f";ctx.fillRect(o.x,o.y,o.width,o.height);
        ctx.fillStyle="#e4bd7a";ctx.fillRect(o.x+4,o.y+4,o.width-8,5);
        ctx.fillStyle="#472d28";ctx.fillRect(o.x+o.width/2-3,o.y+o.height-6,6,6);
      }
      const p=game.player;
      ctx.fillStyle="#0008";ctx.beginPath();ctx.ellipse(p.x+3,p.y+10,15,6,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#f0d080";ctx.beginPath();ctx.arc(p.x,p.y,PLAYER_R,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle="#fff0bd";ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle="#263b2b";ctx.beginPath();ctx.arc(p.x-3,p.y-2,4,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#f5eddb";ctx.font="bold 14px system-ui";ctx.fillText((game.running||game.over?game.elapsed:0).toFixed(1)+"s",WIDTH-75,27);
      if(!game.running){ctx.fillStyle="#07160dcc";ctx.fillRect(0,0,WIDTH,HEIGHT);ctx.textAlign="center";ctx.fillStyle="#f3d68e";ctx.font="900 25px system-ui";ctx.fillText(game.over?"FULL TIME":"READY FOR KICK-OFF",WIDTH/2,HEIGHT/2-8);ctx.fillStyle="#f4f0df";ctx.font="13px system-ui";ctx.fillText(game.over?"Press Play Again to chase a new best":"Press Start Run when you're ready",WIDTH/2,HEIGHT/2+20);ctx.textAlign="left";}
      frameRef.current=requestAnimationFrame(draw);
    };
    frameRef.current=requestAnimationFrame(draw);
    return ()=>{mounted=false;if(frameRef.current)cancelAnimationFrame(frameRef.current);};
  },[finish]);
  useEffect(()=>{
    const down=(event)=>{if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(event.key))event.preventDefault();keysRef.current.add(event.key);};
    const up=(event)=>keysRef.current.delete(event.key);
    window.addEventListener("keydown",down);window.addEventListener("keyup",up);
    return ()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);};
  },[]);
  return <section className="gg-training-challenge">
    <div className="gg-training-challenge-heading"><div><span>ARCADE TRAINING</span><h2>Ball Control Challenge</h2><p>Guide your ball around the moving hurdles. One collision ends the run.</p></div><div className="gg-training-best"><small>VERIFIED PERSONAL BEST</small><strong>{best.toFixed(1)}s</strong></div></div>
    <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} aria-label="Football training arena. Use arrow keys or the touch controls to dodge obstacles."/>
    <div className="gg-training-challenge-footer"><p role="status">{message}</p><div><span>RUN TIME <b>{elapsed.toFixed(1)}s</b></span><button type="button" className="gg-world-primary" onClick={start} disabled={status==="starting"||status==="saving"}>{status==="starting"?"Preparing…":status==="saving"?"Saving…":status==="playing"?"Restart Run":status==="over"?"Play Again":"Start Run"}</button></div></div>
    <div className="gg-training-touch" aria-label="Touch movement controls">
      <button type="button" onPointerDown={()=>{touchDirection.current="up";}} onPointerUp={()=>{touchDirection.current="";}} onPointerCancel={()=>{touchDirection.current="";}} onPointerLeave={()=>{touchDirection.current="";}} aria-label="Move up">↑</button>
      <div><button type="button" onPointerDown={()=>{touchDirection.current="left";}} onPointerUp={()=>{touchDirection.current="";}} onPointerCancel={()=>{touchDirection.current="";}} onPointerLeave={()=>{touchDirection.current="";}} aria-label="Move left">←</button><button type="button" onPointerDown={()=>{touchDirection.current="down";}} onPointerUp={()=>{touchDirection.current="";}} onPointerCancel={()=>{touchDirection.current="";}} onPointerLeave={()=>{touchDirection.current="";}} aria-label="Move down">↓</button><button type="button" onPointerDown={()=>{touchDirection.current="right";}} onPointerUp={()=>{touchDirection.current="";}} onPointerCancel={()=>{touchDirection.current="";}} onPointerLeave={()=>{touchDirection.current="";}} aria-label="Move right">→</button></div>
    </div>
    <div className="gg-training-leaderboard"><div><span>GG CITY LEADERBOARD</span><small>{attempts} verified runs by you</small></div>{leaderboard.length?leaderboard.slice(0,5).map((entry)=><div className="gg-training-leaderboard-row" key={entry.playerId}><b>#{entry.rank}</b><strong>{entry.displayName}</strong><span>{Number(entry.bestSeconds).toFixed(1)}s</span></div>):<p>Be the first to set a verified city record.</p>}</div><small className="gg-training-challenge-note">Desktop: arrow keys or WASD · Mobile: hold a direction · Run starts and best times are checked and stored in the GG Clubs database.</small>
  </section>;
}
