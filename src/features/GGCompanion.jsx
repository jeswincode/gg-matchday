import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { PlayerSprite } from "./OriginalGGWorld";
import "./original-gg.css";

const idleLines = [
  "Ready when you are. The city is waiting.",
  "I heard the training centre has a new record to chase.",
  "A good matchday starts with a little confidence.",
  "Let's see what the clubs are building today.",
  "That golden HQ looks like it needs a visit.",
  "Remember: legends are made one session at a time.",
  "I could really go for a kickabout right now."
];

export default function GGCompanion({ onEnterWorld, playerName, activeTab }) {
  const [avatar,setAvatar] = useState({displayName:playerName||"Your player",appearance:{skinTone:"medium",bodyType:"athletic",hairStyle:"short",hairColor:"black",kitPrimary:"black",kitSecondary:"gold",bootColor:"white"}});
  const [line,setLine] = useState(0);
  const [transitioning,setTransitioning] = useState(false);
  const [position,setPosition] = useState({x:0,y:0});
  const [perched,setPerched] = useState(false);
  const [dragging,setDragging] = useState(false);
  const [motion,setMotion] = useState("idle");
  const [direction,setDirection] = useState("down");
  const [thrown,setThrown] = useState(false);
  const drag = useRef(null);
  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);
  const perchTimer = useRef(null);
  const suppressClick = useRef(false);
  const timer = useRef(null);
  useEffect(() => {
    let active=true;
    api("/world/bootstrap").then((data)=>{
      if(active&&data.avatar)setAvatar(data.avatar);
    }).catch(()=>{});
    return ()=>{active=false;};
  },[]);
  useEffect(() => {
    const interval=window.setInterval(()=>setLine((value)=>(value+1)%idleLines.length),18000);
    return ()=>window.clearInterval(interval);
  },[]);
  useEffect(()=>()=>window.clearTimeout(timer.current),[]);
  useEffect(()=>{
    let frame=null;
    const perchOnActiveTab=()=>{
      if(drag.current||dragging||thrown||transitioning)return;
      const active=document.querySelector(".bottom-nav button.active");
      const wrapper=wrapperRef.current;
      const button=buttonRef.current;
      if(!active||!wrapper||!button)return;
      const target=active.getBoundingClientRect();
      const current=button.getBoundingClientRect();
      const x=target.left+target.width/2-(current.left+current.width/2);
      const y=target.top-45-(current.top+current.height/2);
      setMotion("walking");
      setDirection(x<0?"left":"right");
      setPosition({x,y});
      setPerched(true);
      if(perchTimer.current!==null)window.clearTimeout(perchTimer.current);
      perchTimer.current=window.setTimeout(()=>setMotion("idle"),620);
    };
    frame=window.requestAnimationFrame(perchOnActiveTab);
    window.addEventListener("resize",perchOnActiveTab);
    return ()=>{
      if(frame!==null)window.cancelAnimationFrame(frame);
      window.removeEventListener("resize",perchOnActiveTab);
      if(perchTimer.current!==null)window.clearTimeout(perchTimer.current);
    };
  },[activeTab,dragging,thrown,transitioning]);

  function enterWorld(){
    if(transitioning)return;
    if(suppressClick.current){suppressClick.current=false;return;}
    setTransitioning(true);
    timer.current=window.setTimeout(()=>onEnterWorld(),720);
  }
  function startDrag(event){
    if(event.button!==undefined&&event.button!==0)return;
    drag.current={x:event.clientX,y:event.clientY,startX:position.x,startY:position.y,moved:false,lastX:event.clientX,lastY:event.clientY,lastAt:performance.now(),vx:0,vy:0};
    suppressClick.current=false;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event){
    if(!drag.current)return;
    const dx=event.clientX-drag.current.x,dy=event.clientY-drag.current.y;
    const now=performance.now(),elapsed=Math.max(1,now-drag.current.lastAt);
    drag.current.vx=(event.clientX-drag.current.lastX)/elapsed;drag.current.vy=(event.clientY-drag.current.lastY)/elapsed;
    drag.current.lastX=event.clientX;drag.current.lastY=event.clientY;drag.current.lastAt=now;
    if(Math.abs(dx)>4||Math.abs(dy)>4){drag.current.moved=true;setMotion("walking");if(Math.abs(dx)>Math.abs(dy))setDirection(dx<0?"left":"right");else setDirection(dy<0?"up":"down");}
    const maxX=Math.max(30,window.innerWidth/2-50),maxY=Math.max(30,window.innerHeight/2-65);
    setPosition({x:Math.max(-maxX,Math.min(maxX,drag.current.startX+dx)),y:Math.max(-maxY,Math.min(maxY,drag.current.startY+dy))});
  }
  function stopDrag(){
    const didMove=Boolean(drag.current?.moved);
    const speed=Math.hypot(drag.current?.vx||0,drag.current?.vy||0);
    if(didMove){suppressClick.current=true;window.setTimeout(()=>{suppressClick.current=false;},0);}
    drag.current=null;setDragging(false);
    if(didMove&&speed>.65){setThrown(true);setMotion("celebrating");window.setTimeout(()=>{setThrown(false);setMotion("idle");},720);}
    else setMotion("idle");
  }
  return <>
    <div className={"gg-companion-dim"+(transitioning?" is-active":"")} aria-hidden="true"/>
    <div ref={wrapperRef} className={"gg-companion"+(transitioning?" is-entering":"")+(dragging?" is-dragging":"")+(thrown?" is-thrown":"")+(perched?" is-perched":"")} style={{"--gg-companion-x":position.x+"px","--gg-companion-y":position.y+"px"}}>
      <div className="gg-companion-bubble"><span>{avatar.displayName||playerName||"Your teammate"}</span><p>{({home:"Ready for the next matchday?",record:"I've got my boots on. Let's make a record.",leaderboard:"Who's climbing the leaderboard today?",calendar:"Checking the next big fixture.",players:"Let's meet the squad."})[activeTab]||idleLines[line]}</p></div>
      <button ref={buttonRef} type="button" className="gg-companion-button" onClick={enterWorld} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag} aria-label={"Enter Original GG with "+(avatar.displayName||playerName||"your player")} title="Tap your player to enter Original GG">
        <span className="gg-companion-ring"/><PlayerSprite appearance={avatar.appearance||{}} motion={motion} direction={direction} animated/>
      </button>
      <small className="gg-companion-hint">TAP TO ENTER THE CITY</small>
    </div>
    {transitioning&&<div className="gg-companion-vortex" aria-hidden="true"><i/><i/><i/><span>GG</span></div>}
  </>;
}
