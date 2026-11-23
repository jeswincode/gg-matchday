import { paths, stops } from "../../../shared/communityWorld";

export default function WorldMap() {
  return <svg className="gg-campus-art" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <pattern id="campus-grass" width="40" height="22" patternUnits="userSpaceOnUse">
        <path d="M5 10h2m21 8h2m5-15h2" stroke="#a6bc8a" strokeWidth="1.5" opacity=".28" />
      </pattern>
      <pattern id="campus-turf" width="64" height="128" patternUnits="userSpaceOnUse">
        <path fill="#3d7654" d="M0 0h64v128H0z" /><path fill="#4c835b" d="M0 0h32v128H0z" />
      </pattern>
      <pattern id="campus-stands" width="10" height="10" patternUnits="userSpaceOnUse">
        <path d="M0 0h10v10H0z" fill="#55585c" /><path d="M0 2h10m0 5H0" stroke="#838788" />
      </pattern>
    </defs>
    <path fill="#263e36" d="M0 0h1000v600H0z" />
    <path fill="#385543" d="M0 45 204 25l80 214-28 232-151 129H0zm1000 45L792 25l-82 213 26 231 149 141h115z" />
    <path fill="url(#campus-grass)" d="M0 0h1000v600H0z" />
    <path d="M300 210V37q0-19 24-19h352q24 0 24 19v173z" fill="#182520" />
    <path d="M316 195V40q0-10 11-10h346q11 0 11 10v155z" fill="url(#campus-stands)" stroke="#b2b39b" strokeWidth="3" />
    <path d="M350 44h300v110H350z" fill="url(#campus-turf)" stroke="#d1e6bd" strokeWidth="2" />
    <path d="M500 44v110m-150-80h46v51h-46m300-51h-46v51h46" fill="none" stroke="#cae2b8" strokeWidth="2" />
    <ellipse cx="500" cy="99" rx="30" ry="19" fill="none" stroke="#cae2b8" strokeWidth="2" />
    <path d="M339 46h-13v105h13m322-105h13v105h-13M312 163h154m68 0h154" fill="none" stroke="#d4cba4" strokeWidth="4" />
    <g strokeLinecap="round" strokeLinejoin="round">
      {paths.map(([from, to]) => <path key={from + to} d={`M${stops[from].x * 10} ${stops[from].y * 6} ${stops[to].x * 10} ${stops[to].y * 6}`}
        stroke="#222a29" strokeWidth={from === "stadium" && to === "pitch" ? 14 : 30} />)}
      {paths.map(([from, to]) => <path key={from + to} d={`M${stops[from].x * 10} ${stops[from].y * 6} ${stops[to].x * 10} ${stops[to].y * 6}`}
        stroke="#aeaa8c" strokeWidth={from === "stadium" && to === "pitch" ? 8 : 24} />)}
    </g>
    <path d="M410 377h180l22 28-22 31H410l-22-31z" fill="#89806a" stroke="#e0caa0" strokeWidth="3" />
    <ellipse cx="500" cy="397" rx="32" ry="13" fill="#76a4a5" stroke="#c5b893" strokeWidth="4" />
    <path d="M500 375v20m-13 0 13-20 13 20" stroke="#d0ece2" strokeWidth="2" fill="none" />
    <path d="M84 322h192v45H84z" fill="#806347" stroke="#322a22" strokeWidth="3" />
    <path d="m76 322 27-32h154l27 32z" fill="#a36f4e" stroke="#322a22" strokeWidth="3" />
    <path d="M115 309h133m-132 34h24m12 0h24m53 0h24m-66 1h25v23" stroke="#e7cc9a" strokeWidth="6" />
    <path d="M744 283h153v87H744z" fill="url(#campus-turf)" stroke="#182520" strokeWidth="11" />
    <path d="M752 290h137v72H752zm68 0v72m-68-50h25v28h-25m137-28h-25v28h25" fill="none" stroke="#c3d9ae" strokeWidth="2" />
    <ellipse cx="820" cy="326" rx="13" ry="10" fill="none" stroke="#c3d9ae" strokeWidth="2" />
    <path d="M432 532h14v31h-14zm122 0h14v31h-14z" fill="#d6c9a4" />
    <path d="M438 535q62-42 124 0" stroke="#c0a171" strokeWidth="8" fill="none" />
    <g stroke="#1d332a" strokeWidth="3">
      {[[68,120],[118,145],[185,119],[239,149],[75,250],[268,260],[99,445],[169,468],[251,445],[303,496],
        [915,119],[858,145],[790,118],[731,158],[930,248],[711,271],[923,438],[845,460],[746,447],[694,496]].map(([x,y], index) =>
        <g key={x} transform={`translate(${x} ${y})`}>
          <ellipse cx="5" cy="11" rx="22" ry="11" fill="#172a24" opacity=".65" />
          <path d="M0-22q18 0 19 17T1 15q-22 0-20-18T0-22z" fill={index % 3 ? "#47794f" : "#648459"} />
          <path d="M-9-11q6-7 13-3" stroke="#95a773" fill="none" />
        </g>)}
    </g>
  </svg>;
}
