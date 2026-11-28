import { useState } from "react";
import CommunityForm from "./CommunityForm";
import { submitCommunity } from "./communityApi";

export default function FootballIdentity({ identity, onSaved, setup = false }) {
  const { profile, email, linkNeedsReview } = identity;
  const [copyMessage, setCopyMessage] = useState("");

  async function copyId() {
    try {
      await navigator.clipboard.writeText(profile.username);
      setCopyMessage("Player ID copied.");
    } catch {
      setCopyMessage("Select and copy your player ID.");
    }
  }

  return <section className="gg-account-setting">
    {!setup && <h3>Football identity</h3>}
    <p className="muted">Use one player name and Player ID across your communities.{email && <> Signed in as {email}.</>}</p>
    {copyMessage && <p role="status">{copyMessage}</p>}
    {linkNeedsReview && <p role="status">Your GG Matchday player link needs an administrator to confirm it.</p>}
    <CommunityForm label={setup ? "Continue to communities" : "Save profile"} success="Profile saved." save={async data => {
      const username = String(data.get("username")).trim();
      const number = data.get("number");
      const foot = data.get("foot");
      const result = await submitCommunity("/me", {
        displayName: data.get("name"),
        username,
        ...(foot && { preferredFoot: foot }),
        ...(!setup && {
          bio: data.get("bio"),
          shirtNumber: number ? Number(number) : null,
          preferredPositions: String(data.get("positions")).split(",").map(item => item.trim()).filter(Boolean),
        }),
      }, null, "PATCH");
      onSaved(result);
    }}>
      <div className="community-fields">
        <label>Player name<input required name="name" maxLength={80} defaultValue={profile.displayName} /></label>
        <label>Player ID<input name="username" autoComplete="username" spellCheck={false} required
          pattern="[A-Za-z0-9_]{3,30}" maxLength={30} defaultValue={profile.username}
          aria-describedby="player-id-help" />
          <small id="player-id-help">Use 3–30 letters, numbers or underscores.</small>
        </label>
        {!setup && <>
        <label>Preferred positions<input name="positions" placeholder="ST, CM" defaultValue={profile.preferredPositions?.join(", ")} /></label>
        <label>Preferred foot<select name="foot" defaultValue={profile.preferredFoot || ""}>
          <option value="">Unspecified</option><option value="left">Left</option><option value="right">Right</option>
          <option value="both">Both</option>
        </select></label>
        <label>Shirt number<input name="number" type="number" min={1} max={99} defaultValue={profile.shirtNumber ?? ""} /></label>
        <label>Bio<textarea name="bio" maxLength={400} defaultValue={profile.bio} /></label>
        </>}
      </div>
    </CommunityForm>
    {!setup && profile.username && <button className="secondary-button community-copy-id" type="button" onClick={copyId}>Copy your Player ID</button>}
  </section>;
}
