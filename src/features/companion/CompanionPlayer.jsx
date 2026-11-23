import { useId } from "react";
import { companionLook } from "../../../shared/companion";
import "./player.css";

const skin = { sand: "#f0b780", copper: "#c78556", umber: "#9b5c42" };

export default function CompanionPlayer({ look, action, kit }) {
  const id = useId();
  const profile = companionLook(look);
  return <svg className="gg-footballer" data-kit={kit || profile.kit} data-action={action} data-celebration={profile.celebration}
    viewBox="0 0 80 92" aria-hidden="true" style={{ "--player-skin": skin[profile.complexion] }}>
    <defs>
      <linearGradient id={id} x2="0.85" y2="1">
        <stop stopColor="#fff" stopOpacity=".24" />
        <stop offset="1" stopColor="#101825" stopOpacity=".25" />
      </linearGradient>
      <clipPath id={id + "-shirt"}><path d="M27 45 34 42h12l8 3 6 11-11 5v9H31v-9l-11-5z" /></clipPath>
    </defs>
    <ellipse cx="40" cy="88" rx="19" ry="3.5" fill="#0a1010" opacity=".35" />
    <g className="gg-player-art" stroke="#191922" strokeWidth="1.7" strokeLinejoin="round">
      <g className="gg-player-leg gg-player-leg--left">
        <path fill="var(--player-socks)" d="M30 70h9l-1 13h-9z" />
        <path fill="#242735" d="M30 81h8v6H24c-3-2 0-6 6-6z" />
        <path stroke="#f9d990" d="M26 84h6" />
      </g>
      <g className="gg-player-leg gg-player-leg--right">
        <path fill="var(--player-socks)" d="M41 70h9l1 13h-9z" />
        <path fill="#242735" d="M42 81h8c6 0 9 4 6 6H42z" />
        <path stroke="#f9d990" d="M48 84h6" />
      </g>
      <path fill="#282937" d="M30 62h20l3 13H42l-2-5-2 5H27z" />
      <g className="gg-player-arm gg-player-arm--left">
        <path fill="var(--player-skin)" d="M24 51q-5 4-8 13c-.5 3 3 4 5 1l8-9z" />
        <path className="gg-player-finger" fill="var(--player-skin)" d="m17 64-4 5q-2 1-2-1l4-7z" />
      </g>
      <g className="gg-player-arm gg-player-arm--right">
        <path fill="var(--player-skin)" d="M56 51q5 4 8 13c.5 3-3 4-5 1l-8-9z" />
        <path className="gg-player-finger" fill="var(--player-skin)" d="m63 64 4 5q2 1 2-1l-4-7z" />
      </g>
      <g className="gg-player-jersey">
        <path fill="var(--player-kit)" d="M27 45 34 42h12l8 3 6 11-11 5v9H31v-9l-11-5z" />
        <g clipPath={`url(#${id}-shirt)`} stroke="none">
          <path className="gg-player-stripes" fill="var(--player-trim)" d="M33 43h5v28h-5zm9 0h5v28h-5z" />
          <path fill={`url(#${id})`} d="M20 42h40v28H20z" />
        </g>
        <path d="m34 44 6 4 6-4m-24 11 7 3m22 0 7-3" stroke="var(--player-trim)" fill="none" />
        <path d="M44 53h3v3l-1.5 1-1.5-1z" fill="var(--player-trim)" stroke="none" />
        <text x="39" y="64" textAnchor="middle" stroke="none" fill="var(--player-number)" fontSize="10" fontWeight="900">
          <tspan className="gg-player-number-default">GG</tspan><tspan className="gg-player-number-madrid" x="39">7</tspan><tspan className="gg-player-number-barcelona" x="39">10</tspan>
        </text>
      </g>
      <path fill="var(--player-skin)" d="M34 37h12v8q-6 6-12 0z" />
      <path fill="var(--player-skin)" d="M21 23c-10-4-10 10 0 11m38-11c10-4 10 10 0 11" />
      <path fill="var(--player-skin)" d="M19 17Q20 9 40 9t21 8v13c-1 12-10 16-21 16S20 42 19 30z" />
      <path fill={profile.style === "playmaker" ? "#3b251e" : "#241f2c"}
        d={profile.style === "playmaker"
          ? "M19 27q-9-11 1-17 1-8 9-6 5-6 13-3 9-2 12 4 12 1 10 13l-4 9-3-11q-8 4-14-2-8 7-19 3z"
          : "M19 27q-8-8-2-14 0-8 9-10l10-2 11 2 10 0-4 5q13 1 11 13l-4 6-4-11-9 3-19 0-4-1z"} />
      <path d="M26 10q9-5 23-3" fill="none" stroke="#fff" opacity=".18" />
      <path d="M25 23q4-3 8-1m14 0q4-2 8 1" fill="none" stroke="#312328" strokeLinecap="round" />
      <g className="gg-player-eyes" stroke="none">
        <ellipse cx="30" cy="29" rx="4.2" ry="4.6" fill="#fff7ea" />
        <ellipse cx="50" cy="29" rx="4.2" ry="4.6" fill="#fff7ea" />
        <g className="gg-player-pupils" fill="#252433">
          <ellipse cx="30" cy="29" rx="2.4" ry="3.2" /><ellipse cx="50" cy="29" rx="2.4" ry="3.2" />
        </g>
      </g>
      <path d="M36 36q4 4 8 0" fill="none" stroke="#713d36" strokeLinecap="round" />
    </g>
  </svg>;
}
