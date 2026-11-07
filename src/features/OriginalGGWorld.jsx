import { useCallback, useEffect, useRef, useState } from "react";
import { getRoomInteraction } from "../../shared/worldRoomInteractions.js";
import { useOriginalGGRealtime } from "./useOriginalGGRealtime";
import { api } from "../lib/api";
import "./original-gg.css";
import { G, Layer, N, rgba } from "./companion/leaflet-pip-engine.js";
import { normalizeCharacterDirection, normalizeCharacterMotion, getCharacterAnimationProfile, getCharacterMotionDuration } from "../../shared/characterAnimation.js";
import TrainingChallenge from "./TrainingChallenge.jsx";
import WorldEconomyPanel from "./WorldEconomyPanel.jsx";
import WorldSocialPanel from "./WorldSocialPanel.jsx";
import ResidenceAccessPanel from "./ResidenceAccessPanel.jsx";
import ClubGroundManagementPanel from "./ClubGroundManagementPanel.jsx";

const places = [
  { id:"gg-hq", name:"GG Headquarters", kind:"hq", x:900, y:300, desc:"The golden heart of Original GG. Meet the community and explore the trophy hall." },
  { id:"grand-stadium", name:"Grand Stadium", kind:"stadium", x:460, y:570, desc:"The home of matchday nights, club showcases and unforgettable football moments." },
  { id:"training-centre", name:"Training Centre", kind:"training", x:1320, y:540, desc:"Build your routine, log workout counters and chase personal bests." },
  { id:"club-district", name:"Club District", kind:"club", x:390, y:920, desc:"A neighbourhood of club grounds and football homes." },
  { id:"residence-gardens", name:"Residence Gardens", kind:"home", x:1120, y:920, desc:"A home district for GG players, with private interiors." },
  { id:"academy-square", name:"Football Academy", kind:"academy", x:850, y:750, desc:"A place for skill challenges and guided tours." },
  { id:"market-square", name:"Market Square", kind:"market", x:1510, y:840, desc:"Browse earned cosmetics, customise your footballer and upgrade your home in the GG Market." },
  { id:"garden-park", name:"Garden Park", kind:"park", x:1450, y:280, desc:"A green pocket of the city with paths and benches." }
];
const exercises = [["pushups","Push-ups"],["pullups","Pull-ups"],["squats","Squats"],["planks","Plank holds"]];
const emptyTraining = { pushups:"", pullups:"", squats:"", planks:"" };

export function PlayerSprite({ appearance = {}, motion = "idle", direction = "down", animated = false, pose = "standing" }) {
  const canvasRef = useRef(null);
  const safeMotion = normalizeCharacterMotion(motion);
  const safeDirection = normalizeCharacterDirection(direction);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!context) return;
    const skin = ({deep:"#75432f",dark:"#965c42",medium:"#c1835c",tan:"#d49a70",light:"#e5b891",fair:"#f0c9a8"})[appearance.skinTone] || "#c1835c";
    const hair = ({black:"#171717",brown:"#51301f",blonde:"#e1bd62",red:"#9d3d2e",silver:"#aaaeb9",blue:"#4167b6",teal:"#28a7a0",pink:"#e36ca8",white:"#e8e8e4"})[appearance.hairColor] || "#171717";
    const kit = ({black:"#17191e",white:"#f3f1e8",gold:"#d7ad52",red:"#b6383d",blue:"#2864a2",green:"#34784f",purple:"#71499c",orange:"#c96b32",navy:"#172a50",teal:"#218f89",pink:"#d95d91",maroon:"#681f35"})[appearance.kitPrimary] || "#17191e";
    const trim = ({black:"#151515",white:"#f3f1e8",gold:"#d7ad52",red:"#b6383d",blue:"#2864a2",green:"#34784f",purple:"#71499c",orange:"#c96b32",navy:"#172a50",teal:"#218f89",pink:"#d95d91",maroon:"#681f35"})[appearance.kitSecondary] || "#d7ad52";
    const boot = ({black:"#171717",white:"#f5f3eb",gold:"#d7ad52",red:"#c64040",blue:"#3869b5",green:"#43865a",orange:"#d97835",purple:"#71499c",pink:"#e36ca8",cyan:"#46c7d5"})[appearance.bootColor] || "#f5f3eb";
    const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const profile = getCharacterAnimationProfile(safeMotion);
    let motionAllowed = animated && !motionQuery?.matches;
    let frame = 0, lastFrameAt = 0, animationFrame = null;
    const drawFrame = (now = 0) => {
      if (motionAllowed && now - lastFrameAt < profile.frameMs) {
        animationFrame = window.requestAnimationFrame(drawFrame);
        return;
      }
      if (motionAllowed) {
        frame = (frame + 1) % profile.frames;
        lastFrameAt = now;
      }

      const seated = pose === "seated";
      const sideFacing = safeDirection === "left" || safeDirection === "right";
      const facingBack = safeDirection === "up";
      const headX = (safeDirection === "left" ? 13 : safeDirection === "right" ? 19 : 16) + (seated ? -1 : 0);
      const gait = safeMotion === "walking" ? [0, 1, 0, -1][frame % 4] : 0;
      const danceStep = safeMotion === "dance" ? [0, 1, 0, -1, -1, 0, 1, 0][frame % 8] : 0;
      const idleBob = safeMotion === "idle" && !seated ? [0, 0, -1, 0][frame % 4] : 0;
      const celebrationJump = ["celebrating", "cheer"].includes(safeMotion) ? [0, -1, -3, -1][frame % 4] : 0;
      const jump = idleBob + celebrationJump;
      const bodySway = safeMotion === "dance" ? [0, 1, 0, -1, 0, -1, 0, 1][frame % 8]
        : safeMotion === "kick" ? [0, -1, 0, 1, 0, 0][frame % 6] : 0;
      const leftLegStep = safeMotion === "walking" ? gait : safeMotion === "dance" ? danceStep : 0;
      const rightLegStep = safeMotion === "walking" ? -gait : safeMotion === "dance" ? -danceStep : 0;
      const layer = new Layer();
      const g = new G(layer,{outline:"#211b17"},0);

      // Head and hair are drawn around a shifted centre so left/right facing
      // profiles read as side views, while "up" shows the back of the footballer.
      g.stamp((l)=>l.ell(headX,8+jump,sideFacing?4:5,6,skin));
      const hairStyle = appearance.hairStyle || "short";
      if (hairStyle !== "bald") {
        if (hairStyle === "afro") {
          g.stamp((l)=>l.ell(headX,4+jump,7,5,hair));
        } else if (hairStyle === "mohawk") {
          g.stamp((l)=>l.rect(headX-2,0+jump,4,7,hair));
        } else if (hairStyle === "curly") {
          g.stamp((l)=>l.ell(headX,4+jump,6,4,hair));
          g.rect(headX-6,3+jump,3,3,hair);g.rect(headX+3,2+jump,3,3,hair);g.rect(headX-4,0+jump,3,3,hair);
        } else if (hairStyle === "bun") {
          g.stamp((l)=>l.ell(headX,4+jump,6,3,hair));g.stamp((l)=>l.ell(headX+6,2+jump,3,3,hair));
        } else if (hairStyle === "ponytail") {
          g.stamp((l)=>l.ell(headX,4+jump,6,3,hair));g.rect(headX+4,5+jump,3,2,hair);g.rect(headX+6,7+jump,2,5,hair);
        } else if (hairStyle === "spiky") {
          g.stamp((l)=>l.ell(headX,4+jump,6,3,hair));
          g.rect(headX-5,1+jump,3,4,hair);g.rect(headX-1,0+jump,3,5,hair);g.rect(headX+3,1+jump,3,4,hair);
        } else if (hairStyle === "side-part") {
          g.stamp((l)=>l.ell(headX,4+jump,6,3,hair));g.rect(headX-5,3+jump,4,3,hair);g.rect(headX+2,1+jump,4,2,hair);
        } else {
          g.stamp((l)=>l.ell(headX,4+jump,6,3,hair));
          if (hairStyle === "long") { g.rect(headX-6,5+jump,2,8,hair);g.rect(headX+4,5+jump,2,8,hair); }
          if (hairStyle === "fade") { g.rect(headX-5,6+jump,2,2,hair);g.rect(headX+3,6+jump,2,2,hair); }
        }
      }
      if (facingBack) {
        g.rect(headX-4,8+jump,8,2,hairStyle==="bald"?skin:hair);
      } else {
        if (safeDirection === "left") g.rect(headX-3,7+jump,1,2,"#241a16");
        else if (safeDirection === "right") g.rect(headX+2,7+jump,1,2,"#241a16");
        else { g.rect(headX-2,7+jump,1,2,"#241a16");g.rect(headX+2,7+jump,1,2,"#241a16"); }
        if (!sideFacing) g.rect(headX-1,10+jump,2,1,"#71402f");
        else g.rect(safeDirection==="left"?headX-5:headX+3,9+jump,2,2,skin);
      }
      const accessory = appearance.headAccessory || "none";
      if (accessory !== "none" && !facingBack) {
        const accessoryColor = accessory === "gold-headband" ? "#d7ad52" : accessory === "red-headband" ? "#bd3545" : "#3476c5";
        g.rect(headX-6,5+jump,12,2,accessoryColor);
        g.rect(headX-6,5+jump,2,3,accessoryColor);g.rect(headX+4,5+jump,2,3,accessoryColor);
      }

      const baseLeft = appearance.bodyType === "slim" ? 13 : appearance.bodyType === "stocky" ? 9 : 11;
      const baseWidth = appearance.bodyType === "slim" ? 6 : appearance.bodyType === "stocky" ? 14 : 10;
      const bodyLeft = sideFacing ? headX-3 : seated ? baseLeft-1 : baseLeft;
      const bodyWidth = sideFacing ? 7 : seated ? baseWidth+2 : baseWidth;
      const bodyTop = (seated ? 13 : 15)+jump+bodySway;
      if (seated) {
        // A shallow diagonal waist/shoulder line gives the seated torso a
        // relaxed backward lean instead of the old straight standing block.
        g.rect(bodyLeft+1,bodyTop,bodyWidth-1,7,kit);
        g.rect(bodyLeft+3,bodyTop+6,bodyWidth-3,4,kit);
      } else {
        g.stamp((l)=>l.rect(bodyLeft,bodyTop,bodyWidth,10,kit));
      }
      if (facingBack) {
        g.rect(bodyLeft+Math.floor(bodyWidth/2)-1,19+jump+bodySway,3,4,trim);
      } else {
        g.rect(bodyLeft+Math.floor(bodyWidth/2)-2,15+jump+bodySway,4,2,trim);
        g.rect(bodyLeft+Math.floor(bodyWidth/2)-1,17+jump+bodySway,2,5,trim);
      }

      const leftArmX = bodyLeft-3;
      const rightArmX = bodyLeft+bodyWidth;
      const walkingLeftArm = safeMotion === "walking" ? -gait*2 : 0;
      const walkingRightArm = safeMotion === "walking" ? gait*2 : 0;
      const idleFidget = safeMotion === "idle" ? [0,0,-1,0][frame%4] : 0;

      if (safeMotion === "wave") {
        g.stamp((l)=>l.rect(leftArmX,16+jump+idleFidget,3,8,skin));
        const waveLift = [0,-1,-3,-3,-1,0][frame%6];
        g.rect(rightArmX,12+jump+waveLift,3,7,skin);
        g.rect(rightArmX+(frame%2),8+jump+waveLift,4,3,skin);
      } else if (safeMotion === "high-five") {
        g.stamp((l)=>l.rect(leftArmX,16+jump+walkingLeftArm,3,8,skin));
        const highFiveLift = [0,-2,-5,-2][frame%4];
        const raisedX = safeDirection === "left" ? leftArmX-1 : rightArmX+1;
        g.rect(raisedX,12+jump+highFiveLift,3,7,skin);
        g.rect(raisedX+(safeDirection==="left"?-1:1),8+jump+highFiveLift,4,3,skin);
      } else if (safeMotion === "kick") {
        const balance = [0,-1,-2,0,1,0][frame%6];
        g.rect(leftArmX-1,16+jump+balance,3,8,skin);
        g.rect(rightArmX+1,17+jump-balance,3,8,skin);
      } else if (safeMotion === "cheer" || safeMotion === "celebrating") {
        const lift = [0,-2,-4,-2][frame%4];
        g.rect(leftArmX,12+jump+lift,3,7,skin);g.rect(leftArmX-1,8+jump+lift,4,3,skin);
        g.rect(rightArmX,12+jump+lift,3,7,skin);g.rect(rightArmX-1,8+jump+lift,4,3,skin);
      } else if (safeMotion === "dance") {
        const leftLift = [0,-2,-4,-1,0,-1,-3,-1][frame%8];
        const rightLift = [-3,-1,0,-2,-3,-1,0,-2][frame%8];
        g.rect(leftArmX,14+jump+leftLift,3,7,skin);g.rect(leftArmX-1,12+jump+leftLift,4,3,skin);
        g.rect(rightArmX,14+jump+rightLift,3,7,skin);g.rect(rightArmX-1,12+jump+rightLift,4,3,skin);
      } else if (seated) {
        // Reclined Pip-style seat: shoulders lean back and both palms brace
        // against the avatar rim, leaving the hips planted on the icon.
        g.rect(bodyLeft-3,17+jump,3,5,skin);
        g.rect(bodyLeft-5,21+jump,4,2,skin);
        g.rect(bodyLeft-7,23+jump,4,2,skin);
        g.rect(bodyLeft+bodyWidth,17+jump,3,5,skin);
        g.rect(bodyLeft+bodyWidth+2,21+jump,4,2,skin);
        g.rect(bodyLeft+bodyWidth+3,23+jump,4,2,skin);
      } else if (safeMotion === "juggle") {
        const handLift = [0,-1,-2,-1,0,1,0,-1][frame%8];
        g.rect(leftArmX-1,17+jump+handLift,3,7,skin);
        g.rect(rightArmX+1,17+jump-handLift,3,7,skin);
      } else if (safeMotion === "stepover" || safeMotion === "rainbow") {
        const balance = [0,-1,-2,-1,0,1,0,-1][frame%8];
        g.rect(leftArmX-1,15+jump+balance,3,8,skin);
        g.rect(rightArmX+1,15+jump-balance,3,8,skin);
      } else {
        g.stamp((l)=>l.rect(leftArmX,16+jump+walkingLeftArm+idleFidget,3,8,skin));
        g.stamp((l)=>l.rect(rightArmX,16+jump+walkingRightArm-idleFidget,3,8,skin));
      }

      const leftLegX = bodyLeft+1;
      const rightLegX = bodyLeft+bodyWidth-4;
      if (seated) {
        const seatedKick = safeMotion === "juggle" ? [0,0,-1,-2,-1,0,0,0][frame%8] : 0;
        // Shorts sit over the avatar; knees extend forward and slightly apart.
        g.rect(bodyLeft-2,21+jump,bodyWidth+4,3,kit);
        g.rect(bodyLeft-4,23+jump,7,2,skin);
        g.rect(bodyLeft+bodyWidth-3,23+jump,7,2,skin);
        g.rect(bodyLeft-6,25+jump,8,2,skin);
        g.rect(bodyLeft+bodyWidth-2,25+jump+seatedKick,8,2,skin);
        g.rect(bodyLeft-8,28+jump,8,2,boot);
        g.rect(bodyLeft+bodyWidth,28+jump+seatedKick,8,2,boot);
      } else if (safeMotion === "juggle" || safeMotion === "stepover" || safeMotion === "rainbow") {
        const trickLift = safeMotion === "juggle"
          ? [0,-1,-3,-4,-2,0,1,0][frame%8]
          : safeMotion === "stepover" ? [0,-1,-2,-1,0,1,2,1][frame%8]
            : [0,-2,-4,-2,1,3,0,-1][frame%8];
        g.rect(leftLegX,25+jump,3,5,skin);
        g.rect(leftLegX-2,29+jump,5,2,boot);
        g.rect(rightLegX,25+jump+trickLift,3,5,skin);
        g.rect(rightLegX-2,29+jump+trickLift,6,2,boot);
      } else if (safeMotion === "kick") {
        const swing = [0,-1,-2,-4,-2,0][frame%6];
        const kickX = safeDirection === "left" ? leftLegX : rightLegX;
        const plantX = safeDirection === "left" ? rightLegX : leftLegX;
        g.rect(plantX,25+jump,3,5,skin);
        g.rect(plantX-2,29+jump,5,2,boot);
        g.rect(kickX,25+jump+swing,3,5,skin);
        g.rect(kickX-2,29+jump+swing,6,2,boot);
      } else {
        g.rect(leftLegX,25+jump+leftLegStep,3,5,skin);
        g.rect(rightLegX,25+jump+rightLegStep,3,5,skin);
        g.rect(leftLegX-2,29+jump+leftLegStep,5,2,boot);
        g.rect(rightLegX-1,29+jump+rightLegStep,5,2,boot);
      }

      if (["juggle","stepover","rainbow"].includes(safeMotion)) {
        const ballX = safeMotion === "rainbow" ? [25,23,20,17,14,11,8,6][frame%8]
          : safeMotion === "stepover" ? [24,22,20,18,20,22,24,22][frame%8]
            : [25,23,20,17,15,17,20,23][frame%8];
        const ballY = safeMotion === "rainbow" ? [23,17,10,5,7,13,20,24][frame%8]
          : safeMotion === "stepover" ? [27,26,25,27,28,27,26,27][frame%8]
            : [23,18,13,10,12,16,21,24][frame%8];
        g.stamp((l)=>l.ell(ballX,ballY,2,2,"#f5f4ed"));
        g.rect(ballX-1,ballY,3,1,"#26303c");
        g.rect(ballX,ballY-1,1,3,"#26303c");
      }

      const image = new ImageData(N,N);
      for (let i=0;i<layer.d.length;i++) {
        const color=layer.d[i];
        if (!color) continue;
        const [red,green,blue,alpha]=rgba(color);
        image.data[i*4]=red;image.data[i*4+1]=green;image.data[i*4+2]=blue;image.data[i*4+3]=alpha;
      }
      context.clearRect(0,0,N,N);
      context.putImageData(image,0,0);
      if(motionAllowed) animationFrame = window.requestAnimationFrame(drawFrame);
    };
    const onMotionPreferenceChange = (event) => {
      motionAllowed = animated && !event.matches;
      if (!motionAllowed && animationFrame!==null) { window.cancelAnimationFrame(animationFrame); animationFrame=null; }
      if (motionAllowed && animationFrame===null) animationFrame=window.requestAnimationFrame(drawFrame);
      if (!motionAllowed) drawFrame(0);
    };
    motionQuery?.addEventListener?.("change",onMotionPreferenceChange);
    drawFrame();
    return () => { motionQuery?.removeEventListener?.("change",onMotionPreferenceChange); if(animationFrame!==null) window.cancelAnimationFrame(animationFrame); };
  },[appearance.skinTone,appearance.hairStyle,appearance.hairColor,appearance.bodyType,appearance.kitPrimary,appearance.kitSecondary,appearance.bootColor,appearance.headAccessory,safeMotion,safeDirection,animated,pose]);
  return <canvas ref={canvasRef} width="32" height="32" className={"gg-player-sprite"+(animated?" is-animated":"")} role="img" aria-label={"Pixel footballer "+(pose==="seated"?"seated":"standing")+", facing "+safeDirection+", "+safeMotion}/>;
}
function RoomTabs({rooms=[],activeIndex=0,onSelect}) {
  if(rooms.length<2)return null;
  return <div className="gg-room-tabs" role="tablist" aria-label="Facility rooms">
    {rooms.map((room,index)=><button key={room.id||index} type="button" role="tab" aria-selected={activeIndex===index} className={activeIndex===index?"is-active":""} onClick={()=>onSelect(index)}>{room.name||"Room "+(index+1)}</button>)}
  </div>;
}

