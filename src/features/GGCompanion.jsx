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

export default function GGCompanion({ onEnterWorld, playerName }) {
  const [avatar,setAvatar] = useState({displayName:playerName||"Your player",appearance:{skinTone:"medium",bodyType:"athletic",hairStyle:"short",hairColor:"black",kitPrimary:"black",kitSecondary:"gold",bootColor:"white"}});
  const [line,setLine] = useState(0);
  const [transitioning,setTransitioning] = useState(false);
  const [position,setPosition] = useState({x:0,y:0});
  const [dragging,setDragging] = useState(false);
  const drag = useRef(null);
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
  function enterWorld(){
    if(transitioning||suppressClick.current)return;
    setTransitioning(true);
    timer.current=window.setTimeout(()=>onEnterWorld(),720);
  }
  function startDrag(event){
    if(event.button!==undefined&&event.button!==0)return;
    drag.current={x:event.clientX,y:event.clientY,startX:position.x,startY:position.y,moved:false};
    suppressClick.current=false;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event){
    if(!drag.current)return;
    const dx=event.clientX-drag.current.x,dy=event.clientY-drag.current.y;
    if(Math.abs(dx)>4||Math.abs(dy)>4)drag.current.moved=true;
    const maxX=Math.max(30,window.innerWidth/2-50),maxY=Math.max(30,window.innerHeight/2-65);
    setPosition({x:Math.max(-maxX,Math.min(maxX,drag.current.startX+dx)),y:Math.max(-maxY,Math.min(maxY,drag.current.startY+dy))});
  }
  function stopDrag(){
    if(drag.current?.moved)suppressClick.current=true;
    drag.current=null;setDragging(false);
  }
  return <>
    <div className={"gg-companion-dim"+(transitioning?" is-active":"")} aria-hidden="true"/>
    <div className={"gg-companion"+(transitioning?" is-entering":"")+(dragging?" is-dragging":"")} style={{"--gg-companion-x":position.x+"px","--gg-companion-y":position.y+"px"}}>
      <div className="gg-companion-bubble"><span>{avatar.displayName||playerName||"Your teammate"}</span><p>{idleLines[line]}</p></div>
      <button type="button" className="gg-companion-button" onClick={enterWorld} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag} aria-label={"Enter Original GG with "+(avatar.displayName||playerName||"your player")} title="Tap your player to enter Original GG">
        <span className="gg-companion-ring"/><PlayerSprite appearance={avatar.appearance||{}}/>
      </button>
      <small className="gg-companion-hint">TAP TO ENTER THE CITY</small>
    </div>
    {transitioning&&<div className="gg-companion-vortex" aria-hidden="true"><i/><i/><i/><span>GG</span></div>}
  </>;
}
