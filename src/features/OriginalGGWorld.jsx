import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import "./original-gg.css";
import { G, Layer, N, rgba } from "./companion/leaflet-pip-engine.js";
import TrainingChallenge from "./TrainingChallenge.jsx";
import WorldEconomyPanel from "./WorldEconomyPanel.jsx";

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

export function PlayerSprite({ appearance = {} }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!context) return;
    const skin = ({deep:"#75432f",dark:"#965c42",medium:"#c1835c",tan:"#d49a70",light:"#e5b891",fair:"#f0c9a8"})[appearance.skinTone] || "#c1835c";
    const hair = ({black:"#171717",brown:"#51301f",blonde:"#e1bd62",red:"#9d3d2e",silver:"#aaaeb9",blue:"#4167b6",teal:"#28a7a0",pink:"#e36ca8",white:"#e8e8e4"})[appearance.hairColor] || "#171717";
    const kit = ({black:"#17191e",white:"#f3f1e8",gold:"#d7ad52",red:"#b6383d",blue:"#2864a2",green:"#34784f",purple:"#71499c",orange:"#c96b32",navy:"#172a50",teal:"#218f89",pink:"#d95d91",maroon:"#681f35"})[appearance.kitPrimary] || "#17191e";
    const trim = ({black:"#151515",white:"#f3f1e8",gold:"#d7ad52",red:"#b6383d",blue:"#2864a2",green:"#34784f",purple:"#71499c",orange:"#c96b32",navy:"#172a50",teal:"#218f89",pink:"#d95d91",maroon:"#681f35"})[appearance.kitSecondary] || "#d7ad52";
    const boot = ({black:"#171717",white:"#f5f3eb",gold:"#d7ad52",red:"#c64040",blue:"#3869b5",green:"#43865a",orange:"#d97835",purple:"#71499c",pink:"#e36ca8",cyan:"#46c7d5"})[appearance.bootColor] || "#f5f3eb";
    const layer = new Layer();
    const g = new G(layer,{outline:"#211b17"},0);
    g.stamp((l)=>l.ell(16,8,5,6,skin));
    if (appearance.hairStyle!=="bald") {
      const style=appearance.hairStyle||"short";
      if (style==="afro") g.stamp((l)=>l.ell(16,4,7,5,hair));
      else if (style==="mohawk") g.stamp((l)=>l.rect(14,0,4,7,hair));
      else if (style==="curly") {
        g.stamp((l)=>l.ell(16,4,6,4,hair));g.rect(10,3,3,3,hair);g.rect(19,2,3,3,hair);g.rect(12,0,3,3,hair);
      } else if (style==="bun") {
        g.stamp((l)=>l.ell(16,4,6,3,hair));g.stamp((l)=>l.ell(22,2,3,3,hair));
      } else if (style==="ponytail") {
        g.stamp((l)=>l.ell(16,4,6,3,hair));g.rect(20,5,3,2,hair);g.rect(22,7,2,5,hair);
      } else if (style==="spiky") {
        g.stamp((l)=>l.ell(16,4,6,3,hair));g.rect(11,1,3,4,hair);g.rect(15,0,3,5,hair);g.rect(19,1,3,4,hair);
      } else if (style==="side-part") {
        g.stamp((l)=>l.ell(16,4,6,3,hair));g.rect(11,3,4,3,hair);g.rect(18,1,4,2,hair);
      } else {
        g.stamp((l)=>l.ell(16,4,6,3,hair));
        if (style==="long") { g.rect(10,5,2,8,hair);g.rect(20,5,2,8,hair); }
        if (style==="fade") { g.rect(11,6,2,2,hair);g.rect(19,6,2,2,hair); }
      }
    }
    g.rect(14,13,4,3,skin);
    const left = appearance.bodyType==="slim"?13:appearance.bodyType==="stocky"?9:11;
    const width = appearance.bodyType==="slim"?6:appearance.bodyType==="stocky"?14:10;
    g.stamp((l)=>l.rect(left,15,width,10,kit));
    g.rect(14,15,4,2,trim);g.rect(15,17,2,6,trim);
    g.stamp((l)=>l.rect(left-3,16,3,8,skin));
    g.stamp((l)=>l.rect(left+width,16,3,8,skin));
    g.rect(12,25,3,5,skin);g.rect(17,25,3,5,skin);
    g.rect(10,29,5,2,boot);g.rect(17,29,5,2,boot);
    g.rect(14,7,1,1,"#241a16");g.rect(18,7,1,1,"#241a16");
    g.rect(15,10,2,1,"#71402f");
    const accessory=appearance.headAccessory||"none";
    if(accessory!=="none"){
      const accessoryColor=accessory==="gold-headband"?"#d7ad52":accessory==="red-headband"?"#bd3545":"#3476c5";
      g.rect(10,5,12,2,accessoryColor);g.rect(10,5,2,3,accessoryColor);g.rect(20,5,2,3,accessoryColor);
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
  },[appearance.skinTone,appearance.hairStyle,appearance.hairColor,appearance.bodyType,appearance.kitPrimary,appearance.kitSecondary,appearance.bootColor,appearance.headAccessory]);
  return <canvas ref={canvasRef} width="32" height="32" className="gg-player-sprite" role="img" aria-label="Your pixel footballer"/>;
}
function RoomScene({room}) {
  const id=room.id||"lounge";
  const training=/training|strength|indoor|skills/.test(id);
  const trophy=/trophy|gallery|hall-of-fame/.test(id);
  const tactics=/tactics|meeting|class|press/.test(id);
  const market=/market|locker/.test(id);
  const accent=room.theme?.includes("gold")?"#d8b66c":training?"#75a46c":market?"#d2a66c":"#88a78b";
  return <svg className="gg-world-room-scene" viewBox="0 0 640 320" aria-hidden="true">
    <defs><linearGradient id="gg-room-left" x2="1" y2="1"><stop stopColor="#6c806b"/><stop offset="1" stopColor="#304a38"/></linearGradient><linearGradient id="gg-room-right" x2="0" y2="1"><stop stopColor="#4e6854"/><stop offset="1" stopColor="#20382a"/></linearGradient><linearGradient id="gg-room-floor" x2="0" y2="1"><stop stopColor="#b49a6b"/><stop offset="1" stopColor="#6d5b43"/></linearGradient></defs>
    <path d="M34 110 L320 14 L606 110 L320 214Z" fill="#1c2c21" stroke="#d7c08a" strokeWidth="3"/>
    <path d="M34 110 L320 214 L320 285 L34 181Z" fill="url(#gg-room-left)"/>
    <path d="M320 214 L606 110 L606 181 L320 285Z" fill="url(#gg-room-right)"/>
    <path d="M34 181 L320 285 L606 181" fill="none" stroke="#d2bb85" strokeWidth="3"/>
    <path d="M91 131 L320 49 L549 131 M148 151 L320 89 L492 151 M206 171 L320 130 L434 171" fill="none" stroke="#e5d2a1" strokeOpacity=".18" strokeWidth="2"/>
    <path d="M320 214 L320 285 M177 162 L177 232 M463 162 L463 232" stroke="#e4d1a2" strokeOpacity=".18" strokeWidth="2"/>
    <path d="M76 121 L76 72 L148 48 L148 145" fill="#24392b" stroke="#c8b17c" strokeWidth="3"/>
    <path d="M91 113 L91 80 L133 66 L133 128" fill="#7fa0a0" opacity=".7"/>
    <path d="M493 127 L493 65 L556 88 L556 149" fill="#263c2e" stroke="#c8b17c" strokeWidth="3"/>
    <path d="M507 120 L507 79 L541 92 L541 132" fill="#7fa0a0" opacity=".65"/>
    {training && <g>
      <path d="M180 166 L270 135 L360 168 L270 200Z" fill="#477d50" stroke="#d9dfc3" strokeWidth="3"/>
      <path d="M270 135 L270 200 M180 166 L360 168" stroke="#e6e9d5" strokeWidth="2"/>
      <path d="M175 153 L175 119 M185 153 L185 119 M175 119 L185 119" stroke="#d9c58d" strokeWidth="5"/>
      <path d="M395 171 L395 132 L515 132" fill="none" stroke="#d6c18b" strokeWidth="7" strokeLinecap="round"/>
      <path d="M405 132 L405 153 M505 132 L505 153" stroke="#d6c18b" strokeWidth="5"/>
      <rect x="390" y="177" width="82" height="16" rx="6" fill="#9c6c48" transform="rotate(-15 390 177)"/>
      <circle cx="455" cy="184" r="11" fill="#222a25"/><circle cx="478" cy="177" r="11" fill="#222a25"/>
    </g>}
    {trophy && <g>
      <rect x="204" y="88" width="230" height="76" rx="6" fill="#26382b" stroke="#d9bd74" strokeWidth="4"/>
      <path d="M219 100 L419 100 M219 151 L419 151" stroke="#d9bd74" strokeOpacity=".55" strokeWidth="3"/>
      {[0,1,2,3].map((n)=><g key={n} transform={"translate("+(246+n*52)+" 0)"}><path d="M0 124 L-12 111 L-10 96 L10 96 L12 111Z" fill={accent} stroke="#6c512a" strokeWidth="2"/><path d="M-10 103 L-22 103 Q-23 119 -7 118 M10 103 L22 103 Q23 119 7 118" fill="none" stroke={accent} strokeWidth="4"/><path d="M-4 124 L4 124 L7 136 L-7 136Z" fill="#c8a35e"/><rect x="-11" y="136" width="22" height="5" fill="#3c3325"/></g>)}
      <path d="M238 183 L400 183 L400 192 L238 192Z" fill="#8d6940"/>
    </g>}
    {tactics && <g>
      <path d="M210 77 L430 28 L430 112 L210 160Z" fill="#17271f" stroke="#d6bc7c" strokeWidth="4"/>
      <path d="M320 52 L320 136 M250 68 L390 100 M250 135 L390 65" stroke="#d8e1ca" strokeOpacity=".7" strokeWidth="3"/>
      {[0,1,2,3,4].map((n)=><circle key={n} cx={255+n*32} cy={90+(n%2)*22} r="7" fill={n%2? "#c95c4c":"#d8bd75"}/>)}
      <path d="M240 186 L370 148 L442 175 L312 214Z" fill="#6b5138" stroke="#d1b77c" strokeWidth="3"/>
      <path d="M276 201 L276 228 M410 188 L410 215" stroke="#493927" strokeWidth="8"/>
    </g>}
    {market && <g>
      <path d="M194 124 L420 48 L452 64 L225 142Z" fill="#a14c3d" stroke="#e0c18a" strokeWidth="3"/>
      <path d="M220 145 L420 78 L420 147 L220 214Z" fill="#26392b" stroke="#d7bd83" strokeWidth="3"/>
      <path d="M242 157 L295 139 L295 188 L242 206Z M328 128 L382 110 L382 160 L328 178Z" fill="#d7b875"/>
      <path d="M242 157 L295 139 M328 128 L382 110" stroke="#f3e4c2" strokeWidth="3"/>
    </g>}
    {!training&&!trophy&&!tactics&&!market && <g>
      <path d="M196 160 L276 132 L356 160 L276 189Z" fill="#a66f50" stroke="#e0c38e" strokeWidth="3"/>
      <path d="M216 157 L216 180 M336 157 L336 180" stroke="#563c2d" strokeWidth="8"/>
      <path d="M375 169 L429 151 L461 164 L407 183Z" fill="#c5a26c" stroke="#6d5435" strokeWidth="3"/>
      <path d="M402 181 L402 197 M443 167 L443 183" stroke="#6d5435" strokeWidth="5"/>
      <path d="M250 63 L390 16" stroke={accent} strokeWidth="8"/>
    </g>}
    <circle cx="320" cy="226" r="10" fill="#e5c77e" opacity=".7"/>
  </svg>;
}