function WalkableRoomScene({room,appearance,onOpenChat}) {
  const characterRef=useRef(null);
  const walkFrame=useRef(null);
  const idleTimer=useRef(null);
  const lastInput=useRef(0);
  const position=useRef({x:600,y:610});
  const [motion,setMotion]=useState("idle");
  const [direction,setDirection]=useState("down");
  const [scenePose,setScenePose]=useState("standing");
  const [line,setLine]=useState("The room is yours. Tap the floor and I'll take a look around.");
  const [activeItem,setActiveItem]=useState("");
  const interactionTimer=useRef(null);
  const dialogueTimer=useRef(null);
  const dialogueSequence=useRef(0);
  const reduced=typeof window!=="undefined"&&window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const id=String(room?.id||"lounge").toLowerCase();
  const theme=String(room?.theme||"").toLowerCase();
  const training=/training|strength|recovery|indoor-pitch|skills/.test(id);
  const pitch=/pitch|field|stadium|stands/.test(id)||theme==="pitch";
  const trophy=/trophy|gallery|museum|heritage|legend/.test(id);
  const tactics=/tactics|meeting|class|press|academy/.test(id);
  const market=/market|locker|shop/.test(id);
  const station=/station|concourse|tunnel/.test(id);
  const garden=/garden|park|green/.test(id)||theme==="garden";
  const esports=/arena|esports|neon/.test(id);
  const supporters=/supporters|fan|clubhouse/.test(id);
  const hq=/grand-hall|headquarters|club-lounge/.test(id)||theme.includes("gold");
  const accent=training?"#91b77b":pitch?"#9cbb8d":trophy||hq?"#e3c374":market?"#d7a66c":esports?"#8dd9e0":garden?"#8db987":"#d5b77a";
  const playDialogue=(lines,fallback="")=>{
    if(dialogueTimer.current!==null)window.clearTimeout(dialogueTimer.current);
    const sequence=(Array.isArray(lines)?lines:[]).filter((entry)=>typeof entry==="string"&&entry.trim());
    const token=++dialogueSequence.current;
    if(!sequence.length){if(fallback)setLine(fallback);return;}
    let index=0;
    const advance=()=>{
      if(token!==dialogueSequence.current)return;
      setLine(sequence[index]);
      index+=1;
      if(index<sequence.length)dialogueTimer.current=window.setTimeout(advance,1850);
      else dialogueTimer.current=null;
    };
    advance();
  };
  const walkTo=useCallback((x,y,reason="",interaction={pose:"standing",motion:"idle",duration:0})=>{
    lastInput.current=performance.now();
    if(walkFrame.current!==null)window.cancelAnimationFrame(walkFrame.current);
    if(interactionTimer.current!==null)window.clearTimeout(interactionTimer.current);
    if(dialogueTimer.current!==null)window.clearTimeout(dialogueTimer.current);
    dialogueSequence.current+=1;
    const action=interaction||{pose:"standing",motion:"idle",duration:0};
    const from={...position.current};
    const to={x:Math.max(92,Math.min(1108,x)),y:Math.max(525,Math.min(660,y))};
    const dx=to.x-from.x,dy=to.y-from.y,distance=Math.hypot(dx,dy);
    if(reason)setActiveItem(reason);
    setScenePose("standing");
    if(distance<2){
      playDialogue(action.dialogue,reason);
      setScenePose(action.pose||"standing");
      setMotion(action.motion||"idle");
      if(action.duration>0)interactionTimer.current=window.setTimeout(()=>setMotion("idle"),action.duration);
      return;
    }
    setDirection(Math.abs(dx)>Math.abs(dy)?(dx<0?"left":"right"):(dy<0?"up":"down"));
    setMotion("walking");
    const duration=Math.min(1500,Math.max(280,distance*1.05));
    let began=null;
    const frame=(now)=>{
      if(began===null)began=now;
      const t=Math.min(1,(now-began)/duration),eased=1-Math.pow(1-t,3);
      const next={x:from.x+dx*eased,y:from.y+dy*eased};
      position.current=next;
      characterRef.current?.setAttribute("transform","translate("+next.x+" "+next.y+")");
      if(t<1)walkFrame.current=window.requestAnimationFrame(frame);
      else{
        walkFrame.current=null;
        playDialogue(action.dialogue,reason);
        setScenePose(action.pose||"standing");
        setMotion(action.motion||"idle");
        if(action.duration>0)interactionTimer.current=window.setTimeout(()=>setMotion("idle"),action.duration);
      }
    };
    walkFrame.current=window.requestAnimationFrame(frame);
  },[]);
  function handleSceneClick(event){
    if(event.target?.closest?.("[data-room-item]"))return;
    const matrix=event.currentTarget.getScreenCTM?.();
    if(!matrix)return;
    const point=event.currentTarget.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
    const local=point.matrixTransform(matrix.inverse());
    walkTo(local.x,local.y);
  }
  function handleSceneKey(event){
    if(event.key==="Enter"||event.key===" "){
      const item=event.target?.closest?.("[data-room-item]");
      if(item){event.preventDefault();item.click();return;}
    }
    const steps={ArrowLeft:[-56,0],a:[-56,0],ArrowRight:[56,0],d:[56,0],ArrowUp:[0,-28],w:[0,-28],ArrowDown:[0,28],s:[0,28]};
    const step=steps[event.key]||steps[event.key.toLowerCase()];
    if(!step)return;
    event.preventDefault();walkTo(position.current.x+step[0],position.current.y+step[1]);
  }
  useEffect(()=>{
    if(reduced)return undefined;
    let cancelled=false;
    const schedule=()=>{
      idleTimer.current=window.setTimeout(()=>{
        if(cancelled)return;
        if(performance.now()-lastInput.current>8000) {
          if(Math.random()<0.52) {
            const skills=["juggle","stepover","rainbow"];
            const skill=skills[Math.floor(Math.random()*skills.length)];
            setMotion(skill);
            interactionTimer.current=window.setTimeout(()=>setMotion("idle"),skill==="stepover"?1680:skill==="rainbow"?1840:1920);
            lastInput.current=performance.now();
          } else {
            walkTo(185+Math.random()*830,560+Math.random()*76,"Just having a look around.");
          }
        }
        schedule();
      },5200+Math.random()*3400);
    };
    schedule();
    return ()=>{
      cancelled=true;
      if(idleTimer.current!==null)window.clearTimeout(idleTimer.current);
      if(walkFrame.current!==null)window.cancelAnimationFrame(walkFrame.current);
      if(interactionTimer.current!==null)window.clearTimeout(interactionTimer.current);
      if(dialogueTimer.current!==null)window.clearTimeout(dialogueTimer.current);
      dialogueSequence.current+=1;
    };
  },[reduced,room?.id,walkTo]);
  const itemClick=(label,x,y,dialogue)=>event=>{
    event.stopPropagation();
    walkTo(
      x,
      y,
      dialogue||("Let's take a closer look at the "+label.toLowerCase()+"."),
      getRoomInteraction(label),
    );
  };
  return <div className="gg-walkable-room">
    <div className="gg-room-scene-topline"><span>{String(room?.theme||"ORIGINAL GG").replaceAll("-"," ").toUpperCase()}</span><small>CLICK THE FLOOR TO WALK · WASD / ARROWS ALSO WORK</small></div>
    <svg className="gg-room-scene-svg" viewBox="0 0 1200 720" role="img" aria-label={room?.name||"Interactive 2D room"} tabIndex="0" onClick={handleSceneClick} onKeyDown={handleSceneKey}>
      <defs>
        <linearGradient id="gg-room-wall" x1="0" y1="0" x2="0" y2="1"><stop stopColor={hq?"#392a18":esports?"#171b37":garden?"#315a3f":"#354c39"}/><stop offset="1" stopColor={hq?"#151a13":esports?"#111326":garden?"#193424":"#1a2b21"}/></linearGradient>
        <linearGradient id="gg-room-floor" x1="0" y1="0" x2="0" y2="1"><stop stopColor={garden?"#59764a":hq||trophy?"#765a38":"#8c7555"}/><stop offset="1" stopColor={garden?"#304c32":hq||trophy?"#35281f":"#3b4439"}/></linearGradient>
        <linearGradient id="gg-room-glass" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#a8d3d6" stopOpacity=".75"/><stop offset="1" stopColor="#315e5a" stopOpacity=".45"/></linearGradient>
        <radialGradient id="gg-room-glow"><stop stopColor={accent} stopOpacity=".55"/><stop offset="1" stopColor={accent} stopOpacity="0"/></radialGradient>
        <pattern id="gg-room-wall-panel" width="90" height="90" patternUnits="userSpaceOnUse"><path d="M0 0H90V90H0Z M8 8H82V82H8Z" fill="none" stroke={accent} strokeOpacity=".08" strokeWidth="2"/></pattern>
        <pattern id="gg-room-floor-planks" width="120" height="36" patternUnits="userSpaceOnUse"><path d="M0 0H120 M0 35H120 M60 0V35" stroke="#e5d2a2" strokeOpacity=".13" strokeWidth="2"/></pattern>
      </defs>
      <rect width="1200" height="720" fill="#0c1710"/>
      <rect x="40" y="24" width="1120" height="490" rx="9" fill="url(#gg-room-wall)" stroke={accent} strokeWidth="5"/>
      <rect x="55" y="40" width="1090" height="452" fill="url(#gg-room-wall-panel)"/>
      <path d="M40 470H1160V520H40Z" fill={hq?"#4a3020":"#292f25"} stroke={accent} strokeOpacity=".6" strokeWidth="4"/>
      <path d="M40 520L1160 520L1200 720L0 720Z" fill="url(#gg-room-floor)" stroke="#0b100c" strokeWidth="8"/>
      <path d="M40 520L1160 520L1200 720L0 720Z" fill="url(#gg-room-floor-planks)"/>
      <path d="M600 520L600 720 M300 520L190 720 M900 520L1010 720" stroke="#e8d7ae" strokeOpacity=".1" strokeWidth="3"/>
      <path d="M70 560L1130 560 M36 640L1164 640" stroke="#f2dfb2" strokeOpacity=".08" strokeWidth="2"/>
      <ellipse cx="600" cy="475" rx="360" ry="95" fill="url(#gg-room-glow)"/>
      {garden ? <g>
        <rect x="62" y="56" width="1076" height="422" fill="#244e32" opacity=".34"/>
        {[0,1,2,3,4,5,6].map(n=><g key={n} transform={"translate("+(125+n*155)+" "+(125+(n%2)*28)+")"}><path d="M0 86V10" stroke="#73583b" strokeWidth="18"/><circle cy="-8" r="62" fill={n%2?"#3f8950":"#5c9e5d"} stroke="#1b4a2d" strokeWidth="5"/><circle cx="-25" cy="-28" r="20" fill="#70b76c" opacity=".55"/></g>)}
        <path d="M90 445Q600 330 1110 445" fill="none" stroke="#cdb98a" strokeWidth="38"/><path d="M90 445Q600 330 1110 445" fill="none" stroke="#e7d8ae" strokeWidth="3" strokeDasharray="17 15"/>
        <ellipse cx="600" cy="330" rx="105" ry="46" fill="#244d57" stroke="#d7c18c" strokeWidth="8"/><ellipse cx="600" cy="330" rx="75" ry="27" fill="#4b8b92"/><path d="M600 290V250 M581 255H619" stroke="#ddc68f" strokeWidth="8"/>
      </g> : <g>
        <rect x="94" y="78" width="235" height="215" rx="8" fill="#101b15" stroke={accent} strokeWidth="8"/><rect x="110" y="94" width="203" height="183" fill="url(#gg-room-glass)"/><path d="M210 94V277 M110 184H313" stroke="#dfd0a5" strokeOpacity=".7" strokeWidth="7"/>
        <rect x="880" y="78" width="225" height="215" rx="8" fill="#101b15" stroke={accent} strokeWidth="8"/><rect x="896" y="94" width="193" height="183" fill="url(#gg-room-glass)"/><path d="M992 94V277 M896 184H1089" stroke="#dfd0a5" strokeOpacity=".7" strokeWidth="7"/>
        <path d="M62 75V420 M1138 75V420" stroke={accent} strokeOpacity=".35" strokeWidth="8"/>
      </g>}
      {hq && <g>
        <path d="M355 90V430 M845 90V430" stroke="#d2a84e" strokeWidth="28"/><path d="M337 90H372 M827 90H862 M337 430H372 M827 430H862" stroke="#f5db8c" strokeWidth="8"/>
        <rect x="420" y="135" width="360" height="268" rx="5" fill="#1b160f" stroke="#d8b96d" strokeWidth="9"/><path d="M420 135L600 62L780 135Z" fill="#8c2d34" stroke="#dfbe6a" strokeWidth="8"/>
        <path d="M465 151H735V385H465Z" fill="#32231a" stroke="#b08a47" strokeWidth="5"/><path d="M600 151V385" stroke="#e1c477" strokeWidth="8"/>
        <rect x="475" y="166" width="250" height="74" rx="5" fill="#101811" stroke="#caa75d" strokeWidth="4"/>
        <text x="600" y="193" textAnchor="middle" fill="#f0d38c" fontSize="15" fontWeight="900" letterSpacing="1.4">THE PLACE WHERE THE</text>
        <text x="600" y="216" textAnchor="middle" fill="#f0d38c" fontSize="17" fontWeight="950" letterSpacing="1.2">COMMUNITY MEETS.</text>
        <circle cx="585" cy="273" r="8" fill="#efcd78"/><circle cx="615" cy="273" r="8" fill="#efcd78"/>
        <path d="M86 75V440 M110 75V440 M1089 75V440 M1114 75V440" stroke="#8e3436" strokeWidth="14"/>
        <path d="M70 75Q100 145 86 245Q80 360 110 440 M1130 75Q1100 145 1114 245Q1120 360 1090 440" fill="none" stroke="#d9b86a" strokeWidth="12"/>
        <circle cx="600" cy="55" r="24" fill="#e4c679"/><path d="M600 55L555 30L645 30Z" fill="#e4c679"/>
        <g data-room-item role="button" tabIndex="0" onClick={itemClick("club banners",230,590,"The club banners look grand from here.")}><path d="M150 175V90L220 110L150 132 M980 175V90L1050 110L980 132" fill="#9b3038" stroke="#e6c97b" strokeWidth="6"/></g>

        <g data-room-item role="button" tabIndex="0" onClick={itemClick("honours display",600,585,"A lot of history on these walls.")}>
          <rect x="170" y="300" width="210" height="116" rx="8" fill="#5b4028" stroke="#cba75f" strokeWidth="7"/><rect x="188" y="318" width="174" height="78" fill="#182219" stroke="#dfc37f" strokeWidth="4"/>
          {Array.from({length:3},(_,i)=><g key={i} transform={"translate("+(224+i*58)+" 0)"}><path d="M0 378V348L14 336L28 348V378Z" fill="#c79d4b" stroke="#f0d388" strokeWidth="3"/></g>)}
        </g>
        <g data-room-item role="button" tabIndex="0" onClick={itemClick("clubhouse sofas",345,630,"Take a seat. This is the clubhouse.")}>
          <path d="M130 450H355V500H130Z" fill="#8d3438" stroke="#d6b76b" strokeWidth="5"/><path d="M146 435H339V468H146Z" fill="#ad4a4c" stroke="#d6b76b" strokeWidth="4"/><path d="M150 500V516 M335 500V516" stroke="#c7a66c" strokeWidth="10"/>
          <path d="M845 450H1070V500H845Z" fill="#8d3438" stroke="#d6b76b" strokeWidth="5"/><path d="M861 435H1054V468H861Z" fill="#ad4a4c" stroke="#d6b76b" strokeWidth="4"/>
          <path d="M485 470L600 420L715 470L600 520Z" fill="#593f2a" stroke="#dbb96a" strokeWidth="6"/>
        </g>
      </g>}
      {pitch && <g>
        <rect x="362" y="112" width="476" height="290" fill="#285b37" stroke="#e4e8d2" strokeWidth="8"/><path d="M600 112V402 M362 257H838 M480 112V402 M720 112V402" stroke="#e7eddd" strokeWidth="4" opacity=".6"/>
        <ellipse cx="600" cy="257" rx="75" ry="55" fill="none" stroke="#e7eddd" strokeWidth="4"/><rect x="475" y="112" width="250" height="60" fill="none" stroke="#e7eddd" strokeWidth="4"/>
        <path d="M510 400V443 M690 400V443" stroke="#d7c28f" strokeWidth="7"/>

        <g data-room-item role="button" tabIndex="0" onClick={itemClick("match ball",600,620,"Fancy a kickabout?")}>
          <circle cx="600" cy="462" r="18" fill="#f5f0df" stroke="#1d3024" strokeWidth="4"/><path d="M600 445L609 458L603 475L588 470L585 454Z" fill="#1c2a20"/>
        </g>
        <g data-room-item role="button" tabIndex="0" onClick={itemClick("left goal net",405,610,"Pick a corner. Can you find the net?")}>
          <path d="M380 250V210H440V250 M390 250V215 M430 250V215" stroke="#cfc8ac" strokeWidth="5" fill="none"/>
          <path d="M380 210H440L430 250H390Z" fill="#e9efe2" fillOpacity=".08" stroke="#d8e6d6" strokeWidth="2" strokeDasharray="5 4"/>
        </g>
        <g data-room-item role="button" tabIndex="0" onClick={itemClick("right goal net",795,610,"One more shot at goal!")}>
          <path d="M760 250V210H820V250 M770 250V215 M810 250V215" stroke="#cfc8ac" strokeWidth="5" fill="none"/>
          <path d="M760 210H820L810 250H770Z" fill="#e9efe2" fillOpacity=".08" stroke="#d8e6d6" strokeWidth="2" strokeDasharray="5 4"/>
        </g>
        <g data-room-item role="button" tabIndex="0" onClick={itemClick("scoreboard",600,585,"The scoreboard is ready for the next goal.")}>
          <rect x="500" y="70" width="200" height="62" rx="8" fill="#0e1a12" stroke="#d8c37e" strokeWidth="5"/>
          <text x="600" y="96" textAnchor="middle" fill="#f2e5c2" fontSize="12" fontWeight="900">MATCHDAY</text>
          <text x="600" y="119" textAnchor="middle" fill="#90d09a" fontSize="18" fontWeight="950">HOME 0 — 0 AWAY</text>
        </g>
        {training && <g data-room-item role="button" tabIndex="0" onClick={itemClick("training cones",460,610,"Quick feet. Keep the ball close.")}>
          {[0,1,2,3].map((n)=><g key={n} transform={"translate("+(385+n*46)+" 0)"}><path d="M0 450L-13 480H13Z" fill="#df8a3f" stroke="#f0d9a4" strokeWidth="3"/><path d="M-9 470H9" stroke="#fff0c6" strokeWidth="4"/></g>)}
        </g>}
        {training && <g data-room-item role="button" tabIndex="0" onClick={itemClick("agility ladder",740,610,"Fast feet through the ladder. Nice work.")}>
          <path d="M690 440L680 490 M725 440L715 490 M760 440L750 490 M795 440L785 490" stroke="#d9d6c5" strokeWidth="6"/>
          <path d="M682 450L790 450 M678 462L787 462 M675 475L783 475 M672 488L780 488" stroke="#dbbd79" strokeWidth="4"/>
        </g>}
        {training && <g data-room-item role="button" tabIndex="0" onClick={itemClick("football rack",900,610,"Choose a ball and take your next touch.")}>
          <rect x="860" y="440" width="170" height="58" rx="8" fill="#563c28" stroke="#d7bb7b" strokeWidth="5"/>
          {[0,1,2].map((n)=><g key={n} transform={"translate("+(895+n*48)+" 0)"}><circle cy="464" r="13" fill="#f4f0df" stroke="#1d3024" strokeWidth="3"/><path d="M0 452L7 460L4 474L-8 470L-10 458Z" fill="#243327"/></g>)}
        </g>}
      </g>}
      {tactics && <g>
        <rect x="345" y="90" width="510" height="305" rx="9" fill="#18271f" stroke="#c6a767" strokeWidth="10"/>
        <path d="M600 90V395 M345 242H855 M420 90V395 M780 90V395" stroke="#e6e7d6" strokeOpacity=".3" strokeWidth="4"/>
        {Array.from({length:11},(_,i)=><g key={i}><circle cx={420+(i%4)*105} cy={160+Math.floor(i/4)*78} r="18" fill={i%2?"#c35a4e":"#d7bc71"} stroke="#141e16" strokeWidth="6"/></g>)}
        <path d="M375 435H825" stroke="#c7a66a" strokeWidth="12"/>

        <g data-room-item role="button" tabIndex="0" onClick={itemClick("tactics table",600,620,"Let's work on the next formation.")}>
          <path d="M360 445L600 380L840 445L600 520Z" fill="#64472f" stroke="#d8b86d" strokeWidth="7"/><path d="M390 446L600 390L810 446L600 503Z" fill="#a47a48"/>
          <path d="M435 485V520 M765 485V520" stroke="#493323" strokeWidth="13"/>
          {[0,1,2,3].map(i=><g key={i} transform={"translate("+(445+i*205)+" 0)"}><path d="M-32 545V510H32V545Z" fill="#7a3337" stroke="#d4b46c" strokeWidth="4"/><path d="M-25 510V485H25V510Z" fill="#ac4a4d"/></g>)}
        </g>
      </g>}
      {training && !pitch && <g>
        <rect x="190" y="128" width="820" height="260" fill="#18221d" stroke="#9cba89" strokeWidth="9"/>
        {[0,1,2,3,4,5,6,7].map(i=><g key={i} transform={"translate("+(235+i*105)+" 0)"}><path d="M0 370V170H60V370" fill="none" stroke="#8c9b89" strokeWidth="13"/><circle cx="30" cy="165" r="22" fill="#d3b56d"/><path d="M-10 205H70" stroke="#d3b56d" strokeWidth="10"/></g>)}
        <rect x="395" y="405" width="410" height="28" rx="8" fill="#8b6844"/><circle cx="485" cy="420" r="35" fill="#222824"/><circle cx="715" cy="420" r="35" fill="#222824"/>

        <g data-room-item role="button" tabIndex="0" onClick={itemClick("weight rack",390,610,"Start with a light set. Warm up first.")}>
          <path d="M160 410V250 M170 410V250 M145 275H185 M145 300H185 M145 325H185 M145 350H185" stroke="#b8c2ad" strokeWidth="10"/><rect x="130" y="270" width="28" height="70" rx="6" fill="#5a6261"/><rect x="173" y="270" width="28" height="70" rx="6" fill="#5a6261"/>
        </g>
        <g data-room-item role="button" tabIndex="0" onClick={itemClick("training bench",795,610,"One good rep at a time.")}>
          <path d="M820 420L1025 360" stroke="#8b6844" strokeWidth="18" strokeLinecap="round"/><path d="M850 413V450 M995 370V408" stroke="#58685a" strokeWidth="11"/><circle cx="820" cy="420" r="20" fill="#202824" stroke="#d2b36d" strokeWidth="5"/><circle cx="1025" cy="360" r="20" fill="#202824" stroke="#d2b36d" strokeWidth="5"/>
        </g>
      </g>}
      {trophy && <g>
        <rect x="300" y="100" width="600" height="300" rx="8" fill="#142017" stroke="#d6b76b" strokeWidth="10"/>
        {Array.from({length:7},(_,i)=><g key={i} transform={"translate("+(350+i*82)+" 0)"}><path d="M0 205L-26 175L-20 122L20 122L26 175Z" fill={i%2?"#d9b86a":"#ad8744"} stroke="#f5d889" strokeWidth="4"/><path d="M-20 142H-53Q-51 185 -5 184 M20 142H53Q51 185 5 184" fill="none" stroke="#e6c878" strokeWidth="10"/><path d="M-10 205H10L18 242H-18Z" fill="#a98242"/><rect x="-35" y="242" width="70" height="13" fill="#563c23"/></g>)}
        <path d="M324 300H876" stroke="#d8bc76" strokeWidth="7"/>

        <g data-room-item role="button" tabIndex="0" onClick={itemClick("trophy cabinet",900,610,"Some legends are remembered in silverware.")}>
          <rect x="165" y="170" width="120" height="210" fill="#18231b" stroke="#d8bd76" strokeWidth="7"/><rect x="178" y="184" width="94" height="170" fill="#334638" stroke="#977a44" strokeWidth="4"/>
          {[0,1,2].map(i=><g key={i} transform={"translate(0 "+(215+i*55)+")"}><path d="M224 0L205 -13L208 16L224 31L240 16L243 -13Z" fill="#d9b96e"/><path d="M205 -5L190 -5Q190 18 214 18 M243 -5L258 -5Q258 18 234 18" fill="none" stroke="#e6c878" strokeWidth="5"/></g>)}
        </g>
        <g data-room-item role="button" tabIndex="0" onClick={itemClick("honours plaques",900,630,"Take a moment to remember the big wins.")}>
          <rect x="915" y="170" width="120" height="210" fill="#17241b" stroke="#d8bd76" strokeWidth="7"/>
          {[0,1,2].map(i=><g key={i} transform={"translate(0 "+(205+i*58)+")"}><rect x="930" y="0" width="90" height="40" rx="4" fill="#b38b45" stroke="#f0d88e" strokeWidth="3"/><path d="M946 10H1004 M946 20H990 M946 30H997" stroke="#6b4e28" strokeWidth="3"/></g>)}
        </g>
      </g>}
      {market && <g>
        <rect x="165" y="300" width="870" height="115" rx="10" fill="#513a29" stroke="#e2c47c" strokeWidth="7"/>
        {[0,1,2,3].map(i=><g key={i} transform={"translate("+(260+i*210)+" 0)"}><path d="M-68 295V150H68V295Z" fill="#17221a" stroke="#d9bf7d" strokeWidth="7"/><path d="M-65 148L0 115L65 148" fill="#9c3137"/><circle cy="192" r="28" fill={["#c74447","#dfc579","#4277a8","#6b5597"][i]} stroke="#f1e5c8" strokeWidth="5"/><path d="M-20 238H20" stroke="#e5cc8b" strokeWidth="7"/></g>)}

        <g data-room-item role="button" tabIndex="0" onClick={itemClick("kit counter",600,610,"Try a new kit colour. Make it yours.")}>
          <path d="M210 440H990V505H210Z" fill="#5b3e28" stroke="#dfc27a" strokeWidth="6"/><path d="M225 450H975V485H225Z" fill="#a77b47"/>
          <path d="M360 455L385 448L410 455L402 485H368Z" fill="#c33f45" stroke="#f0d6a0" strokeWidth="3"/><path d="M575 455L600 448L625 455L617 485H583Z" fill="#3f73ab" stroke="#f0d6a0" strokeWidth="3"/><path d="M790 455L815 448L840 455L832 485H798Z" fill="#d3b86c" stroke="#f0d6a0" strokeWidth="3"/>
        </g>
      </g>}
      {esports && <g>
        <rect x="155" y="86" width="890" height="330" rx="18" fill="#14182b" stroke="#73cdd3" strokeWidth="8"/>
        {[0,1,2].map(i=><g key={i} transform={"translate("+(245+i*260)+" 0)"}><rect x="-100" y="130" width="200" height="165" rx="12" fill="#25264b" stroke="#d4bd77" strokeWidth="6"/><rect x="-78" y="151" width="156" height="103" fill="#5159a0"/><path d="M0 151V254 M-78 203H78" stroke="#81d6d6" strokeWidth="5"/><circle cy="203" r="21" fill="#e2bf72"/></g>)}

        <g data-room-item role="button" tabIndex="0" onClick={itemClick("gaming station",600,620,"Queue up and show them your skills.")}>
          {[0,1,2].map(i=><g key={i} transform={"translate("+(255+i*345)+" 0)"}><path d="M-115 420V385H115V420Z" fill="#32385f" stroke="#72d0d3" strokeWidth="5"/><rect x="-82" y="350" width="164" height="55" rx="7" fill="#15192d" stroke="#d4b66d" strokeWidth="5"/><path d="M-63 368H63 M-63 382H20" stroke="#86d8d7" strokeWidth="4"/><circle cy="438" r="23" fill="#26283b" stroke="#c7b16e" strokeWidth="4"/></g>)}
        </g>
      </g>}
      {station && <g>
        <rect x="260" y="110" width="680" height="260" rx="8" fill="#19231d" stroke="#d0ba82" strokeWidth="8"/><rect x="325" y="150" width="550" height="72" rx="6" fill="#101a15" stroke="#e1cb83" strokeWidth="5"/>
        <text x="600" y="195" textAnchor="middle" fill="#f0d891" fontSize="30" fontWeight="900">MATCHDAY · DEPARTURES</text>
        {[0,1,2].map(i=><g key={i} transform={"translate("+(400+i*190)+" 0)"}><rect x="-45" y="270" width="90" height="110" fill="#36473b" stroke="#e1c37a" strokeWidth="5"/><rect x="-24" y="285" width="48" height="65" fill="#8cb0ab"/></g>)}

        <g data-room-item role="button" tabIndex="0" onClick={itemClick("ticket gates",600,620,"The next Matchday is boarding.")}>
          {[0,1,2,3].map(i=><g key={i} transform={"translate("+(390+i*145)+" 0)"}><path d="M-32 450V365H32V450Z" fill="#384b40" stroke="#d7c17f" strokeWidth="5"/><path d="M-32 375L-77 348 M32 375L77 348" stroke="#d7c17f" strokeWidth="10"/><rect x="-18" y="385" width="36" height="14" fill="#9ac2b3"/><circle cy="420" r="7" fill="#e2c16d"/></g>)}
        </g>
      </g>}
      {supporters && <g>
        <path d="M160 170H1040V395H160Z" fill="#38202a" stroke="#d6b56d" strokeWidth="8"/><path d="M190 198H1010V370H190Z" fill="#1a281f" stroke="#9f343b" strokeWidth="5"/>
        {[0,1,2,3,4].map(i=><g key={i} transform={"translate("+(275+i*165)+" 0)"}><path d="M0 200V95L72 118L0 140Z" fill={i%2?"#d0b468":"#a53840"} stroke="#efd89a" strokeWidth="4"/><circle cx="26" cy="155" r="10" fill="#f0d58f"/></g>)}
        <rect x="395" y="405" width="410" height="32" fill="#5b3a28" stroke="#d8b96d" strokeWidth="5"/><path d="M425 439V476 M775 439V476" stroke="#d8b96d" strokeWidth="10"/>
        <g data-room-item role="button" tabIndex="0" onClick={itemClick("supporter banners",600,610,"Let the whole street hear us.")}><path d="M175 440H1025" stroke="#d1b978" strokeWidth="12"/><path d="M205 430L245 395L285 430 M915 430L955 395L995 430" fill="none" stroke="#e8d59a" strokeWidth="8"/></g>
      </g>}
      {!garden&&!pitch&&!training&&!trophy&&!tactics&&!market&&!esports&&!station&&!supporters&&!hq && <g>
        <rect x="260" y="135" width="680" height="275" rx="10" fill="#1b281f" stroke={accent} strokeWidth="8"/><path d="M330 183H870 M330 355H870" stroke={accent} strokeOpacity=".4" strokeWidth="6"/>
        <rect x="465" y="240" width="270" height="92" rx="10" fill="#74553b" stroke="#dfc582" strokeWidth="7"/><path d="M480 260H720 M480 303H720" stroke="#bf9b66" strokeWidth="7"/>
        <rect x="360" y="380" width="480" height="18" fill="#94744d"/>
      </g>}
      <g opacity=".8"><path d="M82 44V104 M1118 44V104" stroke={accent} strokeWidth="5"/><path d="M82 44L112 62L82 80Z M1118 44L1088 62L1118 80Z" fill={accent}/><circle cx="600" cy="48" r="16" fill={accent}/><circle cx="600" cy="48" r="7" fill="#fff0bf"/></g>
      <g ref={characterRef} className="gg-room-character" transform="translate(600 610)" pointerEvents="none">
        <ellipse cx="0" cy="3" rx="26" ry="9" fill="#08110b" opacity=".55"/>
        <foreignObject x="-29" y="-78" width="58" height="74"><div xmlns="http://www.w3.org/1999/xhtml" className="gg-room-character-sprite"><PlayerSprite appearance={appearance||{}} motion={motion} direction={direction} animated pose={scenePose}/></div></foreignObject>
      </g>
    </svg>
    <div className="gg-room-character-speech" role="status" aria-live="polite" data-testid="room-character-dialogue"><p>{line}</p></div>
    <div className="gg-room-bottomline">{hq&&<strong className="gg-room-feature-motto">THE PLACE WHERE THE COMMUNITY MEETS.</strong>}<span>{activeItem||room?.name||"Explore the room"}</span>{onOpenChat&&(/grand-hall|club-lounge|supporters|fan|meeting/.test(id))&&<button type="button" onClick={onOpenChat}>Open community chat</button>}</div>
  </div>;
}

