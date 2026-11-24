import { companionLook } from "../../../shared/companion";
import "./player.css";

const complexions = {
  sand: ["#e5ac7c", "#a96952"],
  copper: ["#bd815f", "#834c40"],
  umber: ["#98624d", "#603830"],
};

const hair = {
  striker: "M18 13v-5h3V5h10v2h4v3h2v6h-3v-4h-4v-2h-5v2h-4v3h-3Z",
  playmaker: "M17 14v-5h2V6h3V4h4v1h3V4h4v2h3v3h2v6h-4v-3h-4v-2h-5v2h-4v3h-4Z",
};
const frontShirt = "M18 23h5v2h8v-2h5v2h4v3h3v7h-6v10H17V35h-6v-7h3v-3h4Z";
const sideShirt = "M22 23h9v2h4v3h3v7h-4v10H20v-5h-2V28h2v-3h2Z";

export default function CompanionPlayer({ look, action, kit, temporaryKit, facing }) {
  const profile = companionLook(look);
  const [skin, shadow] = complexions[profile.complexion];

  return <svg className="gg-footballer" viewBox="0 0 54 64" shapeRendering="crispEdges" aria-hidden="true"
    data-kit={kit || profile.kit} data-temporary-kit={temporaryKit} data-action={action}
    data-facing={facing} data-celebration={profile.celebration}
    style={{ "--player-skin": skin, "--player-skin-shadow": shadow }}>
    <path className="gg-player-shadow" d="M15 61h24v1h-3v1H18v-1h-3Z" />
    <g className="gg-player-art">
      <g className="gg-player-direction">
        <g className="gg-player-leg gg-player-leg--left">
          <path className="gg-pixel-outline" d="M17 46h10v14h-2v2H12v-5h3v-6h2Z" />
          <path fill="var(--player-skin-shadow)" d="M19 47h6v6h-7v-2h1Z" />
          <path fill="var(--player-socks)" d="M17 52h8v6h-8Z" />
          <path className="gg-pixel-trim" d="M17 53h8v1h-8Z" />
          <path fill="var(--player-boot)" d="M15 57h10v2h-2v1H14v-2h1Z" />
          <path className="gg-pixel-trim" d="M16 58h6v1h-6Z" />
        </g>
        <g className="gg-player-leg gg-player-leg--right">
          <path className="gg-pixel-outline" d="M28 46h9v6h2v5h4v5H30v-2h-2Z" />
          <path fill="var(--player-skin)" d="M30 47h5v5h2v1h-7Z" />
          <path fill="var(--player-socks)" d="M30 52h7v6h-7Z" />
          <path className="gg-pixel-trim" d="M30 53h7v1h-7Z" />
          <path fill="var(--player-boot)" d="M30 57h10v1h1v2H32v-1h-2Z" />
          <path className="gg-pixel-side-boot" fill="var(--player-boot)" d="M30 57h9v1h4v2H29v-2h1Z" />
          <path className="gg-pixel-trim" d="M33 58h6v1h-6Z" />
        </g>
        <path className="gg-pixel-outline" d="M17 39h20v6h2v5H29v-2h-4v2H15v-5h2Z" />
        <path fill="var(--player-shorts)" d="M19 40h16v6h2v2h-7v-3h-6v3h-7v-2h2Z" />
        <path className="gg-pixel-trim" d="M18 43h2v5h-2Zm16 0h2v5h-2Z" />
        <g className="gg-player-arm gg-player-arm--left">
          <path className="gg-pixel-outline" d="M13 29h8v6h-2v5h-3v5h-6v-8h2v-4h1Z" />
          <path fill="var(--player-skin-shadow)" d="M14 32h5v3h-2v4h-2v4h-3v-5h2Z" />
          <path className="gg-pixel-trim" d="M11 40h5v1h-5Z" />
          <path className="gg-player-finger" fill="var(--player-skin)" d="M11 43h2v4h-2Z" />
        </g>
        <g className="gg-player-arm gg-player-arm--right">
          <path className="gg-pixel-outline" d="M34 29h7v5h2v4h2v7h-7v-5h-2v-5h-2Z" />
          <path fill="var(--player-skin)" d="M36 32h3v3h2v4h2v4h-3v-4h-2v-5h-2Z" />
          <path className="gg-pixel-trim" d="M39 40h5v1h-5Z" />
          <path className="gg-player-finger" fill="var(--player-skin)" d="M42 43h2v4h-2Z" />
        </g>
        <path fill="var(--player-skin-shadow)" d="M23 18h8v9h-8Z" />
        <g className="gg-player-jersey gg-pixel-front">
          <path className="gg-pixel-outline" d={frontShirt} />
          <path fill="var(--player-kit)" d="M18 25h6v2h6v-2h6v2h4v2h1v4h-6v10H19V33h-6v-4h3v-2h2Z" />
          <path fill="var(--player-panel)" d="M19 33h5v5h6v-5h5v10H19Z" />
          <path className="gg-player-stripes" fill="var(--player-panel)" d="M20 27h4v16h-4Zm10 0h4v16h-4Z" />
          <path className="gg-pixel-trim gg-pixel-glow" d="M15 31h4v2h-5v-1h1Zm20 0h4v1h1v1h-5ZM20 34h2v7h-2Zm12 0h2v7h-2Z" />
          <path fill="var(--player-number)" d="M23 26h2v1h4v-1h2v2h-2v1h-4v-1h-2Zm8 3h2v2h-2Z" />
          <path className="gg-pixel-back" fill="var(--player-number)" d="M23 30h8v1h-8Z" />
          <path className="gg-player-number-default" fill="var(--player-number)" d="M24 33h2v1h-2v3h2v-1h-1v-1h2v3h-3v-1h-1v-3h1Zm5 0h2v1h-2v3h2v-1h-1v-1h2v3h-3v-1h-1v-3h1Z" />
          <path className="gg-player-number-madrid" fill="var(--player-number)" d="M24 32h7v2h-2v2h-1v4h-2v-5h1v-1h-3Z" />
          <path className="gg-player-number-barcelona" fill="var(--player-number)" d="M22 33h2v-1h2v8h-2v-5h-2Zm6-1h5v8h-5Zm2 2v4h1v-4Z" fillRule="evenodd" />
        </g>
        <g className="gg-player-jersey gg-pixel-profile">
          <path className="gg-pixel-outline" d={sideShirt} />
          <path fill="var(--player-kit)" d="M23 25h8v2h3v2h2v4h-4v10H22v-5h-2v-9h2v-3h1Z" />
          <path fill="var(--player-panel)" d="M21 32h5v9h6v2H22v-5h-1Z" />
          <path className="gg-pixel-trim gg-pixel-glow" d="M23 27h7v1h-7Zm-1 3h2v3h-2Zm8 3h2v8h-2Zm-8 8h8v1h-8Z" />
        </g>
        <g className="gg-pixel-front gg-pixel-head">
          <path className="gg-pixel-outline" d="M20 5h13v2h4v4h2v7h-3v3h-3v2H22v-2h-3v-3h-3v-7h3V7h1Z" />
          <path fill="var(--player-skin)" d="M20 10h14v3h2v3h-2v3h-3v2h-8v-2h-3v-3h-2v-3h2Z" />
          <path fill="var(--player-skin-shadow)" d="M20 16h2v3h3v1h6v1h-8v-2h-3Zm9 1h3v1h-3Z" />
          <path fill="#241e2c" d={hair[profile.style]} />
          <path fill="#4f3b49" d="M22 8h6v1h-6Zm8-1h3v1h-3Z" />
          <path className="gg-player-pupils" fill="#211927" d="M22 13h3v2h-3Zm8 0h3v2h-3Z" />
          <path className="gg-pixel-back" fill="#241e2c" d="M20 10h15v8h-2v2H22v-2h-2Z" />
          <path className="gg-pixel-back" fill="#4f3b49" d="M22 11h11v1H22Zm2 5h7v1h-7Z" />
        </g>
        <g className="gg-pixel-profile gg-pixel-head">
          <path className="gg-pixel-outline" d="M21 5h12v2h3v5h2v4h-2v3h-3v3H22v-3h-3V8h2Z" />
          <path fill="var(--player-skin)" d="M23 10h11v3h2v2h-2v3h-3v2h-7v-2h-3v-4h2Z" />
          <path fill="var(--player-skin-shadow)" d="M24 17h3v2h4v1h-7Zm7 0h3v1h-3Z" />
          <path fill="#241e2c" d={profile.style === "playmaker" ? "M20 14V8h2V5h3V4h4v1h4v2h3v5h-3v-2h-5v3h-3v3h-4v-2Z" : "M20 15V8h3V6h10v2h3v4h-4v-2h-5v2h-2v4h-3v-1Z"} />
          <path fill="#584451" d="M23 8h7v1h-7Z" />
          <path className="gg-player-pupils" fill="#211927" d="M31 13h2v2h-2Z" />
        </g>
      </g>
    </g>
    <g className="gg-player-kit-flare">
      <path fill="#f87a4c" d="M10 43h3v-6h3v-5h2v6h3v-3h3v-7h2v6h2v6h4v-4h2v-6h3v5h3v-8h2v9h3v6h-4v4H14v-2h-4Z" />
      <path fill="#ffe6a0" d="M16 42h5v-4h3v3h5v-4h3v4h5v-5h3v7h-4v2H18v-1h-2Z" />
      <path className="gg-pixel-trim" d="M11 31h3v2h-3Zm29-8h3v3h-3Zm-17 1h2v2h-2Z" />
    </g>
  </svg>;
}