function Building({ kind }) {
  const colors = {hq:"#c69a45",stadium:"#758b83",training:"#668b69",market:"#b78b59",park:"#4d8057",club:"#788477",home:"#a68b70",academy:"#7b8f76",plaza:"#a89a78",plot:"#9c8e6d",museum:"#a88a57",transit:"#82928d","fan-zone":"#a64c58",esports:"#7456a8","community-pitch":"#4d9861"};
  return <svg viewBox="0 0 180 125" aria-hidden="true">
    <path d="M12 91 L89 117 L168 87 L89 60Z" fill="#1b2923" opacity=".3"/>
    <path d="M25 57 L89 25 L155 54 L90 86Z" fill={colors[kind]||"#788477"} stroke="#1b3027" strokeWidth="3"/>
    <path d="M25 57 L90 86 L90 111 L25 82Z" fill="#34483e" stroke="#1b3027" strokeWidth="2"/>
    <path d="M90 86 L155 54 L155 79 L90 111Z" fill="#253a31" stroke="#1b3027" strokeWidth="2"/>
    <path d="M49 53 L89 33 L132 53 L90 73Z" fill="#d4b36a" opacity=".42"/>
    <path d="M79 82 L101 73 L101 108 L79 117Z" fill="#17251f"/>
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

export default function OriginalGGWorld({ onExit, onProfile, onOpenChat }) {
  const [data,setData] = useState(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [selected,setSelected] = useState(null);
  const [interior,setInterior] = useState(null);
  const [selectedPlayer,setSelectedPlayer] = useState(null);
  const [interiorLoading,setInteriorLoading] = useState(false);
  const [avatar,setAvatar] = useState({displayName:"",appearance:{skinTone:"medium",hairStyle:"short",hairColor:"black",kitPrimary:"black",kitSecondary:"gold",bootColor:"white",headAccessory:"none"}});
  const [training,setTraining] = useState(emptyTraining);
  const [duration,setDuration] = useState("900");
  const [saving,setSaving] = useState(false);
  const [notice,setNotice] = useState("");
  const [tutorialStep,setTutorialStep] = useState(0);
  const [tutorialClosed,setTutorialClosed] = useState(false);
  const [scale,setScale] = useState(.72);
  const [playerPosition,setPlayerPosition] = useState({x:900,y:600});
  const [offset,setOffset] = useState({x:0,y:0});
  const [drag,setDrag] = useState(null);
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
  useEffect(() => {
    let cancelled = false;
    api("/world/bootstrap").then((result) => {
      if (cancelled) return;
      setData(result);
      if (result.avatar) setAvatar(result.avatar);
    }).catch((cause) => {
      if (!cancelled) setError(cause.message || "The city could not load.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);
  const hasAvatar = Boolean(data?.avatar);
  useEffect(() => {
    if (!hasAvatar) return;
    const heartbeat = async () => {
      try {
        await api("/world/presence",{method:"POST",body:{locationId:"city-plaza",...playerPosition}});
        const latest = await api("/world/presence?refresh="+Date.now());
        setData((current)=>current?({...current,presence:latest.presence||[]}):current);
      } catch {
        // A temporary network issue should not interrupt map exploration.
      }
    };
    heartbeat();
    const timer = window.setInterval(heartbeat,12000);
    return () => window.clearInterval(timer);
  },[hasAvatar,playerPosition]);
  const appearance = avatar.appearance || {};
  const residenceMarkers = [...(data?.residences || []), ...(data?.residence ? [data.residence] : [])].filter((home,index,all)=>all.findIndex((item)=>item.ownerPlayerId===home.ownerPlayerId)===index).map((home)=>({...home,id:"home-"+home.ownerPlayerId,kind:"residence",description:home.ownerPlayerId===data.playerId?"Your home · private interior":"Player residence · private interior"}));
  const mapPlaces = [...(data?.world?.layout?.locations?.length ? data.world.layout.locations : places), ...(data?.clubGrounds || []), ...(data?.plots || []), ...residenceMarkers].map((p)=>({...p,kind:({headquarters:"hq","club-district":"club",residences:"home","club-ground":"club",residence:"home",plot:"plot"}[p.kind]||p.kind),desc:p.desc||p.description||(p.accessPolicy ? "Club ground · level "+p.level : "")}));
  const selectedPlace = mapPlaces.find((p)=>p.id===selected);
  function startPan(event) {
    if (event.button!==undefined && event.button!==0) return;
    if(inertiaFrame.current)window.cancelAnimationFrame(inertiaFrame.current);
    dragVelocity.current={vx:0,vy:0,lastX:event.clientX,lastY:event.clientY,lastAt:Date.now()};
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
    const now=Date.now();
    const elapsed=Math.max(1,now-dragVelocity.current.lastAt);
    dragVelocity.current.vx=(event.clientX-dragVelocity.current.lastX)/elapsed;
    dragVelocity.current.vy=(event.clientY-dragVelocity.current.lastY)/elapsed;
    dragVelocity.current.lastX=event.clientX;dragVelocity.current.lastY=event.clientY;dragVelocity.current.lastAt=now;
    setOffset({x:Math.min(420,Math.max(-420,drag.ox+event.clientX-drag.x)),y:Math.min(300,Math.max(-300,drag.oy+event.clientY-drag.y))});
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
  function changeAppearance(key,value){setAvatar((v)=>({...v,appearance:{...v.appearance,[key]:value}}));}
  async function saveAvatar(event) {
    event.preventDefault(); setSaving(true); setNotice("");
    try { const result=await api("/world/avatar",{method:"PUT",body:avatar}); setAvatar(result.avatar); setNotice("Your player character has been saved."); }
    catch(cause){setNotice(cause.message||"Could not save character.");}
    finally{setSaving(false);}
  }
  async function openClubGround(place) {
    setInteriorLoading(true);setNotice("");
    try { const result=await api("/world/club-grounds/"+place.clubId+"/interior"); setInterior(result.interior); setSelected(null); }
    catch(error){setNotice(error.message||"Only club members can enter this ground.");}
    finally{setInteriorLoading(false);}
  }
  async function openWorldInterior(place) {
    setInteriorLoading(true);setNotice("");
    try { const result=await api("/world/interiors/"+place.id); setInterior(result.interior); setSelected(null); }
    catch(error){setNotice(error.message||"This building interior is not available yet.");}
    finally{setInteriorLoading(false);}
  }
  async function openResidence(place) {
    setInteriorLoading(true);setNotice("");
    try {
      const result=await api("/world/residences/"+place.ownerPlayerId);
      setInterior({...result.residence,type:"residence"});
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
      setTraining(emptyTraining); const xp=result.reward?.claim?.xpGranted||0; const coins=result.reward?.claim?.coinsGranted||0; const unlocked=(result.achievements||[]).map((item)=>item.name); setNotice("Workout saved · +"+xp+" XP · +"+coins+" GG Coins"+(unlocked.length?" · Achievement unlocked: "+unlocked.join(", "):""));
    } catch(cause){setNotice(cause.message||"Could not save workout.");}
    finally{setSaving(false);}
  }
  function zoomAt(nextScale,clientX,clientY){
    const bounds=mapViewportRef.current?.getBoundingClientRect();
    if(!bounds||!bounds.width||!bounds.height){setScale(nextScale);return;}
    const pointX=(clientX-bounds.left)*1800/bounds.width;
    const pointY=(clientY-bounds.top)*1200/bounds.height;
    setOffset((current)=>({
      x:pointX-900-(pointX-900-current.x)*nextScale/scale,
      y:pointY-600-(pointY-600-current.y)*nextScale/scale,
    }));
    setScale(nextScale);
  }
  function zoom(amount){const next=Math.min(1.45,Math.max(.42,Number((scale+amount).toFixed(2))));const bounds=mapViewportRef.current?.getBoundingClientRect();if(bounds)zoomAt(next,bounds.left+bounds.width/2,bounds.top+bounds.height/2);else setScale(next);}
  function focusPlace(place){setSelected(place.id);const next=Math.max(scale,.92);setScale(next);setOffset({x:(900-place.x)*next,y:(600-place.y)*next});}
  function movePlayer(dx,dy){setPlayerPosition((p)=>({x:Math.max(30,Math.min(1770,p.x+dx)),y:Math.max(30,Math.min(1170,p.y+dy))}));}
  function handleMapKeyDown(event){const directions={ArrowUp:[0,-24],w:[0,-24],ArrowDown:[0,24],s:[0,24],ArrowLeft:[-24,0],a:[-24,0],ArrowRight:[24,0],d:[24,0]};const move=directions[event.key]||directions[event.key.toLowerCase()];if(move){event.preventDefault();movePlayer(move[0],move[1]);}}
  const liveCount=data && data.presence ? data.presence.length : 0;
  return <main className="gg-world">
    <header className="gg-world-header"><div className="gg-world-brand"><span className="gg-world-crest">GG</span><div><p>THE ORIGINAL GG WORLD</p><h1>Football City</h1></div></div><div className="gg-world-header-actions"><button className="gg-world-back" onClick={onProfile}>♙ My Player</button><button className="gg-world-back" onClick={onExit}>← Matchday</button></div></header>
    <section className="gg-world-intro"><div><span className="gg-world-kicker">ONE CITY. EVERY PLAYER. ONE FOOTBALL COMMUNITY.</span><h2>Welcome to your football kingdom.</h2><p>Explore the city, visit its landmarks and build your place in Original GG.</p></div><div className="gg-world-live"><i/> {liveCount} players in the city</div></section>
    {error && <div className="gg-world-error" role="alert">{error}<button onClick={load}>Try again</button></div>}
    {loading ? <div className="gg-world-loading">Opening the city gates…</div> : <>
      <section className="gg-world-map-shell">
        <div className="gg-world-map-topline"><div><span>THE CITY MAP</span><strong>Original GG · 1800 × 1200</strong></div><div className="gg-world-map-tools"><button onClick={()=>zoom(-.12)} aria-label="Zoom out">−</button><span>{Math.round(scale*100)}%</span><button onClick={()=>zoom(.12)} aria-label="Zoom in">+</button><button onClick={()=>{setScale(.72);setOffset({x:0,y:0});}}>Reset</button></div></div>
        <div ref={mapViewportRef} className="gg-world-map-viewport" tabIndex="0" onKeyDown={handleMapKeyDown} aria-label="Map controls: use arrow keys or WASD to move your footballer" onPointerDown={startPan} onPointerMove={movePan} onPointerUp={stopPan} onPointerCancel={stopPan} onWheel={(e)=>{e.preventDefault();zoomAt(Math.min(1.45,Math.max(.42,Number((scale+(e.deltaY<0?.06:-.06)).toFixed(2)))),e.clientX,e.clientY);}} style={{cursor:drag?"grabbing":"grab"}}>
          <svg viewBox="0 0 1800 1200" role="img" aria-label="Interactive isometric football city map">
            <defs><pattern id="gg-grid" width="120" height="60" patternUnits="userSpaceOnUse"><path d="M60 0 L120 30 L60 60 L0 30Z" fill="none" stroke="#d3e0bf" strokeOpacity=".1"/></pattern><linearGradient id="gg-ground" x2="0" y2="1"><stop stopColor="#315c43"/><stop offset="1" stopColor="#1d3e30"/></linearGradient></defs>
            <g transform={"translate("+offset.x+" "+offset.y+") translate(900 600) scale("+scale+") translate(-900 -600)"}>
              <g data-layer="terrain"><rect width="1800" height="1200" fill="url(#gg-ground)"/><rect width="1800" height="1200" fill="url(#gg-grid)"/></g>
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
                {(data?.world?.layout?.districts||[]).map((district)=><g key={district.id} transform={"translate("+district.x+" "+district.y+")"} pointerEvents="none"><ellipse cy="52" rx="112" ry="22" fill="#06150d" opacity=".22"/><rect x="-105" y="28" width="210" height="31" rx="15" fill="#10271ddd" stroke="#dfc47d" strokeOpacity=".65"/><text y="48" textAnchor="middle" fill="#f3e2b5" fontSize="17" fontWeight="850" letterSpacing="1.5">{district.label.toUpperCase()}</text></g>)}
              </g><g data-layer="landscaping">{Array.from({length:30},(_,i)=><g key={i} transform={"translate("+(80+(i*197)%1640)+" "+(100+(i*137)%970)+")"}><path d="M0 0 L27 -14 L54 0 L27 15Z" fill="#47784f"/><path d="M27 14 L27 36" stroke="#765b3d" strokeWidth="7"/><circle cx="27" cy="-5" r="22" fill="#3f8050"/><circle cx="17" cy="-12" r="12" fill="#55925b"/></g>)}</g>
              <g data-layer="sports-facilities">
                <g transform="translate(1250 690)"><path d="M-125 0 L0 -58 L125 0 L0 58Z" fill="#387b48" stroke="#c8d7b5" strokeWidth="4"/><path d="M0 -58 L0 58 M-125 0 L125 0" stroke="#e4ebd6" strokeWidth="3"/><ellipse rx="25" ry="13" fill="none" stroke="#e4ebd6" strokeWidth="3"/><path d="M-105 -7 L-105 7 L-78 21 L-78 -21Z M105 -7 L105 7 L78 21 L78 -21Z" fill="none" stroke="#e4ebd6" strokeWidth="3"/></g>
                <g transform="translate(350 700)"><path d="M-85 0 L0 -40 L85 0 L0 40Z" fill="#3a7e49" stroke="#d7e3ca" strokeWidth="3"/><path d="M0 -40 L0 40 M-85 0 L85 0" stroke="#e7eddc" strokeWidth="2"/><ellipse rx="16" ry="8" fill="none" stroke="#e7eddc" strokeWidth="2"/><path d="M-73 -5 L-73 5 L-54 14 L-54 -14Z M73 -5 L73 5 L54 14 L54 -14Z" fill="none" stroke="#e7eddc" strokeWidth="2"/></g>
                <g transform="translate(1030 1040)"><path d="M-88 0 L0 -43 L88 0 L0 43Z" fill="#477e4c" stroke="#c4d3ad" strokeWidth="3"/><path d="M0 -43 L0 43 M-88 0 L88 0" stroke="#dce7d0" strokeWidth="2"/><ellipse rx="18" ry="9" fill="none" stroke="#dce7d0" strokeWidth="2"/></g>
              </g><g data-layer="buildings"><g transform="translate(460 570)"><path d="M-195 -105 L0 -195 L195 -105 L0 -15Z" fill="#1d362b" stroke="#c5aa70" strokeWidth="5"/><path d="M-145 -107 L0 -174 L145 -107 L0 -40Z" fill="#39814c" stroke="#d6d4b8" strokeWidth="4"/><path d="M-110 -108 L0 -158 L110 -108 L0 -58Z" fill="none" stroke="#e5e8ce" strokeWidth="3"/><path d="M0 -158 L0 -58 M-110 -108 L110 -108" fill="none" stroke="#e5e8ce" strokeWidth="2"/></g>
              </g><g data-layer="interactive-zones">{mapPlaces.map((place)=><g key={place.id} transform={"translate("+place.x+" "+place.y+")"} className="gg-map-place" onPointerDown={(e)=>e.stopPropagation()} onClick={()=>focusPlace(place)} role="button" tabIndex="0" aria-label={"Open "+place.name} onKeyDown={(e)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();focusPlace(place);}}}><ellipse cy="45" rx={place.kind==="stadium"?190:125} ry="40" fill="#10291d" opacity=".35"/><g transform="translate(-90 -85)"><Building kind={place.kind}/></g><rect x="-116" y="54" width="232" height="38" rx="19" fill="#12281e" stroke="#d5b76b" strokeOpacity=".65"/><text y="79" textAnchor="middle" fill="#f7f0db" fontSize="19" fontWeight="700">{place.name}</text><circle cy="-84" r="12" fill="#e7c16a" stroke="#263c2b" strokeWidth="5"/></g>)}
              </g><g data-layer="characters">{(data.presence||[]).filter((p)=>p.playerId!==data.playerId).map((p)=><g key={p.playerId} transform={"translate("+p.x+" "+p.y+")"} className="gg-world-player-marker" role="button" tabIndex="0" aria-label={"View "+p.displayName} onPointerDown={(e)=>e.stopPropagation()} onClick={()=>setSelectedPlayer(p)} onKeyDown={(e)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelectedPlayer(p);}}}><circle cy="-23" r="23" fill="#e5bf68" opacity=".18"/><foreignObject x="-20" y="-58" width="40" height="46"><div xmlns="http://www.w3.org/1999/xhtml" className="gg-map-character"><PlayerSprite appearance={p.appearance||{}}/></div></foreignObject><text y="12" textAnchor="middle" fill="#fff5dd" fontSize="13" stroke="#1b3326" strokeWidth="4" paintOrder="stroke">{p.displayName.slice(0,12)}</text></g>)}
              {data.playerId && <g pointerEvents="none"><foreignObject x={playerPosition.x-24} y={playerPosition.y-62} width="48" height="58"><div xmlns="http://www.w3.org/1999/xhtml" className="gg-map-character"><PlayerSprite appearance={appearance}/></div></foreignObject><text x={playerPosition.x} y={playerPosition.y+8} textAnchor="middle" fill="#fff5dd" fontSize="14" stroke="#1b3326" strokeWidth="4" paintOrder="stroke">{avatar.displayName||"YOU"}</text></g>}
            </g>
            </g>
          </svg>
        </div>
        <div className="gg-world-map-footer"><span>↔ Drag to explore</span><span>Scroll or + / − to zoom</span><span>Tap a landmark to enter</span><span>WASD / arrows move your player</span></div><div className="gg-world-movement"><span>MOVE YOUR PLAYER</span><div><button type="button" onClick={()=>movePlayer(0,-24)} aria-label="Move up">↑</button><div><button type="button" onClick={()=>movePlayer(-24,0)} aria-label="Move left">←</button><button type="button" onClick={()=>movePlayer(0,24)} aria-label="Move down">↓</button><button type="button" onClick={()=>movePlayer(24,0)} aria-label="Move right">→</button></div></div></div>
      </section>
      <section className="gg-world-districts"><div className="gg-world-section-title"><span>EXPLORE THE KINGDOM</span><h2>Choose your next stop</h2></div><div className="gg-world-location-grid">{mapPlaces.map((p)=><button key={p.id} className="gg-world-location-card" onClick={()=>focusPlace(p)}><span className="gg-world-location-icon">{({hq:"♛",stadium:"⚽",training:"✦",club:"♜",home:"⌂",academy:"⚑",market:"◇",park:"♧",plaza:"◇",plot:"▧",museum:"🏆",transit:"↔","fan-zone":"🎉",esports:"🎮","community-pitch":"⚽"})[p.kind]}</span><span><strong>{p.name}</strong><small>{p.desc}</small></span><b>→</b></button>)}</div></section>
      <section className="gg-world-panel"><div className="gg-world-section-title"><span>YOUR FOOTBALL IDENTITY</span><h2>Build your player character</h2><p>A pixel footballer that represents you around the city.</p></div><div className="gg-world-avatar-card"><div className="gg-world-avatar-preview"><PlayerSprite appearance={appearance}/><strong>{avatar.displayName||"Your player"}</strong><small>ORIGINAL GG PLAYER</small></div><form className="gg-world-form" onSubmit={saveAvatar}><label>Character name<input maxLength="24" value={avatar.displayName||""} onChange={(e)=>setAvatar((v)=>({...v,displayName:e.target.value}))} placeholder="Name your footballer"/></label><div className="gg-world-select-grid">
        <label>Skin tone<select value={appearance.skinTone||"medium"} onChange={(e)=>changeAppearance("skinTone",e.target.value)}>{["deep","dark","medium","tan","light","fair"].map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Build<select value={appearance.bodyType||"athletic"} onChange={(e)=>changeAppearance("bodyType",e.target.value)}>{["slim","athletic","stocky"].map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Hair style<select value={appearance.hairStyle||"short"} onChange={(e)=>changeAppearance("hairStyle",e.target.value)}>{["short","fade","curly","long","afro","mohawk","bald"].map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Hair colour<select value={appearance.hairColor||"black"} onChange={(e)=>changeAppearance("hairColor",e.target.value)}>{["black","brown","blonde","red","silver","blue"].map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Kit colour<select value={appearance.kitPrimary||"black"} onChange={(e)=>changeAppearance("kitPrimary",e.target.value)}>{["black","white","gold","red","blue","green","purple","orange"].map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Kit trim<select value={appearance.kitSecondary||"gold"} onChange={(e)=>changeAppearance("kitSecondary",e.target.value)}>{["black","white","gold","red","blue","green","purple","orange"].map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Boots<select value={appearance.bootColor||"white"} onChange={(e)=>changeAppearance("bootColor",e.target.value)}>{["black","white","gold","red","blue","green","orange"].map(v=><option key={v}>{v}</option>)}</select></label>
      </div><button className="gg-world-primary" disabled={saving || !data.canCreateCharacter}>{!data.canCreateCharacter?"Link your GG player profile first":saving?"Saving…":"Save player character"}</button></form></div></section>
      <section className="gg-world-panel"><div className="gg-world-section-title"><span>TRAINING GROUNDS</span><h2>Your training record</h2><p>Log completed sets and track your totals. Entries are validated and saved by the server.</p></div><div className="gg-world-training-grid"><form className="gg-world-training-form" onSubmit={saveWorkout}><h3>Record a workout</h3><div className="gg-world-counter-grid">{exercises.map(([key,label])=><label key={key}>{label}<input type="number" min="0" max="1000" step="1" value={training[key]} onChange={(e)=>setTraining((v)=>({...v,[key]:e.target.value}))} placeholder="0"/></label>)}</div><label className="gg-world-duration">Duration (seconds)<input type="number" min="1" max="28800" value={duration} onChange={(e)=>setDuration(e.target.value)}/></label><button className="gg-world-primary" disabled={saving || !data.canCreateCharacter}>{!data.canCreateCharacter?"Link your GG player profile first":saving?"Saving…":"Save workout"}</button></form><div className="gg-world-training-stats"><h3>All-time counters</h3><div className="gg-world-stat-grid">{exercises.map(([key,label])=><div key={key}><span>{label}</span><strong>{data.training?.totals?.[key]||0}</strong><small>Best {data.training?.personalBests?.[key]||0}</small></div>)}</div><div className="gg-world-total"><span>TOTAL COUNTS</span><strong>{data.training?.totals?.totalCounts||0}</strong><small>{data.training?.totals?.sessions||0} workouts logged</small></div><div className="gg-world-training-history"><h3>Recent sessions</h3>{(data.trainingHistory||[]).length===0?<p>No workouts logged yet. Your first session will appear here.</p>:(data.trainingHistory||[]).map((session)=><div key={session.sessionId}><span>{new Date(session.recordedAt).toLocaleDateString()}</span><strong>{session.totalCounts} counters</strong><small>{Math.round(session.durationSeconds/60)} min</small></div>)}</div></div></div></section>
      {data.canCreateCharacter && <WorldEconomyPanel onEquipped={(appearance)=>setAvatar((current)=>({...current,appearance}))} />}
      <TrainingChallenge />
      {notice && <p className="gg-world-notice" role="status">{notice}</p>}
    </>}
    {selectedPlace && <div className="gg-world-modal-backdrop" onClick={()=>setSelected(null)}><section className="gg-world-building-modal" role="dialog" aria-modal="true" onClick={(e)=>e.stopPropagation()}><button className="gg-world-modal-close" onClick={()=>setSelected(null)} aria-label="Close">×</button><span>ORIGINAL GG LANDMARK</span><div className="gg-world-modal-art"><Building kind={selectedPlace.kind}/></div><h2>{selectedPlace.name}</h2><p>{selectedPlace.desc}</p>{selectedPlace.id.startsWith("home-") ? selectedPlace.ownerPlayerId===data.playerId ? <button className="gg-world-primary" disabled={interiorLoading} onClick={()=>openResidence(selectedPlace)}>{interiorLoading?"Opening home…":"Enter your private home"}</button> : <p className="gg-world-coming">Private interior · the exterior is public, but only the owner can enter this home.</p> : selectedPlace.kind==="plot" ? <p className="gg-world-coming">Planned {selectedPlace.category} plot · {selectedPlace.desc} Plot ownership and construction are part of a later world-building phase.</p> : selectedPlace.clubId ? <button className="gg-world-primary" disabled={interiorLoading} onClick={()=>openClubGround(selectedPlace)}>{interiorLoading?"Checking club access…":"Enter club ground"}</button> : selectedPlace.interior ? <><button className="gg-world-primary" disabled={interiorLoading} onClick={()=>openWorldInterior(selectedPlace)}>{interiorLoading?"Opening building…":"Enter "+selectedPlace.name}</button>{selectedPlace.kind==="training" && <button className="gg-world-interior-secondary" onClick={()=>{setSelected(null);document.querySelector(".gg-world-training-form")?.scrollIntoView({behavior:"smooth"});}}>Jump to workout counters</button>}</> : <p className="gg-world-coming">This landmark will receive its own interactive interior in a later build.</p>}</section></div>}
    {selectedPlayer && <div className="gg-world-modal-backdrop" onClick={()=>setSelectedPlayer(null)}><section className="gg-world-player-card" role="dialog" aria-modal="true" onClick={(event)=>event.stopPropagation()}><button className="gg-world-modal-close" onClick={()=>setSelectedPlayer(null)} aria-label="Close player card">×</button><div className="gg-world-player-card-avatar"><PlayerSprite appearance={selectedPlayer.appearance||{}}/></div><span>LIVE IN ORIGINAL GG</span><h2>{selectedPlayer.displayName}</h2><p>Currently exploring the football city.</p><small>More player stats, club badges and character interactions are coming in the social-world phase.</small></section></div>}
    {interior && <div className="gg-world-modal-backdrop" onClick={()=>setInterior(null)}><section className="gg-world-interior-dialog" role="dialog" aria-modal="true" aria-labelledby="gg-world-interior-title" onClick={(event)=>event.stopPropagation()}><header><div><span>{interior.type==="residence"?"PRIVATE PLAYER RESIDENCE":"ORIGINAL GG INTERIOR"} · LEVEL {interior.level}</span><h2 id="gg-world-interior-title">{interior.name}</h2></div><button className="gg-world-modal-close" onClick={()=>setInterior(null)} aria-label="Close home">×</button></header><div className="gg-world-interior-rooms">{(interior.interior?.rooms||[]).map((room)=><article key={room.id}><div className="gg-world-room-art"><RoomScene room={room}/></div><h3>{room.name}</h3><p>{room.description || (room.id==="trophy-room"?"A wall for the moments and silverware you earn.":room.id==="training-corner"?"Your personal corner for training goals and records.":"A place to relax, meet visitors and show your club colours.")}</p><div>{(room.items||[]).map((item)=><small key={item}>{item.replaceAll("-"," ")}</small>)}{(room.id==="club-lounge"||room.id==="grand-hall")&&<button className="gg-world-room-chat" onClick={onOpenChat}>Open community chat</button>}</div></article>)}</div><p className="gg-world-coming">Your residence layout is saved in the Clubs database. Room furnishing and visitor permissions are coming in the next phase.</p></section></div>}
    {data?.avatar && !data.avatar.tutorialComplete && !tutorialClosed && <div className="gg-world-guide" role="dialog" aria-modal="true" aria-labelledby="gg-world-guide-title"><div className="gg-world-guide-character"><PlayerSprite appearance={appearance}/></div><div className="gg-world-guide-copy"><span>YOUR GG COMPANION · QUICK TOUR {tutorialStep+1}/3</span><h2 id="gg-world-guide-title">{["Welcome to Original GG!","Meet your player character.","Your training journey starts here."][tutorialStep]}</h2><p>{["This is your football city. Drag the map, pinch to zoom on mobile, and tap a landmark to explore its building.","Customise your footballer with a name, hairstyle, skin tone, kit and boots. Your look is saved to your player account.","Visit the Training Centre to record push-ups, pull-ups, squats and plank holds. Your totals and personal bests are saved in the Clubs database."][tutorialStep]}</p><div><button className="gg-world-guide-skip" onClick={completeTutorial}>Skip tour</button><button className="gg-world-primary" onClick={()=>tutorialStep===2?completeTutorial():setTutorialStep((step)=>step+1)}>{tutorialStep===2?"Finish tour":"Next tip →"}</button></div></div></div>}
    <footer className="gg-world-footer">GG MATCHDAY · ORIGINAL GG WORLD <span>Built for the players, by the players.</span></footer>
  </main>;
}
