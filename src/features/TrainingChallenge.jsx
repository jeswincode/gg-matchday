import { useCallback, useEffect, useRef, useState } from "react";
import "./training-challenge.css";
import { api } from "../lib/api";
import { CHALLENGE_HEIGHT, CHALLENGE_STEP_SECONDS, CHALLENGE_WIDTH, createChallengeState, normalizeChallengeInput, stepChallenge } from "../../shared/trainingChallengeEngine.js";

const WIDTH=CHALLENGE_WIDTH,HEIGHT=CHALLENGE_HEIGHT,PLAYER_R=13;

export default function TrainingChallenge({onCelebrate}={}){
  const canvasRef=useRef(null);
  const frameRef=useRef(null);
  const stateRef=useRef({running:false,startedAt:0,lastAt:0,engine:null,accumulator:0,elapsed:0,over:false});
  const keysRef=useRef(new Set());
  const [status,setStatus]=useState("ready");
  const [elapsed,setElapsed]=useState(0);
  const [best,setBest]=useState(0);
  const [leaderboard,setLeaderboard]=useState([]);
  const [attempts,setAttempts]=useState(0);
  const runIdRef=useRef(null);
  const [message,setMessage]=useState("Dodge the training hurdles and stay on the pitch for as long as you can.");
  function readInput(){
    const keys=keysRef.current;
    return normalizeChallengeInput({
      up:keys.has("ArrowUp")||keys.has("w")||touchDirection.current==="up",
      down:keys.has("ArrowDown")||keys.has("s")||touchDirection.current==="down",
      left:keys.has("ArrowLeft")||keys.has("a")||touchDirection.current==="left",
      right:keys.has("ArrowRight")||keys.has("d")||touchDirection.current==="right",
    });
  }
  function syncInput(){
    const runId=runIdRef.current;
    if(!runId||!stateRef.current.running)return;
    const direction=readInput();
    const snapshot=[direction.up,direction.down,direction.left,direction.right].map(Boolean).map(Number).join("");
    if(snapshot===inputSnapshotRef.current)return;
    inputSnapshotRef.current=snapshot;
    const seq=++inputSequenceRef.current;
    inputQueueRef.current=inputQueueRef.current.then(()=>api("/world/training/challenges/"+runId+"/input",{method:"POST",body:{seq,direction}})).catch((error)=>{
      inputFailureRef.current=error;
    });
  }
  function updateTouchDirection(direction){
    touchDirection.current=direction;
    syncInput();
  }

  const touchDirection=useRef("");
  const inputSequenceRef=useRef(0);
  const inputSnapshotRef=useRef("0000");
  const inputQueueRef=useRef(Promise.resolve());
  const inputFailureRef=useRef(null);
  const finish=useCallback(async()=>{
    const game=stateRef.current;
    if(!game.running)return;
    game.running=false;game.over=true;game.elapsed=game.engine?.elapsed||0;
    setElapsed(game.elapsed);setStatus("saving");
    const runId=runIdRef.current;
    setMessage("Full time · replaying your inputs on the server…");
    try{
      await inputQueueRef.current;
      if(inputFailureRef.current)throw inputFailureRef.current;
      const result=await api("/world/training/challenges/finish",{method:"POST",body:{runId}});
      runIdRef.current=null;
      setBest(result.bestSeconds||0);setAttempts(result.attempts||0);
      setMessage("Server verified · "+Number(result.verifiedScore||game.elapsed).toFixed(1)+" seconds. Your record is saved.");
      setStatus("over");
      onCelebrate?.();
      const board=await api("/world/training/challenges/leaderboard");
      setLeaderboard(board.leaderboard||[]);
    }catch(error){
      runIdRef.current=null;
      setMessage((error.message||"Your run could not be verified.")+" Start another run to try again.");
      setStatus("over");
    }
  },[onCelebrate]);
  const start=useCallback(async()=>{
    if(status==="starting"||status==="saving")return;
    stateRef.current.running=false;
    setStatus("starting");setMessage("Getting your training run ready…");
    try{
      const run=await api("/world/training/challenges/start",{method:"POST"});
      runIdRef.current=run.runId;
      inputSequenceRef.current=0;inputSnapshotRef.current="0000";inputFailureRef.current=null;inputQueueRef.current=Promise.resolve();
      const now=performance.now();
      stateRef.current={running:true,startedAt:now,lastAt:now,engine:createChallengeState(run.seed),accumulator:0,elapsed:0,over:false};
      keysRef.current.clear();touchDirection.current="";setElapsed(0);setStatus("playing");setMessage("Keep moving. The hurdles get faster as your run continues.");
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
      const dt=Math.min(.05,Math.max(0,(now-game.lastAt)/1000));
      if(game.running&&game.engine){
        game.lastAt=now;game.accumulator+=dt;
        const input=readInput();
        let collided=false;
        while(game.accumulator>=CHALLENGE_STEP_SECONDS&&game.running){
          collided=stepChallenge(game.engine,input,CHALLENGE_STEP_SECONDS);
          game.accumulator-=CHALLENGE_STEP_SECONDS;
          game.elapsed=game.engine.elapsed;
          if(collided){finish();break;}
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
      for(const o of (game.engine?.obstacles||[])){
        ctx.fillStyle="#a94d3f";ctx.fillRect(o.x,o.y,o.width,o.height);
        ctx.fillStyle="#e4bd7a";ctx.fillRect(o.x+4,o.y+4,o.width-8,5);
        ctx.fillStyle="#472d28";ctx.fillRect(o.x+o.width/2-3,o.y+o.height-6,6,6);
      }
      const p=game.engine?.player||{x:92,y:HEIGHT/2};
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
    const down=(event)=>{if(!stateRef.current.running)return;if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(event.key))event.preventDefault();keysRef.current.add(event.key);syncInput();};
    const up=(event)=>{keysRef.current.delete(event.key);syncInput();};
    const blur=()=>{keysRef.current.clear();touchDirection.current="";syncInput();};
    window.addEventListener("keydown",down);window.addEventListener("keyup",up);window.addEventListener("blur",blur);
    return ()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);window.removeEventListener("blur",blur);};
  },[]);
  return <section className="gg-training-challenge">
    <div className="gg-training-challenge-heading"><div><span>ARCADE TRAINING</span><h2>Ball Control Challenge</h2><p>Guide your ball around the moving hurdles. One collision ends the run.</p></div><div className="gg-training-best"><small>VERIFIED PERSONAL BEST</small><strong>{best.toFixed(1)}s</strong></div></div>
    <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} aria-label="Football training arena. Use arrow keys or the touch controls to dodge obstacles."/>
    <div className="gg-training-challenge-footer"><p role="status">{message}</p><div><span>RUN TIME <b>{elapsed.toFixed(1)}s</b></span><button type="button" className="gg-world-primary" onClick={start} disabled={status==="starting"||status==="saving"}>{status==="starting"?"Preparing…":status==="saving"?"Saving…":status==="playing"?"Restart Run":status==="over"?"Play Again":"Start Run"}</button></div></div>
    <div className="gg-training-touch" aria-label="Touch movement controls">
      <button type="button" onPointerDown={()=>updateTouchDirection("up")} onPointerUp={()=>updateTouchDirection("")} onPointerCancel={()=>updateTouchDirection("")} onPointerLeave={()=>updateTouchDirection("")} aria-label="Move up">↑</button>
      <div><button type="button" onPointerDown={()=>updateTouchDirection("left")} onPointerUp={()=>updateTouchDirection("")} onPointerCancel={()=>updateTouchDirection("")} onPointerLeave={()=>updateTouchDirection("")} aria-label="Move left">←</button><button type="button" onPointerDown={()=>updateTouchDirection("down")} onPointerUp={()=>updateTouchDirection("")} onPointerCancel={()=>updateTouchDirection("")} onPointerLeave={()=>updateTouchDirection("")} aria-label="Move down">↓</button><button type="button" onPointerDown={()=>updateTouchDirection("right")} onPointerUp={()=>updateTouchDirection("")} onPointerCancel={()=>updateTouchDirection("")} onPointerLeave={()=>updateTouchDirection("")} aria-label="Move right">→</button></div>
    </div>
    <div className="gg-training-leaderboard"><div><span>GG CITY LEADERBOARD</span><small>{attempts} verified runs by you</small></div>{leaderboard.length?leaderboard.slice(0,5).map((entry)=><div className="gg-training-leaderboard-row" key={entry.playerId}><b>#{entry.rank}</b><strong>{entry.displayName}</strong><span>{Number(entry.bestSeconds).toFixed(1)}s</span></div>):<p>Be the first to set a verified city record.</p>}</div><small className="gg-training-challenge-note">Desktop: arrow keys or WASD · Mobile: hold a direction · Run starts and best times are checked and stored in the GG Clubs database.</small>
  </section>;
}