function Building({ kind }) {
  const colors = {hq:"#c69a45",stadium:"#758b83",training:"#668b69",market:"#b78b59",park:"#4d8057",club:"#788477",home:"#a68b70",academy:"#7b8f76",plaza:"#a89a78",plot:"#9c8e6d",museum:"#a88a57",transit:"#82928d","fan-zone":"#a64c58",esports:"#7456a8","community-pitch":"#4d9861"};
  return <svg viewBox="0 0 180 125" width="180" height="125" aria-hidden="true">
    <path d="M12 91 L89 117 L168 87 L89 60Z" fill="#1b2923" opacity=".3"/>
    <path d="M25 57 L89 25 L155 54 L90 86Z" fill={colors[kind]||"#788477"} stroke="#1b3027" strokeWidth="3"/>
    <path d="M25 57 L90 86 L90 111 L25 82Z" fill="#34483e" stroke="#1b3027" strokeWidth="2"/>
    <path d="M90 86 L155 54 L155 79 L90 111Z" fill="#253a31" stroke="#1b3027" strokeWidth="2"/>
    <path d="M49 53 L89 33 L132 53 L90 73Z" fill="#d4b36a" opacity=".42"/>
    <path d="M79 82 L101 73 L101 108 L79 117Z" fill="#17251f"/>
    <path d="M25 57L90 86L155 54" fill="none" stroke="#f1db9c" strokeOpacity=".65" strokeWidth="2"/>
    <path d="M32 61L90 88L148 59" fill="none" stroke="#101b14" strokeOpacity=".35" strokeWidth="3"/>
    <path d="M37 66L57 75L57 91L37 82Z" fill="#8ab5a6" stroke="#18291e" strokeWidth="3"/>
    <path d="M121 76L142 66L142 83L121 93Z" fill="#86a9a0" stroke="#18291e" strokeWidth="3"/>
    <path d="M82 85L99 78L99 109L82 117Z" fill="#523a27" stroke="#d8b66c" strokeWidth="2"/>
    <circle cx="96" cy="97" r="2" fill="#efd98c"/>
    <path d="M25 82L90 111L155 79" fill="none" stroke="#d8c18c" strokeWidth="3" opacity=".8"/>
    <path d="M18 91L90 124L162 89" fill="none" stroke="#24382b" strokeWidth="6"/>
    <path d="M40 51L89 27L139 50" fill="none" stroke="#f0d38c" strokeWidth="3" opacity=".65"/>
    <path d="M58 50L87 36 M69 56L99 42 M104 62L132 48" stroke="#fff0bf" strokeOpacity=".32" strokeWidth="2"/>
    <g fill="#f2d38b" stroke="#4a3925" strokeWidth="2"><circle cx="34" cy="60" r="3"/><circle cx="145" cy="56" r="3"/></g>
    {kind==="hq" && <>
      <path d="M65 43 L89 5 L114 44 L90 58Z" fill="#d9b45d" stroke="#674c25" strokeWidth="3"/>
      <path d="M79 34 L89 19 L100 35 L90 42Z" fill="#f3d78e"/>
      <path d="M86 8 L89 0 L93 8" fill="none" stroke="#f4dc9b" strokeWidth="3"/>
      <path d="M89 48 L89 72" stroke="#f4d88e" strokeWidth="3"/>
      <path d="M54 46 L54 26 L64 31 L64 41 M115 45 L115 24 L125 29 L125 40" fill="#b23b36" stroke="#e4c16c" strokeWidth="2"/>
      <rect x="84" y="88" width="12" height="22" fill="#d6b36a"/>
    </>}
    {kind==="stadium" && <>
      <path d="M22 55 Q88 -2 158 52 L151 66 Q88 25 29 68Z" fill="#c1c8b3" stroke="#273b30" strokeWidth="3"/>
      <path d="M35 55 Q88 13 145 53" fill="none" stroke="#e7e8d9" strokeWidth="5"/>
      <path d="M44 49 L44 61 M58 40 L58 54 M73 34 L73 48 M89 30 L89 44 M105 33 L105 47 M121 39 L121 53 M136 46 L136 59" stroke="#e0d5b5" strokeWidth="3"/>
      <path d="M64 58 L90 46 L117 58 L90 70Z" fill="#3b8750" stroke="#e6e6d5" strokeWidth="2"/>
      <path d="M90 46 L90 70 M64 58 L117 58" stroke="#e6e6d5" strokeWidth="1.5"/>
      <rect x="78" y="9" width="22" height="9" rx="2" fill="#202c26" stroke="#e4c16c" strokeWidth="2"/>
    </>}
    {kind==="fan-zone" && <g><path d="M42 54 L42 23 L137 23 L137 54" fill="#263b30" stroke="#d7bb76" strokeWidth="4"/><path d="M50 27 L70 27 L70 48 L50 48Z" fill="#b53d49"/><path d="M79 27 L99 27 L99 48 L79 48Z" fill="#e0c36f"/><path d="M108 27 L129 27 L129 48 L108 48Z" fill="#3f77b5"/><path d="M36 17 L89 0 L143 17" fill="none" stroke="#e3c77f" strokeWidth="4"/></g>}
    {kind==="esports" && <g><path d="M39 54 L39 20 L141 20 L141 54Z" fill="#202a48" stroke="#d4b66d" strokeWidth="4"/><rect x="54" y="28" width="72" height="30" rx="3" fill="#4c4d9a" stroke="#8bd8df" strokeWidth="3"/><path d="M90 28 L90 58 M54 43 L126 43" stroke="#9bd7df" strokeWidth="2"/><circle cx="90" cy="43" r="8" fill="#e2bd6c"/></g>}
    {kind==="community-pitch" && <g><path d="M39 57 L89 34 L140 57 L90 80Z" fill="#43874d" stroke="#e4e8d4" strokeWidth="3"/><path d="M90 34 L90 80 M39 57 L140 57" stroke="#e4e8d4" strokeWidth="2"/><path d="M68 50 L68 64 L80 64 L80 50 M101 50 L101 64 L113 64 L113 50" fill="none" stroke="#f1e8d3" strokeWidth="2"/></g>}
    {kind==="training" && <>
      <path d="M50 49 L50 28 L126 28 L126 48" fill="none" stroke="#e2e6d8" strokeWidth="5"/>
      <path d="M59 30 L59 43 M117 30 L117 43 M59 30 L117 30" stroke="#e2c67e" strokeWidth="3"/>
      <path d="M57 59 L89 44 L124 60 L90 77Z" fill="#3e8a4f" stroke="#d6e0c8" strokeWidth="2"/>
      <path d="M90 44 L90 77 M57 59 L124 60" stroke="#d6e0c8" strokeWidth="1.5"/>
      <circle cx="90" cy="60" r="5" fill="none" stroke="#d6e0c8" strokeWidth="1.5"/>
    </>}
    {kind==="club" && <>
      <path d="M46 45 L46 17 L48 17 L48 45" fill="#cbb889"/>
      <path d="M49 18 L70 22 L49 29Z" fill="#d7ad52" stroke="#332c20" strokeWidth="1.5"/>
      <path d="M112 54 L112 39 L138 39 L138 54" fill="#3e8051" stroke="#1c3024" strokeWidth="2"/>
      <path d="M119 42 L131 42 M125 39 L125 53" stroke="#e8e3d2" strokeWidth="2"/>
    </>}
    {kind==="home" && <>
      <path d="M42 55 L88 23 L137 54 L90 80Z" fill="#9a6249" stroke="#2c2923" strokeWidth="3"/>
      <path d="M42 55 L42 70 L90 96 L90 80Z" fill="#6c4d3a"/>
      <path d="M90 80 L137 54 L137 70 L90 96Z" fill="#5a4536"/>
      <rect x="58" y="62" width="10" height="10" fill="#e8d18e"/><rect x="113" y="65" width="10" height="10" fill="#e8d18e"/>
      <path d="M82 78 L98 70 L98 94 L82 102Z" fill="#2a211b"/>
    </>}
    {kind==="academy" && <>
      <path d="M57 40 L57 15 L122 15 L122 40" fill="#82917d" stroke="#1d3025" strokeWidth="3"/>
      <path d="M80 15 L90 2 L100 15" fill="#d6b56e" stroke="#3d3928" strokeWidth="2"/>
      <path d="M90 4 L90 -5" stroke="#d6b56e" strokeWidth="2"/>
      <path d="M91 -4 L108 0 L91 7Z" fill="#a93d37"/>
      <rect x="66" y="48" width="13" height="10" fill="#e6d69d"/><rect x="101" y="48" width="13" height="10" fill="#e6d69d"/>
    </>}
    {kind==="museum" && <>
      <path d="M48 48 L90 15 L132 48Z" fill="#d6bd83" stroke="#51442f" strokeWidth="3"/>
      <path d="M54 49 L126 49 L126 76 L54 76Z" fill="#d5c39a" stroke="#51442f" strokeWidth="2"/>
      {[64,82,100,118].map((x)=><path key={x} d={"M"+x+" 51 L"+x+" 73"} stroke="#776345" strokeWidth="5"/>)}
      <path d="M46 78 L134 78 L134 85 L46 85Z" fill="#796344" stroke="#403626" strokeWidth="2"/>
      <path d="M76 85 L104 85 L104 109 L76 109Z" fill="#26372d" stroke="#e0c48a" strokeWidth="2"/>
      <circle cx="90" cy="38" r="7" fill="#a83f35" stroke="#e5c982" strokeWidth="2"/>
    </>}
    {kind==="transit" && <>
      <path d="M42 55 L90 22 L138 55 L90 78Z" fill="#82928d" stroke="#26382f" strokeWidth="3"/>
      <path d="M49 56 L49 77 L90 100 L90 78Z" fill="#526a60" stroke="#26382f" strokeWidth="2"/>
      <path d="M90 78 L138 55 L138 77 L90 100Z" fill="#3c564b" stroke="#26382f" strokeWidth="2"/>
      <rect x="67" y="47" width="46" height="26" rx="3" fill="#20332a" stroke="#e2c47f" strokeWidth="3"/>
      <circle cx="90" cy="60" r="9" fill="#d8c18a"/><path d="M90 53 L90 60 L96 63" stroke="#354437" strokeWidth="2" fill="none"/>
      <path d="M54 80 L72 90 M108 90 L128 80" stroke="#d4c69f" strokeWidth="3"/>
    </>}
    {kind==="market" && <>
      <path d="M50 43 L129 43 L137 57 L44 57Z" fill="#d8c49a" stroke="#382e22" strokeWidth="2"/>
      <path d="M49 44 L65 44 L65 56 L44 56Z M81 44 L97 44 L97 56 L81 56Z M113 44 L129 44 L137 56 L113 56Z" fill="#b64a3f"/>
      <path d="M57 59 L57 72 M121 59 L121 72" stroke="#e4d6b2" strokeWidth="3"/>
    </>}
    {kind==="plot" && <><path d="M38 73 L90 49 L142 73 L90 99Z" fill="#907d5d" stroke="#d8c28d" strokeWidth="3" strokeDasharray="7 5"/><path d="M48 70 L48 38 M132 70 L132 38 M48 38 L132 38" stroke="#d8c28d" strokeWidth="4"/><path d="M88 39 L88 13 L126 13 L126 42Z" fill="#26382b" stroke="#d8c28d" strokeWidth="3"/><text x="107" y="31" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#f0d58c">PLOT</text></>}
    {kind==="plaza" && <>
      <path d="M48 62 L90 42 L132 62 L90 83Z" fill="#b4a789" stroke="#4b4a3d" strokeWidth="2"/>
      <ellipse cx="90" cy="60" rx="16" ry="9" fill="#5a9a9c" stroke="#e4d5a9" strokeWidth="2"/>
      <path d="M90 51 L90 38 M84 39 L96 39" stroke="#e6d8b4" strokeWidth="3"/>
      <path d="M54 76 L69 83 M112 82 L127 75" stroke="#6b5237" strokeWidth="5"/>
      <path d="M68 52 L68 37 L83 41 L83 49 M113 50 L113 35 L128 39 L128 47" fill="#d8c99e" stroke="#423b2b" strokeWidth="2"/>
    </>}
    {kind==="park" && <>
      <path d="M52 68 L52 44 M80 67 L80 38 M117 67 L117 43" stroke="#735538" strokeWidth="6"/>
      <circle cx="52" cy="38" r="18" fill="#55945b" stroke="#264a31" strokeWidth="2"/>
      <circle cx="80" cy="31" r="21" fill="#3e8050" stroke="#264a31" strokeWidth="2"/>
      <circle cx="117" cy="37" r="17" fill="#5c9b5d" stroke="#264a31" strokeWidth="2"/>
      <path d="M61 80 L104 80" stroke="#d5c8a1" strokeWidth="5"/>
    </>}
  </svg>;
}

function initialLocalAvatar(playerUid,playerName="") {
  const fallback={displayName:playerName||"",appearance:{skinTone:"medium",bodyType:"athletic",hairStyle:"short",hairColor:"black",kitPrimary:"black",kitSecondary:"gold",bootColor:"white",headAccessory:"none"}};
  try {
    const stored=JSON.parse(window.localStorage.getItem("gg-v4-local-avatar:"+(playerUid||"visitor"))||"null");
    if(stored&&typeof stored==="object")return {...fallback,...stored,appearance:{...fallback.appearance,...stored.appearance}};
  } catch { /* Use the account name and default kit when local storage is unavailable. */ }
  return fallback;
}

function initialVisitorPosition(playerUid) {
  try {
    const saved = JSON.parse(window.localStorage.getItem("gg-v4-world-position:" + (playerUid || "visitor")) || "null");
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      return { x: Math.max(30, Math.min(1770, saved.x)), y: Math.max(30, Math.min(1170, saved.y)) };
    }
  } catch { /* A local visitor starts at the city plaza when storage is unavailable. */ }
  return { x: 880, y: 700 };
}

