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
    if(transitioning)return;
    setTransitioning(true);
    timer.current=window.setTimeout(()=>onEnterWorld(),720);
  }
  return <>
    <div className={"gg-companion-dim"+(transitioning?" is-active":"")} aria-hidden="true"/>
    <div className={"gg-companion"+(transitioning?" is-entering":"")}>
      <div className="gg-companion-bubble"><span>{avatar.displayName||playerName||"Your teammate"}</span><p>{idleLines[line]}</p></div>
      <button type="button" className="gg-companion-button" onClick={enterWorld} aria-label={"Enter Original GG with "+(avatar.displayName||playerName||"your player")} title="Tap your player to enter Original GG">
        <span className="gg-companion-ring"/><PlayerSprite appearance={avatar.appearance||{}}/>
      </button>
      <small className="gg-companion-hint">TAP TO ENTER THE CITY</small>
    </div>
    {transitioning&&<div className="gg-companion-vortex" aria-hidden="true"><i/><i/><i/><span>GG</span></div>}
  </>;
}
