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
const characters = {
  captain: {
    front: "M18 14V8h3V6h13v1h3v7h-3v-3H21v3Z",
    side: "M19 14V8h3V6h12v1h3v6h-3v-2H23v3Z",
    color: "#353035", light: "#625450",
  },
  winger: {
    front: "M17 13V8h2V5h3V3h4v1h4V3h4v2h3v3h2v6h-4v-3h-3v1h-3v-2h-4v2h-4v2h-4Z",
    side: "M18 14V8h2V5h4V3h4v1h4V3h3v3h3v2h2v4h-5v-1h-4v1h-3v-2h-5v4Z",
    color: "#402931", light: "#8f5948",
  },
};
const frontShirt = "M18 23h5v2h8v-2h5v2h4v3h3v7h-6v10H17V35h-6v-7h3v-3h4Z";
const sideShirt = "M20 23h5v2h7v-2h4v2h4v3h2v6h-6v10H18v-7h-1v-3h-4v-5h3v-3h4Z";

export default function CompanionPlayer({ look, action, kit, temporaryKit, facing }) {
  const profile = companionLook(look);
  const [skin, shadow] = complexions[profile.complexion];
  const character = characters[profile.character];

  return <svg className="gg-footballer" viewBox="0 0 54 64" shapeRendering="crispEdges" aria-hidden="true"
    data-kit={kit || profile.kit} data-temporary-kit={temporaryKit} data-action={action}
    data-facing={facing} data-character={profile.character} data-player-style={profile.style}
    style={{ "--player-skin": skin, "--player-skin-shadow": shadow,
      "--player-hair": character?.color, "--player-hair-light": character?.light }}>
    <path className="gg-player-shadow" d="M17 61h20v1h-3v1H20v-1h-3Z" />
    <g className="gg-player-art">
      <g className="gg-player-direction">
        <g className="gg-player-leg gg-player-leg--left">
          <g className="gg-player-shin gg-player-shin--left">
            <path className="gg-pixel-outline" d="M19 47h7v11h-1v3H15v-3h2v-5h2Z" />
            <path fill="var(--player-skin-shadow)" d="M20 47h5v7h-6v-3h1Z" />
            <path fill="var(--player-socks)" d="M19 53h6v5h-6Z" />
            <path className="gg-pixel-trim" d="M19 54h5v1h-5Z" />
            <path className="gg-pixel-front" fill="var(--player-boot)" d="M18 57h7v3h-9v-1h2Z" />
            <path className="gg-pixel-profile" fill="var(--player-boot)" d="M19 57h6v1h2v2h-9v-2h1Z" />
            <path className="gg-pixel-trim" d="M19 59h4v1h-4Z" />
          </g>
          <g className="gg-player-short-leg">
            <path className="gg-pixel-outline" d="M18 41h9v8h-2v2h-8v-5h1Z" />
            <path fill="var(--player-shorts)" d="M19 42h7v6h-2v2h-6v-3h1Z" />
            <path className="gg-pixel-trim" d="M19 45h1v4h-1Z" />
          </g>
        </g>
        <g className="gg-player-leg gg-player-leg--right">
          <g className="gg-player-shin gg-player-shin--right">
            <path className="gg-pixel-outline" d="M29 47h7v6h1v5h3v3H30v-2h-1Z" />
            <path fill="var(--player-skin)" d="M30 47h5v6h1v1h-6Z" />
            <path fill="var(--player-socks)" d="M30 53h6v5h-6Z" />
            <path className="gg-pixel-trim" d="M31 54h5v1h-5Z" />
            <path className="gg-pixel-front" fill="var(--player-boot)" d="M30 57h7v1h2v2h-9Z" />
            <path className="gg-pixel-profile" fill="var(--player-boot)" d="M30 57h6v1h3v2h-9Z" />
            <path className="gg-pixel-trim" d="M33 59h4v1h-4Z" />
          </g>
          <g className="gg-player-short-leg">
            <path className="gg-pixel-outline" d="M28 41h9v5h1v5h-8v-2h-2Z" />
            <path fill="var(--player-shorts)" d="M29 42h7v5h1v3h-6v-2h-2Z" />
            <path className="gg-pixel-trim" d="M35 45h1v4h-1Z" />
          </g>
        </g>
        <path className="gg-pixel-front" fill="var(--player-shorts)" d="M19 41h16v4H19Z" />
        <path className="gg-pixel-profile" fill="var(--player-shorts)" d="M21 41h13v4H21Z" />
        <g className="gg-player-arm gg-player-arm--left">
          <path className="gg-pixel-outline" d="M13 29h8v6h-2v5h-3v5h-6v-8h2v-4h1Z" />
          <path fill="var(--player-skin-shadow)" d="M14 32h5v3h-2v4h-2v4h-3v-5h2Z" />
          <path className="gg-pixel-trim" d="M11 40h5v1h-5Z" />
          {profile.character === "captain" && <path className="gg-pixel-trim gg-pixel-glow" d="M13 34h5v2h-5Z" />}
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
          <path fill="var(--player-kit)" d="M20 25h5v2h7v-2h4v2h3v2h1v3h-6v10H20v-7h-2v-3h-3v-2h3v-3h2Z" />
          <path fill="var(--player-panel)" d="M17 30h4v5h2v5h11v2H20v-7h-2v-3h-3v-2Z" />
          <path className="gg-player-stripes" fill="var(--player-panel)" d="M23 28h3v13h-3Zm7 0h3v13h-3Z" />
          <path className="gg-pixel-trim gg-pixel-glow" d="M15 31h5v1h-5Zm20 0h5v1h-5ZM21 34h1v6h-1Zm10 0h2v6h-2Z" />
          <path fill="var(--player-number)" d="M25 26h2v2h4v-1h2v2h-3v1h-3v-1h-2Zm4 6h3v2h-1v1h-1v-1h-1Z" />
        </g>
        <g className="gg-pixel-front gg-pixel-head">
          <path className="gg-pixel-outline" d="M20 5h13v2h4v4h2v7h-3v3h-3v2H22v-2h-3v-3h-3v-7h3V7h1Z" />
          <path fill="var(--player-skin)" d="M20 10h14v3h2v3h-2v3h-3v2h-8v-2h-3v-3h-2v-3h2Z" />
          <path fill="var(--player-skin-shadow)" d="M20 16h2v3h3v1h6v1h-8v-2h-3Zm9 1h3v1h-3Z" />
          <path fill="var(--player-hair, #241e2c)" d={character?.front || hair[profile.style]} />
          <path fill="var(--player-hair-light, #4f3b49)" d="M22 8h6v1h-6Zm8-1h3v1h-3Z" />
          <path className="gg-player-pupils" fill="#211927" d="M22 13h3v2h-3Zm8 0h3v2h-3Z" />
          <path className="gg-pixel-back" fill="var(--player-hair, #241e2c)" d="M20 10h15v8h-2v2H22v-2h-2Z" />
          <path className="gg-pixel-back" fill="var(--player-hair-light, #4f3b49)" d="M22 11h11v1H22Zm2 5h7v1h-7Z" />
          {profile.character === "captain" && <path className="gg-front-detail" fill="var(--player-hair)" d="M21 17h2v2h8v-2h2v3h-2v2h-8v-2h-2Z" />}
          {profile.character === "winger" && <path className="gg-pixel-trim" d="M19 10h16v1H19Z" />}
        </g>
        <g className="gg-messi-kiss-hand">
          <path className="gg-pixel-outline" d="M37 31h5v-5h-3v-3h-4v-2h-3v-3h-4v3h2v4h4v3h3Z" />
          <path fill="var(--player-skin)" d="M39 30h2v-3h-3v-3h-4v-2h-3v-3h-2v2h2v3h4v3h4Z" />
          <path className="gg-pixel-trim" d="M34 24h2v2h-2Z" />
        </g>
        <g className="gg-pixel-profile gg-pixel-head">
          <path className="gg-pixel-outline" d="M21 5h13v2h3v5h2v5h-2v3h-3v2H23v-2h-3v-2h-2v-6h1V8h2Z" />
          <path fill="var(--player-skin)" d="M22 10h13v3h2v2h-1v3h-3v2H24v-2h-3v-2h-2v-3h3Z" />
          <path fill="var(--player-skin-shadow)" d="M20 14h2v3h2v2h9v1h-9v-2h-3v-2h-2v-2Zm12 3h3v1h-3Z" />
          <path fill="var(--player-hair, #241e2c)" d={character?.side || (profile.style === "playmaker"
            ? "M19 14V8h2V5h3V4h4v1h3V4h3v2h3v6h-4v-2h-6v2h-3v3h-3v-1Z"
            : "M19 14V8h3V5h10v1h3v2h2v4h-4v-2h-6v2h-3v3h-3v-1Z")} />
          <path fill="var(--player-hair-light, #584451)" d="M22 8h7v1h-7Zm9-1h3v1h-3Z" />
          <path className="gg-player-pupils" fill="#211927" d="M26 13h3v2h-3Zm7 0h2v2h-2Z" />
          <path fill="var(--player-skin-shadow)" d="M31 15h2v1h-2Z" />
          {profile.character === "captain" && <path fill="var(--player-hair)" d="M24 17h2v2h7v-2h2v2h-2v2h-7v-1h-2Z" />}
          {profile.character === "winger" && <path className="gg-pixel-trim" d="M20 10h15v1H20Z" />}
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
