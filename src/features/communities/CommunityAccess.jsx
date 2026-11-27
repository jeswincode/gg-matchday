import { useEffect, useState } from "react";
import CommunityForm from "./CommunityForm";
import { communityRequest, submitCommunity } from "./communityApi";

export default function CommunityAccess({ community }) {
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  const [invite, setInvite] = useState("");
  const [copied, setCopied] = useState("");
  const path = "/" + community.id;
  const requestLink = new URL("/", window.location.origin);
  requestLink.searchParams.set("joinCommunity", community.id);

  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      try {
        const items = await communityRequest(path + "/join-requests", { signal: controller.signal });
        if (!controller.signal.aborted) { setRequests(items); setError(""); }
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure.message);
      }
    }
    void refresh();
    function check() { if (!document.hidden) void refresh(); }
    const timer = window.setInterval(check, 20_000);
    window.addEventListener("focus", check);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", check); };
  }, [path]);

  async function copy(text, name) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(name + " copied.");
    } catch {
      setCopied("Select the text and copy it manually.");
    }
  }

  return <section className="card community-panel">
    <h2>Membership</h2>
    <div className="community-grid">
      <div>
        <h3>Invite someone</h3>
        <CommunityForm label="Generate invitation code" success="Invitation created." save={async () => {
          const result = await submitCommunity(path + "/invitation", {});
          setInvite(community.id + "." + result.token);
          setCopied("");
        }}>
          <p className="muted">Each code can be used once and expires after 24 hours.</p>
        </CommunityForm>
        {invite && <div className="community-copy">
          <label>Invitation code<input readOnly value={invite} onFocus={event => event.target.select()} /></label>
          <button type="button" className="secondary-button" onClick={() => copy(invite, "Invitation code")}>Copy code</button>
        </div>}
      </div>
      <div>
        <h3>Share a join request link</h3>
        <div className="community-copy">
          <label>Request link<input readOnly value={requestLink.href} onFocus={event => event.target.select()} /></label>
          <button type="button" className="secondary-button" onClick={() => copy(requestLink.href, "Request link")}>Copy link</button>
        </div>
        <p className="muted">Anyone with the link can ask to join. You decide who gets access.</p>
      </div>
    </div>
    {copied && <p role="status">{copied}</p>}
    <h3>Pending join requests</h3>
    {error ? <p role="alert">{error}</p> : !requests.length && <p className="muted">No pending requests.</p>}
    {requests.map(item => <div key={item.id} className="community-request">
      <strong>{item.name}</strong>
      <CommunityForm label="Save decision" save={async data => {
        await submitCommunity(path + "/join-requests/" + item.id, { decision: data.get("decision") }, null, "PATCH");
        setRequests(current => current.filter(request => request.id !== item.id));
      }}>
        <label>Decision<select required name="decision" defaultValue=""><option value="" disabled>Choose a decision</option>
          <option value="approve">Approve</option><option value="decline">Decline</option>
        </select></label>
      </CommunityForm>
    </div>)}
  </section>;
}