export default function OriginalGGWorld({ onExit, onOpenChat, playerName = "Your player", playerUid = "" }) {
  const [data,setData] = useState(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [selected,setSelected] = useState(null);
  const [facility,setFacility] = useState(null);
  const [interior,setInterior] = useState(null);
  const [activeRoomIndex,setActiveRoomIndex] = useState(0);
  const [activeFacilityRoom,setActiveFacilityRoom] = useState(0);
  const [selectedPlayer,setSelectedPlayer] = useState(null);
  const [residenceAccessOpen,setResidenceAccessOpen] = useState(false);
  const [activeLocationId,setActiveLocationId] = useState("city-plaza");
  const [interiorLoading,setInteriorLoading] = useState(false);
  const [avatar,setAvatar] = useState(()=>initialLocalAvatar(playerUid,playerName));
  const [training,setTraining] = useState(emptyTraining);
  const [exerciseNames,setExerciseNames] = useState(()=>{
    try {
      const stored=JSON.parse(window.localStorage.getItem("gg-v4-training-labels")||"{}");
      return stored&&typeof stored==="object" ? {...Object.fromEntries(exercises),...stored} : Object.fromEntries(exercises);
    } catch { return Object.fromEntries(exercises); }
  });
  const [duration,setDuration] = useState("900");
  const [saving,setSaving] = useState(false);
  const [notice,setNotice] = useState("");
  const [tutorialStep,setTutorialStep] = useState(0);
  const [tutorialClosed,setTutorialClosed] = useState(false);
  const [scale,setScale] = useState(.84);
  const [playerPosition,setPlayerPosition] = useState(()=>initialVisitorPosition(playerUid));
  const [characterMotion,setCharacterMotion] = useState("idle");
  const [characterDirection,setCharacterDirection] = useState("down");
  const motionTimer = useRef(null);
  const idleSkillTimer = useRef(null);
  const idleSkillReturnTimer = useRef(null);
  const [playerMotions,setPlayerMotions] = useState({});
  const playerMotionTimers = useRef(new Map());
  const playerPositionRef = useRef(initialVisitorPosition(playerUid));
  const playerMarkerRef = useRef(null);
  const [offset,setOffset] = useState({x:0,y:0});
  const [drag,setDrag] = useState(null);
  const mapGestureMoved = useRef(false);
  const walkFrame = useRef(null);
  const pointers = useRef(new Map());
  const pinch = useRef(null);
  const mapViewportRef = useRef(null);
  const dragVelocity = useRef({vx:0,vy:0,lastX:0,lastY:0,lastAt:0});
  const inertiaFrame = useRef(null);

  async function load() {
    setLoading(true); setError("");
    try {
      const result = await api("/world/bootstrap");
      setData(result);
      if (result.avatar) setAvatar(result.avatar);
      const ownPresence = result.presence?.find((item) => item.playerId === result.playerId);
      if (ownPresence) setPlayerPosition({x:ownPresence.x,y:ownPresence.y});
    } catch (cause) { setError(cause.message || "The city could not load."); }
    finally { setLoading(false); }
  }
  useEffect(() => () => { if(inertiaFrame.current)window.cancelAnimationFrame(inertiaFrame.current); }, []);
  useEffect(()=>{
    try { window.localStorage.setItem("gg-v4-training-labels",JSON.stringify(exerciseNames)); }
    catch { /* Browser storage can be disabled; labels remain editable for this session. */ }
  },[exerciseNames]);
  useEffect(() => {
    let cancelled = false;
    api("/world/bootstrap").then((result) => {
      if (cancelled) return;
      setData(result);
      if (result.avatar) setAvatar(result.avatar);
      const ownPresence = result.presence?.find((item) => item.playerId === result.playerId);
      if (ownPresence && Number.isFinite(ownPresence.x) && Number.isFinite(ownPresence.y)) {
        const savedPosition = { x: ownPresence.x, y: ownPresence.y };
        playerPositionRef.current = savedPosition;
        setPlayerPosition(savedPosition);
      }
    }).catch((cause) => {
      if (!cancelled) setError(cause.message || "The city could not load.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);
  const hasAvatar = Boolean(data?.avatar);
  const playCharacterMotion = useCallback((playerId,motion) => {
    const playerKey=String(playerId||"");
    const nextMotion=normalizeCharacterMotion(motion);
    const duration=getCharacterMotionDuration(nextMotion);
    if(!playerKey||duration===null)return;
    if(playerKey===String(data?.playerId||"")){
      if(idleSkillReturnTimer.current)window.clearTimeout(idleSkillReturnTimer.current);
      setCharacterMotion(nextMotion);
      if(motionTimer.current)window.clearTimeout(motionTimer.current);
      motionTimer.current=window.setTimeout(()=>setCharacterMotion("idle"),duration);
      return;
    }
    setPlayerMotions((current)=>({...current,[playerKey]:nextMotion}));
    const previous=playerMotionTimers.current.get(playerKey);
    if(previous)window.clearTimeout(previous);
    const timer=window.setTimeout(()=>{
      setPlayerMotions((current)=>{
        if(current[playerKey]!==nextMotion)return current;
        const next={...current};
        delete next[playerKey];
        return next;
      });
      playerMotionTimers.current.delete(playerKey);
    },duration);
    playerMotionTimers.current.set(playerKey,timer);
  },[data?.playerId]);
  const onWorldRealtime = useCallback(({type,payload}) => {
    if(type==="presence:update" && payload?.playerId) {
      setData((current)=> {
        if(!current)return current;
        const before=current.presence||[];
        const next=before.filter((item)=>item.playerId!==payload.playerId);
        return {...current,presence:[...next,payload].slice(-100)};
      });
    }
    if(type==="social:interaction" && payload?.type){
      playCharacterMotion(payload.fromPlayerId,payload.type);
      playCharacterMotion(payload.toPlayerId,payload.type);
    }
  },[playCharacterMotion]);
  const celebrateAfterVerifiedRun=useCallback(()=>playCharacterMotion(data?.playerId,"celebrating"),[playCharacterMotion,data?.playerId]);
  useOriginalGGRealtime("world",onWorldRealtime,Boolean(data?.playerId));
  useEffect(()=>{
    playerPositionRef.current=playerPosition;
    playerMarkerRef.current?.setAttribute("transform","translate("+playerPosition.x+" "+playerPosition.y+") scale(.6 1)");
    try { window.localStorage.setItem("gg-v4-world-position:"+(playerUid||"visitor"),JSON.stringify(playerPosition)); } catch { /* Position remains available for this visit. */ }
  },[playerPosition,playerUid]);
  useEffect(() => {
    if (!hasAvatar) return;
    const heartbeat = () => api("/world/presence",{method:"POST",body:{locationId:activeLocationId,...playerPositionRef.current,direction:characterDirection}}).catch(()=>{});
    heartbeat();
    const timer=window.setInterval(heartbeat,4500);
    return ()=>window.clearInterval(timer);
  },[hasAvatar,activeLocationId,characterDirection]);

  useEffect(() => {
    if (!hasAvatar || facility || selected || loading || characterMotion !== "idle" ||
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    idleSkillTimer.current=window.setTimeout(() => {
      const skills=["juggle","stepover","rainbow"];
      const skill=skills[Math.floor(Math.random()*skills.length)];
      const duration=skill==="stepover"?1680:skill==="rainbow"?1840:1920;
      setCharacterMotion(skill);
      idleSkillReturnTimer.current=window.setTimeout(()=>setCharacterMotion("idle"),duration);
    },4800+Math.random()*3600);
    return () => {
      if(idleSkillTimer.current)window.clearTimeout(idleSkillTimer.current);
      idleSkillTimer.current=null;
    };
  },[hasAvatar,facility,selected,loading,characterMotion]);

  useEffect(()=>()=> {
    if(idleSkillTimer.current)window.clearTimeout(idleSkillTimer.current);
    if(idleSkillReturnTimer.current)window.clearTimeout(idleSkillReturnTimer.current);
  },[]);
  useEffect(()=>()=>{
    if(walkFrame.current)window.cancelAnimationFrame(walkFrame.current);
    if(motionTimer.current)window.clearTimeout(motionTimer.current);
    for(const timer of playerMotionTimers.current.values())window.clearTimeout(timer);
    playerMotionTimers.current.clear();
  },[]);
  const appearance = avatar.appearance || {};
  const residenceMarkers = [...(data?.residences || []), ...(data?.residence ? [data.residence] : [])].filter((home,index,all)=>all.findIndex((item)=>item.ownerPlayerId===home.ownerPlayerId)===index).map((home)=>({...home,id:"home-"+home.ownerPlayerId,kind:"residence",description:home.ownerPlayerId===data.playerId?"Your home · manage visitors":home.privacy==="public"?"Public player home · open to visitors":"Invited player home"}));
  const mapPlaces = [...(data?.world?.layout?.locations?.length ? data.world.layout.locations : places), ...(data?.clubGrounds || []), ...residenceMarkers].map((p)=>({...p,kind:({headquarters:"hq","club-district":"club",residences:"home","club-ground":"club",residence:"home"}[p.kind]||p.kind),desc:p.desc||p.description||(p.accessPolicy ? "Club ground · level "+p.level : "")}));
  const selectedPlace = mapPlaces.find((p)=>p.id===selected);
  function startPan(event) {
    if (event.button!==undefined && event.button!==0) return;
    if(inertiaFrame.current)window.cancelAnimationFrame(inertiaFrame.current);
    mapGestureMoved.current=false;
    dragVelocity.current={vx:0,vy:0,lastX:event.clientX,lastY:event.clientY,lastAt:event.timeStamp};
    pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
    event.currentTarget.setPointerCapture(event.pointerId);
    if (pointers.current.size===2) {
      const pair=Array.from(pointers.current.values());
      const distance=Math.hypot(pair[0].x-pair[1].x,pair[0].y-pair[1].y);
      pinch.current={distance,scale};
      setDrag(null);
      return;
    }
    setDrag({x:event.clientX,y:event.clientY,ox:offset.x,oy:offset.y});
  }
  function movePan(event) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if (pointers.current.size>=2) {
      const pair=Array.from(pointers.current.values());
      const distance=Math.hypot(pair[0].x-pair[1].x,pair[0].y-pair[1].y);
      if (pinch.current && pinch.current.distance>0) {
        const nextScale=Math.min(1.45,Math.max(.42,pinch.current.scale*distance/pinch.current.distance));
        zoomAt(nextScale,(pair[0].x+pair[1].x)/2,(pair[0].y+pair[1].y)/2);
      }
      return;
    }
    if (!drag) return;
    if(Math.abs(event.clientX-drag.x)>6||Math.abs(event.clientY-drag.y)>6)mapGestureMoved.current=true;
    const now=event.timeStamp;
    const elapsed=Math.max(1,now-dragVelocity.current.lastAt);
    const bounds=mapViewportRef.current?.getBoundingClientRect();
    const worldDx=bounds ? (event.clientX-drag.x)*3000/bounds.width/(1.6666667*scale) : (event.clientX-drag.x);
    const worldDy=bounds ? (event.clientY-drag.y)*1200/bounds.height/scale : (event.clientY-drag.y);
    const velocityX=bounds ? (event.clientX-dragVelocity.current.lastX)*3000/bounds.width/(1.6666667*scale)/elapsed : (event.clientX-dragVelocity.current.lastX)/elapsed;
    const velocityY=bounds ? (event.clientY-dragVelocity.current.lastY)*1200/bounds.height/scale/elapsed : (event.clientY-dragVelocity.current.lastY)/elapsed;
    dragVelocity.current.vx=velocityX;dragVelocity.current.vy=velocityY;
    dragVelocity.current.lastX=event.clientX;dragVelocity.current.lastY=event.clientY;dragVelocity.current.lastAt=now;
    setOffset({x:Math.min(420,Math.max(-420,drag.ox+worldDx)),y:Math.min(300,Math.max(-300,drag.oy+worldDy))});
  }
  function stopPan(event) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size===1) {
      const remaining=Array.from(pointers.current.values())[0];
      setDrag({x:remaining.x,y:remaining.y,ox:offset.x,oy:offset.y});
      pinch.current=null;
    } else {
      setDrag(null);
      pinch.current=null;
      let vx=dragVelocity.current.vx*16,vy=dragVelocity.current.vy*16;
      if(Math.abs(vx)+Math.abs(vy)>1){
        const coast=()=>{
          setOffset((current)=>({x:Math.min(420,Math.max(-420,current.x+vx)),y:Math.min(300,Math.max(-300,current.y+vy))}));
          vx*=.88;vy*=.88;
          if(Math.abs(vx)+Math.abs(vy)>.15)inertiaFrame.current=window.requestAnimationFrame(coast);
          else inertiaFrame.current=null;
        };
        inertiaFrame.current=window.requestAnimationFrame(coast);
      }
    }
  }
  async function openClubGround(place) {
    setInteriorLoading(true);setNotice("");
    try {
      const result=await api("/world/club-grounds/"+place.clubId+"/interior");
      setInterior(result.interior);setActiveRoomIndex(0);
      setActiveLocationId("club-"+place.clubId);
      setSelected(null);
    } catch(error) {
      setNotice(error.message||"Only club members can enter this ground.");
    } finally {
      setInteriorLoading(false);
    }
  }
  async function openWorldInterior(place) {
    setInteriorLoading(true);setNotice("");
    try { const result=await api("/world/interiors/"+place.id); setInterior(result.interior); setActiveLocationId(place.id); setSelected(null); }
    catch(error){setNotice(error.message||"This building interior is not available yet.");}
    finally{setInteriorLoading(false);}
  }
  async function openResidence(place) {
    setInteriorLoading(true);setNotice("");
    try {
      const result=await api("/world/residences/"+place.ownerPlayerId);
      setInterior({...result.residence,type:"residence"});setActiveRoomIndex(0);
      setActiveLocationId("home-"+place.ownerPlayerId);
      setSelected(null);
    } catch(error) {
      setNotice(error.message||"This home interior is private.");
    } finally {
      setInteriorLoading(false);
    }
  }
  async function completeTutorial() {
    try {
      const result = await api("/world/tutorial/complete",{method:"POST",body:{}});
      setAvatar((current)=>({...current,tutorialComplete:true}));
      setData((current)=>({...current,avatar:{...current.avatar,tutorialComplete:true}}));
      if (result.reward && !result.duplicate) {
        const granted = result.reward;
        setNotice("Welcome to Original GG! +" + (granted.claim?.xpGranted || 0) + " XP and +" + (granted.claim?.coinsGranted || 0) + " GG Coins.");
      } else setNotice("Your Original GG welcome tour is complete.");
      window.dispatchEvent(new Event("gg-data-changed"));
    } catch (cause) {
      setNotice(cause.message || "Could not save tutorial progress.");
      return;
    }
    setTutorialClosed(true);
  }
  async function saveWorkout(event) {
    event.preventDefault(); setSaving(true); setNotice("");
    try {
      const counts=Object.fromEntries(exercises.map(([key])=>[key,Number(training[key]||0)]));
      const result=await api("/world/training/sessions",{method:"POST",body:{sessionId:crypto.randomUUID(),counts,durationSeconds:Number(duration)}});
      setData((v)=>({...v,training:result.profile}));
      setTraining(emptyTraining); const xp=result.reward?.claim?.xpGranted||0; const coins=result.reward?.claim?.coinsGranted||0; const unlocked=(result.achievements||[]).map((item)=>item.name); setNotice("Workout saved · +"+xp+" XP · +"+coins+" GG Coins"+(result.reward?.levelUps?" · Level up!":"")+(unlocked.length?" · Achievement unlocked: "+unlocked.join(", "):"")); window.dispatchEvent(new Event("gg-data-changed"));
    } catch(cause){setNotice(cause.message||"Could not save workout.");}
    finally{setSaving(false);}
  }
  function zoomAt(nextScale,clientX,clientY){
    const bounds=mapViewportRef.current?.getBoundingClientRect();
    if(!bounds||!bounds.width||!bounds.height){setScale(nextScale);return;}
    const viewPointX=(clientX-bounds.left)*3000/bounds.width;
    const pointX=900+(viewPointX-1500)/1.6666667;
    const pointY=(clientY-bounds.top)*1200/bounds.height;
    setOffset((current)=>({
      x:pointX-900-(pointX-900-current.x)*nextScale/scale,
      y:pointY-600-(pointY-600-current.y)*nextScale/scale,
    }));
    setScale(nextScale);
  }
  function zoom(amount){const next=Math.min(1.45,Math.max(.42,Number((scale+amount).toFixed(2))));const bounds=mapViewportRef.current?.getBoundingClientRect();if(bounds)zoomAt(next,bounds.left+bounds.width/2,bounds.top+bounds.height/2);else setScale(next);}
  function walkPlayerTo(target){
    if(walkFrame.current)window.cancelAnimationFrame(walkFrame.current);
    if(idleSkillReturnTimer.current)window.clearTimeout(idleSkillReturnTimer.current);
    const start={...(playerPositionRef.current||playerPosition)};
    const destination={x:Math.max(30,Math.min(1770,target.x)),y:Math.max(30,Math.min(1170,target.y))};
    const dx=destination.x-start.x,dy=destination.y-start.y;
    const distance=Math.hypot(dx,dy);
    if(distance<2){setCharacterMotion("idle");return;}
    if(Math.abs(dx)>Math.abs(dy))setCharacterDirection(dx<0?"left":"right");
    else setCharacterDirection(dy<0?"up":"down");
    setCharacterMotion("walking");
    if(motionTimer.current)window.clearTimeout(motionTimer.current);
    const duration=Math.min(1500,Math.max(300,distance*.52));
    let began=null;
    const animate=(now)=>{
      if(began===null)began=now;
      const progress=Math.min(1,(now-began)/duration);
      const eased=1-Math.pow(1-progress,3);
      const position={x:Math.round(start.x+dx*eased),y:Math.round(start.y+dy*eased)};
      playerPositionRef.current=position;
      playerMarkerRef.current?.setAttribute("transform","translate("+position.x+" "+position.y+") scale(.6 1)");
      if(progress<1)walkFrame.current=window.requestAnimationFrame(animate);
      else {
        walkFrame.current=null;
        setPlayerPosition(position);
        try { window.localStorage.setItem("gg-v4-world-position:"+(playerUid||"visitor"),JSON.stringify(position)); } catch { /* Position remains in this visit. */ }
        setCharacterMotion("idle");
      }
    };
    walkFrame.current=window.requestAnimationFrame(animate);
  }
  function handleMapBackgroundClick(event){
    if(mapGestureMoved.current){mapGestureMoved.current=false;return;}
    const svg=event.currentTarget;
    const matrix=svg.getScreenCTM?.();
    if(!matrix)return;
    const point=svg.createSVGPoint();
    point.x=event.clientX;point.y=event.clientY;
    const local=point.matrixTransform(matrix.inverse());
    const unwarpedX=900+(local.x-1500)/1.6666667;
    const x=900+(unwarpedX-900-offset.x)/scale;
    const y=(local.y-600-offset.y)/scale+600;
    walkPlayerTo({x,y});
  }
  function focusPlace(place){
    const next=Math.max(scale,.84);
    setScale(next);
    setOffset({x:(900-place.x)*next,y:(600-place.y)*next});
    walkPlayerTo({x:place.x,y:place.y+92});
    setSelected(null);
    if(place.kind==="hq"){
      setActiveLocationId(place.id);
      setActiveFacilityRoom(0);setFacility("hq");
    } else if(place.kind==="training"||place.id==="training-centre"){
      setActiveLocationId(place.id);
      setActiveFacilityRoom(0);setFacility("training");
    } else if(place.kind==="market"){
      setActiveLocationId(place.id);
      setActiveFacilityRoom(0);setFacility("market");
    } else if(place.clubId){
      openClubGround(place);
    } else if(place.kind==="home"&&place.ownerPlayerId){
      openResidence(place);
    } else if(place.id.startsWith("home-")){
      openResidence(place);
    } else if(place.kind==="club"){
      setActiveLocationId(place.id);
      setActiveFacilityRoom(0);setFacility("clubs");
    } else if(place.interior){
      openWorldInterior(place);
    } else {
      setSelected(place.id);
    }
  }
  function movePlayer(dx,dy){
    setPlayerPosition((p)=>{
      const next={x:Math.max(30,Math.min(1770,p.x+dx)),y:Math.max(30,Math.min(1170,p.y+dy))};
      playerPositionRef.current=next;
      return next;
    });
    if(Math.abs(dx)>Math.abs(dy))setCharacterDirection(dx<0?"left":"right");
    else if(dy!==0)setCharacterDirection(dy<0?"up":"down");
    setCharacterMotion("walking");
    if(motionTimer.current)window.clearTimeout(motionTimer.current);
    motionTimer.current=window.setTimeout(()=>setCharacterMotion("idle"),190);
  }
  async function sendCharacterInteraction(type){
    if(!selectedPlayer)return;
    try{
      await api("/world/social/interactions",{method:"POST",body:{toPlayerId:selectedPlayer.playerId,type}});
      setNotice("Your "+type.replace("-"," ")+" was sent to "+selectedPlayer.displayName+".");
    }catch(error){setNotice(error.message||"Could not send that interaction.");}
  }
  function handleMapKeyDown(event){const directions={ArrowUp:[0,-24],w:[0,-24],ArrowDown:[0,24],s:[0,24],ArrowLeft:[-24,0],a:[-24,0],ArrowRight:[24,0],d:[24,0]};const move=directions[event.key]||directions[event.key.toLowerCase()];if(move){event.preventDefault();movePlayer(move[0],move[1]);}}
  const liveCount=data && data.presence ? data.presence.length : 0;
  const roomListFor=(id)=>data?.world?.layout?.locations?.find((place)=>place.id===id)?.interior?.rooms||[];
  const headquartersRooms=roomListFor("gg-hq");
  const trainingRooms=roomListFor("training-centre");
  const marketRooms=roomListFor("market-square");
  const currentHeadquartersRoom=headquartersRooms[activeFacilityRoom]||headquartersRooms[0];
  const currentTrainingRoom=trainingRooms[activeFacilityRoom]||trainingRooms[0];
  const currentMarketRoom=marketRooms[activeFacilityRoom]||marketRooms[0];
  return <main className="gg-world">
    <header className="gg-world-header"><div className="gg-world-brand"><span className="gg-world-crest">GG</span><div><p>THE ORIGINAL GG WORLD</p><h1>Football City</h1></div></div><div className="gg-world-header-actions"><button className="gg-world-back" onClick={onExit}>← Matchday</button></div></header>
    
    {error && <div className="gg-world-error" role="alert">{error}<button onClick={load}>Try again</button></div>}
    {loading ? <div className="gg-world-loading">Opening the city gates…</div> : <>
      <section className="gg-world-map-shell">
        <div className="gg-world-map-topline"><div><span>THE CITY MAP</span><strong>Original GG · 1800 × 1200</strong></div><div className="gg-world-map-tools"><button onClick={()=>zoom(-.12)} aria-label="Zoom out">−</button><span>{Math.round(scale*100)}%</span><button onClick={()=>zoom(.12)} aria-label="Zoom in">+</button><button onClick={()=>{setScale(.84);setOffset({x:0,y:0});}}>Reset</button></div></div>
        <div ref={mapViewportRef} className="gg-world-map-viewport" tabIndex="0" onKeyDown={handleMapKeyDown} aria-label="Map controls: use arrow keys or WASD to move your footballer" onPointerDown={startPan} onPointerMove={movePan} onPointerUp={stopPan} onPointerCancel={stopPan} onWheel={(e)=>{e.preventDefault();zoomAt(Math.min(1.45,Math.max(.42,Number((scale+(e.deltaY<0?.06:-.06)).toFixed(2)))),e.clientX,e.clientY);}} style={{cursor:drag?"grabbing":"grab"}}>
          <svg className="gg-world-map-art" viewBox="0 0 3000 1200" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Interactive isometric football city map" onClick={handleMapBackgroundClick}>
            <defs><pattern id="gg-grid" width="120" height="60" patternUnits="userSpaceOnUse"><path d="M60 0 L120 30 L60 60 L0 30Z" fill="none" stroke="#d3e0bf" strokeOpacity=".1"/></pattern><linearGradient id="gg-ground" x2="0" y2="1"><stop stopColor="#315c43"/><stop offset="1" stopColor="#1d3e30"/></linearGradient></defs>
                        <g transform="translate(1500 600) scale(1.6666667 1) translate(-900 -600)">
            <g transform={"translate("+offset.x+" "+offset.y+") translate(900 600) scale("+scale+") translate(-900 -600)"}>
              <g data-layer="terrain"><rect width="1800" height="1200" fill="url(#gg-ground)"/><rect width="1800" height="1200" fill="url(#gg-grid)"/></g>
              <g data-layer="landscape-details" pointerEvents="none">
                <path d="M60 180Q230 90 410 170T760 155Q920 135 1075 205" fill="none" stroke="#567c51" strokeWidth="58" opacity=".2"/>
                <path d="M105 188Q260 105 420 182T760 172Q930 152 1070 218" fill="none" stroke="#91a66b" strokeWidth="3" strokeDasharray="8 13" opacity=".28"/>
                <path d="M90 1015Q280 930 470 1020T835 1028" fill="none" stroke="#728b50" strokeWidth="44" opacity=".18"/>
                <path d="M1140 80Q1265 145 1400 94T1730 130" fill="none" stroke="#547b51" strokeWidth="45" opacity=".2"/>
                <path d="M1230 945Q1410 850 1600 935T1775 940" fill="none" stroke="#8a9c5b" strokeWidth="36" opacity=".16"/>
                <g transform="translate(250 280)">
                  <path d="M-115 18Q-95 -56 -16 -62Q61 -76 112 -13Q143 28 80 61Q9 93 -81 62Q-139 46 -115 18Z" fill="#28604f" stroke="#78a58a" strokeWidth="7" opacity=".92"/>
                  <path d="M-91 22Q-55 -20 -10 -31Q50 -42 93 0Q52 52 -26 50Q-71 47 -91 22Z" fill="#3b7a75"/>
                  <path d="M-63 15Q-33 -5 -4 -7" fill="none" stroke="#a4d6c0" strokeWidth="4" strokeLinecap="round" opacity=".7"/>
                </g>
                <g transform="translate(1600 850)">
                  <path d="M-92 15Q-72 -41 -5 -54Q66 -58 101 -5Q128 39 65 61Q-22 91 -82 51Q-107 35 -92 15Z" fill="#255a4d" stroke="#7ba98d" strokeWidth="6"/>
                  <path d="M-65 16Q-23 -20 19 -24Q64 -26 79 9Q34 47 -22 42Q-52 36 -65 16Z" fill="#397a73"/>
                </g>
                <g fill="#d0b77d" opacity=".8">
                  <path d="M180 395L225 370L270 395L225 419Z M1420 390L1465 365L1510 390L1465 414Z M1020 1080L1064 1055L1108 1080L1064 1105Z"/>
                  <path d="M188 395L188 420L225 441L225 419Z M225 419L270 395L270 420L225 441Z M1428 390L1428 416L1465 436L1465 414Z M1465 414L1510 390L1510 416L1465 436Z" fill="#6a5940"/>
                </g>
                <g fill="#d8c18a" opacity=".86">
                  {Array.from({length:28},(_,i)=><circle key={i} cx={75+(i*137)%1650} cy={110+(i*193)%1010} r={i%4===0?5:3}/>)}
                </g>
                <g stroke="#a68d5e" strokeWidth="9" strokeLinecap="round">
                  {[160,320,740,1160,1515,1700].map((x,i)=><g key={x} transform={"translate("+x+" "+(350+(i%3)*180)+")"}><path d="M0 0V-48"/><path d="M-10 -48H10" strokeWidth="6"/><circle cy="-49" r="8" fill="#f0d58b" stroke="#51432e" strokeWidth="3"/></g>)}
                </g>
                <g fill="#598d52" stroke="#244b30" strokeWidth="4">
                  {[0,1,2,3,4,5,6,7,8,9,10,11].map(i=><g key={i} transform={"translate("+(120+(i*149)%1580)+" "+(240+(i*233)%850)+")"}><path d="M0 0V25" stroke="#705334" strokeWidth="8"/><circle cy="-9" r={i%3===0?28:20}/><circle cx="-12" cy="-17" r="10" fill="#79b66d" stroke="none"/></g>)}
                </g>
                <g fill="#d6bc79" stroke="#6d5736" strokeWidth="4">
                  {[0,1,2,3,4,5].map(i=><g key={i} transform={"translate("+(215+i*272)+" "+(680+(i%2)*130)+")"}><path d="M0 0V-42" stroke="#7c6140" strokeWidth="6"/><path d="M-20 -35L0 -54L20 -35L0 -16Z" fill="#d5bd82"/><path d="M-9 -36L0 -45L9 -36L0 -28Z" fill="#f1dfaa"/></g>)}
                </g>
              </g>
              <g data-layer="roads"><path d="M-80 570 L470 320 L930 540 L1420 290 L1900 510 M-100 900 L420 660 L900 890 L1370 650 L1900 900 M620 -80 L900 240 L1180 390 L1480 610 L1780 790" fill="none" stroke="#172f24" strokeWidth="100" opacity=".8"/>
              <path d="M-80 570 L470 320 L930 540 L1420 290 L1900 510 M-100 900 L420 660 L900 890 L1370 650 L1900 900 M620 -80 L900 240 L1180 390 L1480 610 L1780 790" fill="none" stroke="#938a70" strokeWidth="68" strokeLinecap="round" strokeDasharray="5 8"/>
              <path d="M-80 570 L470 320 L930 540 L1420 290 L1900 510 M-100 900 L420 660 L900 890 L1370 650 L1900 900 M620 -80 L900 240 L1180 390 L1480 610 L1780 790" fill="none" stroke="#e6d8b4" strokeWidth="2" strokeDasharray="18 20" opacity=".65"/>
              <path d="M900 600 L470 570 L570 820 M900 600 L1320 560 L1580 560 M470 570 L390 930" fill="none" stroke="#c5b58e" strokeWidth="24" strokeLinecap="round" opacity=".8"/>
              <path d="M900 600 L470 570 L570 820 M900 600 L1320 560 L1580 560 M470 570 L390 930" fill="none" stroke="#efe2c4" strokeWidth="2" strokeDasharray="10 14" opacity=".75"/>
              <g fill="#e7d9b8" opacity=".85"><path d="M770 588 l12 -8 l12 8 l-12 8Z M740 586 l12 -8 l12 8 l-12 8Z M710 584 l12 -8 l12 8 l-12 8Z M680 582 l12 -8 l12 8 l-12 8Z"/></g>
              <g transform="translate(1200 600)"><rect x="-45" y="-18" width="90" height="36" rx="12" fill="#10291e" stroke="#dfc47d" strokeWidth="2"/><text textAnchor="middle" y="5" fill="#f1e4c5" fontSize="12" fontWeight="800">FAN WAY</text></g>
              <g transform="translate(1460 540)"><rect x="-46" y="-18" width="92" height="36" rx="12" fill="#10291e" stroke="#dfc47d" strokeWidth="2"/><text textAnchor="middle" y="5" fill="#f1e4c5" fontSize="11" fontWeight="800">STATION RD</text></g>
              </g><g data-layer="district-zones">
                <path d="M690 150 L900 65 L1110 165 L900 270Z" fill="#d6b46a" opacity=".08" stroke="#e1c47b" strokeOpacity=".28" strokeWidth="4"/>
                <path d="M245 470 L470 365 L690 470 L470 590Z" fill="#9daea0" opacity=".1" stroke="#d9dfc7" strokeOpacity=".25" strokeWidth="4"/>
                <path d="M1090 440 L1320 330 L1550 445 L1320 570Z" fill="#7cae78" opacity=".1" stroke="#c7d9ad" strokeOpacity=".28" strokeWidth="4"/>
                <path d="M170 830 L390 720 L610 835 L390 955Z" fill="#c4b58f" opacity=".08" stroke="#d5c49b" strokeOpacity=".25" strokeWidth="4"/>
                <path d="M900 840 L1120 730 L1340 845 L1120 970Z" fill="#7eaa73" opacity=".09" stroke="#c1d9a9" strokeOpacity=".25" strokeWidth="4"/>
                {(data?.world?.layout?.districts||[]).map((district)=><g key={district.id} transform={"translate("+district.x+" "+district.y+") scale(.6 1)"} pointerEvents="none"><ellipse cy="52" rx="112" ry="22" fill="#06150d" opacity=".22"/><rect x="-105" y="28" width="210" height="31" rx="15" fill="#10271ddd" stroke="#dfc47d" strokeOpacity=".65"/><text y="48" textAnchor="middle" fill="#f3e2b5" fontSize="17" fontWeight="850" letterSpacing="1.5">{district.label.toUpperCase()}</text></g>)}
              </g><g data-layer="landscaping">{Array.from({length:30},(_,i)=><g key={i} transform={"translate("+(80+(i*197)%1640)+" "+(100+(i*137)%970)+")"}><path d="M0 0 L27 -14 L54 0 L27 15Z" fill="#47784f"/><path d="M27 14 L27 36" stroke="#765b3d" strokeWidth="7"/><circle cx="27" cy="-5" r="22" fill="#3f8050"/><circle cx="17" cy="-12" r="12" fill="#55925b"/></g>)}</g>
              <g data-layer="sports-facilities">
                <g transform="translate(1250 690)"><path d="M-125 0 L0 -58 L125 0 L0 58Z" fill="#387b48" stroke="#c8d7b5" strokeWidth="4"/><path d="M0 -58 L0 58 M-125 0 L125 0" stroke="#e4ebd6" strokeWidth="3"/><ellipse rx="25" ry="13" fill="none" stroke="#e4ebd6" strokeWidth="3"/><path d="M-105 -7 L-105 7 L-78 21 L-78 -21Z M105 -7 L105 7 L78 21 L78 -21Z" fill="none" stroke="#e4ebd6" strokeWidth="3"/></g>
                <g transform="translate(350 700)"><path d="M-85 0 L0 -40 L85 0 L0 40Z" fill="#3a7e49" stroke="#d7e3ca" strokeWidth="3"/><path d="M0 -40 L0 40 M-85 0 L85 0" stroke="#e7eddc" strokeWidth="2"/><ellipse rx="16" ry="8" fill="none" stroke="#e7eddc" strokeWidth="2"/><path d="M-73 -5 L-73 5 L-54 14 L-54 -14Z M73 -5 L73 5 L54 14 L54 -14Z" fill="none" stroke="#e7eddc" strokeWidth="2"/></g>
                <g transform="translate(1030 1040)"><path d="M-88 0 L0 -43 L88 0 L0 43Z" fill="#477e4c" stroke="#c4d3ad" strokeWidth="3"/><path d="M0 -43 L0 43 M-88 0 L88 0" stroke="#dce7d0" strokeWidth="2"/><ellipse rx="18" ry="9" fill="none" stroke="#dce7d0" strokeWidth="2"/></g>
              </g><g data-layer="buildings"><g transform="translate(460 570)"><path d="M-195 -105 L0 -195 L195 -105 L0 -15Z" fill="#1d362b" stroke="#c5aa70" strokeWidth="5"/><path d="M-145 -107 L0 -174 L145 -107 L0 -40Z" fill="#39814c" stroke="#d6d4b8" strokeWidth="4"/><path d="M-110 -108 L0 -158 L110 -108 L0 -58Z" fill="none" stroke="#e5e8ce" strokeWidth="3"/><path d="M0 -158 L0 -58 M-110 -108 L110 -108" fill="none" stroke="#e5e8ce" strokeWidth="2"/></g>
              </g><g data-layer="interactive-zones">{mapPlaces.map((place)=><g key={place.id} transform={"translate("+place.x+" "+place.y+") scale(.6 1)"} className="gg-map-place" onPointerDown={(e)=>e.stopPropagation()} onClick={(event)=>{event.stopPropagation();mapGestureMoved.current=false;focusPlace(place);}} role="button" tabIndex="0" aria-label={"Open "+place.name} onKeyDown={(e)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();focusPlace(place);}}}><ellipse cy="45" rx={place.kind==="stadium"?190:125} ry="40" fill="#10291d" opacity=".35"/><g transform="translate(-121 -113) scale(1.34)"><Building kind={place.kind}/></g><ellipse cy="48" rx="165" ry="24" fill="#07150e" opacity=".25"/><rect x="-180" y="78" width="360" height="46" rx="23" fill="#10251a" stroke="#d9bd78" strokeWidth="2"/><path d="M-153 86H153" stroke="#e3c77f" strokeOpacity=".2" strokeWidth="1"/><text y="107" textAnchor="middle" fill="#fff2d2" fontSize="23" fontWeight="850" letterSpacing=".25">{place.name}</text><circle cy="-111" r="12" fill="#eacb78" stroke="#263c2b" strokeWidth="5"/></g>)}
              </g><g data-layer="characters">{(data.presence||[]).filter((p)=>p.playerId!==data.playerId).map((p)=><g key={p.playerId} transform={"translate("+p.x+" "+p.y+") scale(.6 1)"} className="gg-world-player-marker" role="button" tabIndex="0" aria-label={"View "+p.displayName} onPointerDown={(e)=>e.stopPropagation()} onClick={(event)=>{event.stopPropagation();mapGestureMoved.current=false;setSelectedPlayer(p);}} onKeyDown={(e)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelectedPlayer(p);}}}><circle cy="-23" r="23" fill="#e5bf68" opacity=".18"/><foreignObject x="-20" y="-58" width="40" height="46"><div xmlns="http://www.w3.org/1999/xhtml" className="gg-map-character"><PlayerSprite appearance={p.appearance||{}} motion={playerMotions[p.playerId]||"idle"} direction={p.direction||"down"} animated={Boolean(playerMotions[p.playerId])}/></div></foreignObject><text y="12" textAnchor="middle" fill="#fff5dd" fontSize="13" stroke="#1b3326" strokeWidth="4" paintOrder="stroke">{p.displayName.slice(0,12)}</text></g>)}
              <g ref={playerMarkerRef} transform={"translate("+playerPosition.x+" "+playerPosition.y+") scale(.6 1)"} className={data.playerId?"gg-world-own-character":"gg-world-visitor-character"} pointerEvents="none">
                <ellipse cx="0" cy="4" rx="25" ry="9" fill="#07140c" opacity=".42"/>
                <circle cx="0" cy="-34" r="36" fill="none" stroke="#dfbd70" strokeOpacity=".62" strokeWidth="2" strokeDasharray="5 5"/>
                <foreignObject x="-30" y="-78" width="60" height="74"><div xmlns="http://www.w3.org/1999/xhtml" className="gg-map-character gg-world-own-sprite"><PlayerSprite appearance={appearance} motion={characterMotion} direction={characterDirection} animated/></div></foreignObject>
                <rect x="-91" y="14" width="182" height="29" rx="14" fill="#0e251a" stroke="#dfbd70" strokeWidth="1.5"/>
                <text x="0" y="33" textAnchor="middle" fill="#fff5dd" fontSize="16" fontWeight="850" stroke="#102016" strokeWidth="2" paintOrder="stroke">{avatar.displayName||playerName||"YOUR PLAYER"}</text>
                {!data.playerId&&<text x="0" y="58" textAnchor="middle" fill="#f2d795" fontSize="10" fontWeight="800" letterSpacing="2">LOCAL VISITOR</text>}
              </g>
            </g>
            </g>
            </g>
          </svg>
        </div>
        <div className="gg-world-map-footer"><span>↔ Drag to explore</span><span>Scroll or + / − to zoom</span><span>Tap a landmark to enter</span><span>WASD / arrows move your player</span></div><div className="gg-world-movement"><span>MOVE YOUR PLAYER</span><div><button type="button" onClick={()=>movePlayer(0,-24)} aria-label="Move up">↑</button><div><button type="button" onClick={()=>movePlayer(-24,0)} aria-label="Move left">←</button><button type="button" onClick={()=>movePlayer(0,24)} aria-label="Move down">↓</button><button type="button" onClick={()=>movePlayer(24,0)} aria-label="Move right">→</button></div></div></div>
      </section>
      {facility==="hq" && <div className="gg-world-facility-overlay gg-world-hq-overlay" role="dialog" aria-modal="true" aria-labelledby="gg-world-hq-title">
        <section className="gg-world-facility-window">
          <header className="gg-world-facility-heading"><div><span>THE GOLDEN GOONER HEADQUARTERS</span><h2 id="gg-world-hq-title">Welcome to the clubhouse.</h2><p>{liveCount} players are exploring Original GG right now.</p></div><button type="button" className="gg-world-back" onClick={()=>setFacility(null)}>← Back to city</button></header>
          <div className="gg-world-hq-visitors"><div><span>AT THE HEADQUARTERS</span><strong>{(data.presence||[]).filter((player)=>player.locationId===activeLocationId).length} players here</strong></div><div>{(data.presence||[]).filter((player)=>player.locationId===activeLocationId).length ? (data.presence||[]).filter((player)=>player.locationId===activeLocationId).map((player)=><article key={player.playerId}><PlayerSprite appearance={player.appearance||{}} motion={playerMotions[player.playerId]||"idle"} direction={player.direction||"down"} animated={Boolean(playerMotions[player.playerId])}/><span>{player.displayName}</span></article>) : <p>It's quiet in the clubhouse. Be the first to arrive.</p>}</div></div>
          <RoomTabs rooms={headquartersRooms} activeIndex={activeFacilityRoom} onSelect={setActiveFacilityRoom}/>
          {currentHeadquartersRoom&&<WalkableRoomScene key={"hq-"+currentHeadquartersRoom.id} room={currentHeadquartersRoom} appearance={appearance} onOpenChat={onOpenChat}/>}
          {data.playerId&&<WorldSocialPanel playerId={data.playerId} locationId={activeLocationId}/>}
        </section>
      </div>}
      {facility==="training" && <div className="gg-world-facility-overlay gg-world-training-overlay" role="dialog" aria-modal="true" aria-labelledby="gg-world-training-title">
        <section className="gg-world-facility-window">
          <header className="gg-world-facility-heading"><div><span>ORIGINAL GG · TRAINING CENTRE</span><h2 id="gg-world-training-title">Step onto the training pitch.</h2><p>Track your personal workouts, then take on the ball-control challenge.</p></div><button type="button" className="gg-world-back" onClick={()=>setFacility(null)}>← Back to city</button></header>
          <RoomTabs rooms={trainingRooms} activeIndex={activeFacilityRoom} onSelect={setActiveFacilityRoom}/>{currentTrainingRoom&&<WalkableRoomScene key={"training-"+currentTrainingRoom.id} room={currentTrainingRoom} appearance={appearance}/>} 
          <section className="gg-world-training-workbench">
            <div className="gg-world-section-title"><span>YOUR PERSONAL RECORD</span><h2>Log a workout</h2><p>Rename each counter to track any exercise you prefer. Totals and personal bests stay in your training history.</p></div>
            <div className="gg-world-training-grid">
              <form className="gg-world-training-form" onSubmit={saveWorkout}>
                <h3>Record a session</h3>
                <div className="gg-world-counter-grid">{exercises.map(([key,label])=><label key={key}><input className="gg-world-counter-name" type="text" maxLength="24" aria-label={"Workout name for "+label} value={exerciseNames[key]||label} onChange={(event)=>setExerciseNames((current)=>({...current,[key]:event.target.value}))}/><input type="number" min="0" max="1000" step="1" aria-label={"Count for "+(exerciseNames[key]||label)} value={training[key]} onChange={(event)=>setTraining((current)=>({...current,[key]:event.target.value}))} placeholder="0"/></label>)}</div>
                <label className="gg-world-duration">SESSION DURATION · SECONDS<input type="number" min="1" max="28800" value={duration} onChange={(event)=>setDuration(event.target.value)}/></label>
                <button className="gg-world-primary" disabled={saving||!data.canCreateCharacter}>{!data.canCreateCharacter?"Link your GG player profile first":saving?"Saving…":"Save workout"}</button>
              </form>
              <div className="gg-world-training-stats"><h3>All-time training totals</h3><div className="gg-world-stat-grid">{exercises.map(([key,label])=><div key={key}><span>{exerciseNames[key]||label}</span><strong>{data.training?.totals?.[key]||0}</strong><small>Best {data.training?.personalBests?.[key]||0}</small></div>)}</div><div className="gg-world-total"><span>TOTAL COUNTS</span><strong>{data.training?.totals?.totalCounts||0}</strong><small>{data.training?.totals?.sessions||0} workouts logged</small></div><div className="gg-world-training-history"><h3>Recent sessions</h3>{(data.trainingHistory||[]).length===0?<p>No workouts logged yet. Your first session will appear here.</p>:(data.trainingHistory||[]).map((session)=><div key={session.sessionId}><span>{new Date(session.recordedAt).toLocaleDateString()}</span><strong>{session.totalCounts} counters</strong><small>{Math.round(session.durationSeconds/60)} min</small></div>)}</div></div>
            </div>
          </section>
          <div className="gg-world-challenge-heading"><span>BALL CONTROL ARENA</span><h2>Can you beat the city record?</h2><p>Move with the arrow keys or WASD. Your best verified run appears on the GG leaderboard.</p></div>
          <TrainingChallenge onCelebrate={celebrateAfterVerifiedRun}/>
        </section>
      </div>}
      {facility==="market" && <div className="gg-world-facility-overlay gg-world-market-overlay" role="dialog" aria-modal="true" aria-label="Original GG Market Square">
        <section className="gg-world-facility-window">
          <header className="gg-world-facility-heading"><div><span>ORIGINAL GG · MARKET SQUARE</span><h2>Build your football identity.</h2><p>Character cosmetics, home furnishings and residence upgrades.</p></div><button type="button" className="gg-world-back" onClick={()=>setFacility(null)}>← Back to city</button></header>
          <RoomTabs rooms={marketRooms} activeIndex={activeFacilityRoom} onSelect={setActiveFacilityRoom}/>
          {currentMarketRoom&&<WalkableRoomScene key={"market-"+currentMarketRoom.id} room={currentMarketRoom} appearance={appearance}/>}
          <WorldEconomyPanel onEquipped={(nextAppearance)=>setAvatar((current)=>({...current,appearance:nextAppearance}))}/>
        </section>
      </div>}
      {facility==="clubs" && <div className="gg-world-facility-overlay" role="dialog" aria-modal="true" aria-label="Original GG Club District">
        <section className="gg-world-facility-window">
          <header className="gg-world-facility-heading"><div><span>ORIGINAL GG · CLUB DISTRICT</span><h2>Every club has a home.</h2><p>Choose a club ground to visit its shared space.</p></div><button type="button" className="gg-world-back" onClick={()=>setFacility(null)}>← Back to city</button></header>
          <div className="gg-world-club-directory">{mapPlaces.filter((place)=>place.clubId).map((place)=><article key={place.id}><div><strong>{place.name}</strong><small>{place.desc||"Club ground · level "+place.level}</small></div><button className="gg-world-primary" type="button" onClick={()=>openClubGround(place)}>Visit ground</button></article>)}{!mapPlaces.some((place)=>place.clubId)&&<p className="gg-world-coming">Club grounds will appear here as clubs create and upgrade their home grounds.</p>}</div>
          {data.playerId&&<WorldSocialPanel playerId={data.playerId} locationId={activeLocationId}/>}
        </section>
      </div>}
      {notice && <p className="gg-world-notice" role="status">{notice}</p>}
    </>}
    {selectedPlace && <div className="gg-world-modal-backdrop" onClick={()=>setSelected(null)}><section className="gg-world-building-modal" role="dialog" aria-modal="true" onClick={(e)=>e.stopPropagation()}><button className="gg-world-modal-close" onClick={()=>setSelected(null)} aria-label="Close">×</button><span>ORIGINAL GG LANDMARK</span><div className="gg-world-modal-art"><Building kind={selectedPlace.kind}/></div><h2>{selectedPlace.name}</h2><p>{selectedPlace.desc}</p>{selectedPlace.id.startsWith("home-") ? selectedPlace.ownerPlayerId===data.playerId ? <><button className="gg-world-primary" disabled={interiorLoading} onClick={()=>openResidence(selectedPlace)}>{interiorLoading?"Opening home…":"Enter your home"}</button><button type="button" className="gg-world-interior-secondary" onClick={()=>setResidenceAccessOpen(true)}>Manage visitors & privacy</button></> : <button className="gg-world-primary" disabled={interiorLoading} onClick={()=>openResidence(selectedPlace)}>{interiorLoading?"Checking visitor access…":"Visit this home"}</button> : selectedPlace.clubId ? <><button className="gg-world-primary" disabled={interiorLoading} onClick={()=>openClubGround(selectedPlace)}>{interiorLoading?"Checking club access…":"Enter club ground"}</button>{selectedPlace.isCaptain&&<ClubGroundManagementPanel ground={selectedPlace} onUpdated={(updated)=>setData((current)=>({...current,clubGrounds:(current.clubGrounds||[]).map((item)=>item.clubId===selectedPlace.clubId?({...item,...updated}):item)}))}/>}</> : selectedPlace.interior ? <><button className="gg-world-primary" disabled={interiorLoading} onClick={()=>openWorldInterior(selectedPlace)}>{interiorLoading?"Opening building…":"Enter "+selectedPlace.name}</button>{selectedPlace.kind==="training" && <button className="gg-world-interior-secondary" onClick={()=>{setSelected(null);document.querySelector(".gg-world-training-form")?.scrollIntoView({behavior:"smooth"});}}>Jump to workout counters</button>}</> : <p className="gg-world-coming">This landmark will receive its own interactive interior in a later build.</p>}</section></div>}
    {residenceAccessOpen&&<ResidenceAccessPanel onClose={()=>setResidenceAccessOpen(false)} onUpdated={load}/>}
    {selectedPlayer && <div className="gg-world-modal-backdrop" onClick={()=>setSelectedPlayer(null)}><section className="gg-world-player-card" role="dialog" aria-modal="true" onClick={(event)=>event.stopPropagation()}><button className="gg-world-modal-close" onClick={()=>setSelectedPlayer(null)} aria-label="Close player card">×</button><div className="gg-world-player-card-avatar"><PlayerSprite appearance={selectedPlayer.appearance||{}}/></div><span>LIVE IN ORIGINAL GG</span><h2>{selectedPlayer.displayName}</h2><p>Currently exploring the football city.</p><div className="gg-player-interactions"><button type="button" onClick={()=>sendCharacterInteraction("wave")}>👋 Wave</button><button type="button" onClick={()=>sendCharacterInteraction("high-five")}>✋ High-five</button><button type="button" onClick={()=>sendCharacterInteraction("cheer")}>🙌 Cheer</button><button type="button" onClick={()=>sendCharacterInteraction("dance")}>🕺 Dance</button></div><small>Character interactions are delivered live to this player.</small></section></div>}
    {interior && <div className="gg-world-facility-overlay gg-world-room-experience" role="dialog" aria-modal="true" aria-labelledby="gg-world-interior-title">
      <section className="gg-world-facility-window gg-world-room-window">
        <header className="gg-world-facility-heading"><div><span>{interior.type==="residence"?"PLAYER RESIDENCE":"ORIGINAL GG · "+(interior.type||"FACILITY").replaceAll("-"," ").toUpperCase()} · LEVEL {interior.level||1}</span><h2 id="gg-world-interior-title">{interior.name||"Facility interior"}</h2><p>Explore the room. Click the floor to move your character, or use WASD / arrow keys.</p></div><button className="gg-world-back" onClick={()=>{setInterior(null);setActiveLocationId("city-plaza");}}>← Back to city</button></header>
        <RoomTabs rooms={interior.interior?.rooms||[]} activeIndex={activeRoomIndex} onSelect={setActiveRoomIndex}/>
        {(interior.interior?.rooms||[]).length>0 ? <WalkableRoomScene key={(interior.interior.rooms[activeRoomIndex]||interior.interior.rooms[0]).id} room={interior.interior.rooms[activeRoomIndex]||interior.interior.rooms[0]} appearance={appearance} onOpenChat={onOpenChat}/> : <WalkableRoomScene key={interior.type||interior.name} room={{id:"lounge",name:interior.name||"Player Lounge",theme:"clubhouse",items:[]}} appearance={appearance} onOpenChat={onOpenChat}/>}
        <div className="gg-world-room-inventory"><span>IN THIS ROOM</span>{((interior.interior?.rooms||[])[activeRoomIndex]?.items||[]).map((item)=><small key={item}>{item.replaceAll("-"," ")}</small>)}{((interior.interior?.rooms||[])[activeRoomIndex]?.furniture||[]).map((item,index)=><small key={item.itemId+":"+index}>✦ {item.name}</small>)}</div>
        {interior.type==="residence"&&<button type="button" className="gg-world-interior-secondary" onClick={()=>setResidenceAccessOpen(true)}>Manage visitors and privacy</button>}
      </section>
    </div>}
    {data?.avatar && !data.avatar.tutorialComplete && !tutorialClosed && <div className="gg-world-guide" role="dialog" aria-modal="true" aria-labelledby="gg-world-guide-title"><div className="gg-world-guide-character"><PlayerSprite appearance={appearance}/></div><div className="gg-world-guide-copy"><span>YOUR GG COMPANION · QUICK TOUR {tutorialStep+1}/3</span><h2 id="gg-world-guide-title">{["Welcome to Original GG!","Meet your player character.","Your training journey starts here."][tutorialStep]}</h2><p>{["This is your football city. Click anywhere to walk your player there. Drag the map, pinch to zoom on mobile, and tap a landmark to enter its facility.","Customise your footballer with a name, hairstyle, skin tone, kit and boots. Your look is saved to your player account.","Visit the Training Centre to record push-ups, pull-ups, squats and plank holds. Your totals and personal bests are saved in the Clubs database."][tutorialStep]}</p><div><button className="gg-world-guide-skip" onClick={completeTutorial}>Skip tour</button><button className="gg-world-primary" onClick={()=>tutorialStep===2?completeTutorial():setTutorialStep((step)=>step+1)}>{tutorialStep===2?"Finish tour":"Next tip →"}</button></div></div></div>}
    <footer className="gg-world-footer">GG MATCHDAY · ORIGINAL GG WORLD <span>Built for the players, by the players.</span></footer>
  </main>;
}
