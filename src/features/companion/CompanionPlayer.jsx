import { useId } from "react";
import { companionLook } from "../../../shared/companion";
import "./player.css";

const complexions = { sand: "#eab082", copper: "#bd805c", umber: "#91583f" };
const shirt = "M29 47 36 44h12l7 3 10 9-8 8-5-4 2 12H30l2-12-5 4-8-8Z";
const hairlines = {
  striker: "M23 28 20 19 24 12 31 9 38 10 48 7 57 12 62 17 61 28 56 24 54 18 46 20 39 17 30 23 27 28Z",
  playmaker: "M23 28 21 24 20 17 24 13 27 8 34 9 40 5 48 8 54 8 60 13 64 19 60 28 55 25 54 19 46 21 39 20 33 23 27 23Z",
};

export default function CompanionPlayer({ look, action, kit, temporaryKit }) {
  const id = useId();
  const profile = companionLook(look);
  const shade = id + "-shade";
  const flare = id + "-flare";
  const shirtClip = id + "-shirt";

  return <svg className="gg-footballer" viewBox="0 0 84 96" aria-hidden="true"
    data-kit={kit || profile.kit} data-temporary-kit={temporaryKit} data-action={action}
    data-celebration={profile.celebration} style={{ "--player-skin": complexions[profile.complexion] }}>
    <defs>
      <linearGradient id={shade} x2=".8" y2="1">
        <stop stopColor="#fff" stopOpacity=".27" />
        <stop offset=".58" stopColor="#fff" stopOpacity="0" />
        <stop offset="1" stopColor="#101726" stopOpacity=".35" />
      </linearGradient>
      <linearGradient id={flare} x1="0" x2="1" y1="1" y2="0">
        <stop stopColor="#e94d32" />
        <stop offset=".49" stopColor="#ffbb58" />
        <stop offset="1" stopColor="#fff0ba" />
      </linearGradient>
      <clipPath id={shirtClip}><path d={shirt} /></clipPath>
    </defs>
    <ellipse className="gg-player-shadow" cx="42" cy="93" rx="21" ry="2.4" />
    <g className="gg-player-art" stroke="#131921" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
      <g className="gg-player-leg gg-player-leg--left">
        <path fill="var(--player-skin)" d="M29 72h11l-1 7h-9Z" />
        <path fill="var(--player-socks)" d="M30 77h9l-1 13h-9Z" />
        <path d="M30 79h8m-8 3h8" stroke="var(--player-trim)" strokeWidth="1" />
        <path fill="var(--player-boot)" d="M30 87h9l1 5H22l1-3 5-1Z" />
        <path d="M25 90h6m1-2h3" stroke="var(--player-trim)" strokeWidth="1" />
      </g>
      <g className="gg-player-leg gg-player-leg--right">
        <path fill="var(--player-skin)" d="M44 72h11l-1 7h-9Z" />
        <path fill="var(--player-socks)" d="M45 77h9l1 13h-9Z" />
        <path d="M46 79h8m-8 3h8" stroke="var(--player-trim)" strokeWidth="1" />
        <path fill="var(--player-boot)" d="M45 87h9l3 2 5 1v2H44Z" />
        <path d="M53 90h5m-9-2h3" stroke="var(--player-trim)" strokeWidth="1" />
      </g>
      <path fill="var(--player-shorts)" d="M30 68h24l3 10H45l-3-6-3 6H27Z" />
      <path d="m29 74 1-6m25 6-1-6" stroke="var(--player-trim)" strokeWidth="1.15" opacity=".75" />
      <g className="gg-player-arm gg-player-arm--left">
        <path fill="var(--player-skin)" d="m24 54 6 5-5 7-5 5-4-2 3-6Z" />
        <path d="m18 67 4 2" stroke="var(--player-trim)" strokeWidth="2" />
        <path className="gg-player-finger" fill="var(--player-skin)" d="m17 67-4 7 2 1 5-5Z" />
      </g>
      <g className="gg-player-arm gg-player-arm--right">
        <path fill="var(--player-skin)" d="m60 54-6 5 5 7 5 5 4-2-3-6Z" />
        <path d="m66 67-4 2" stroke="var(--player-trim)" strokeWidth="2" />
        <path className="gg-player-finger" fill="var(--player-skin)" d="m67 67 4 7-2 1-5-5Z" />
      </g>
      <path fill="var(--player-skin)" d="M37 38h10l1 9-6 5-6-5Z" />
      <g className="gg-player-jersey">
        <path fill="var(--player-kit)" d={shirt} />
        <g clipPath={`url(#${shirtClip})`} stroke="none">
          <path className="gg-player-bib" fill="var(--player-panel)" d="M20 47h14l8 8 8-8h14v7L42 65 20 54Z" />
          <path className="gg-player-stripes" fill="var(--player-panel)" d="M31 43h6v30h-6zm11 0h6v30h-6zm11 0h6v30h-6z" />
          <path fill={`url(#${shade})`} d="M19 44h46v29H19z" />
        </g>
        <path d="m36 45 6 5 6-5m-25 13 5 4m33-4-5 4" fill="none" stroke="var(--player-trim)" strokeWidth="1.5" />
        <path d="M48 53h5l-1 4-1.5 1-1.5-1Z" fill="var(--player-trim)" stroke="none" />
        <text x="42" y="67" textAnchor="middle" stroke="none" fill="var(--player-number)" fontSize="9" fontWeight="900">
          <tspan className="gg-player-number-default">GG</tspan>
          <tspan className="gg-player-number-madrid" x="42">7</tspan>
          <tspan className="gg-player-number-barcelona" x="42">10</tspan>
        </text>
      </g>
      <path fill="var(--player-skin)" d="M25 24q-8-3-8 4 0 5 8 6m34-10q8-3 8 4 0 5-8 6" />
      <path fill="var(--player-skin)" d="M25 16 32 11h20l7 6 1 14-4 10-8 6H36l-8-6-4-10Z" />
      <path fill={`url(#${shade})`} stroke="none" d="M25 16 32 11h20l7 6 1 14-4 10-8 6H36l-8-6-4-10Z" />
      <path fill="#252331" d={hairlines[profile.style]} />
      <path d="m26 17 6-3 8 1m5-3 7 1 4 4" stroke="#776272" opacity=".66" fill="none" />
      <path d="M30 25q3-2 7 0m10 0q4-2 7 0" fill="none" strokeWidth="1.6" />
      <g className="gg-player-eyes" stroke="none">
        <path fill="#fff5e7" d="M29 29q4-4 9 0-1 4-5 4-3 0-4-4Zm17 0q5-4 9 0-1 4-4 4-4 0-5-4Z" />
        <g className="gg-player-pupils" fill="#202434">
          <circle cx="34" cy="30" r="2.1" />
          <circle cx="50" cy="30" r="2.1" />
        </g>
      </g>
      <path d="m41 32-1 4h3m-5 3q4 2 8-1" stroke="#754638" strokeWidth="1" fill="none" />
    </g>
    <g className="gg-player-kit-flare" fill={`url(#${flare})`}>
      <path d="M19 78q-8-9 4-17-3 6 2 8-1-7 7-13-3 10 6 12-10 3-19 10Z" />
      <path d="M43 66q17-4 17-15 4 3 3 9 4-2 7-8 3 8-1 14-10 8-26 0Z" />
      <path d="m25 49 3 3-1 4-3-3Zm35-7 2 4-2 3-2-3Zm-20 7 1 3-2 2-1-3Z" />
    </g>
  </svg>;
}
