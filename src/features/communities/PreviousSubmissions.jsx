import { useEffect, useState } from "react";
import CommunityForm from "./CommunityForm";
import { communityPages, submitCommunity } from "./communityApi";

export default function PreviousSubmissions({ communityId }) {
  const base = "/" + communityId + "/matches";
  const [pending, setPending] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    communityPages(base, controller.signal).then(matches => {
      if (!controller.signal.aborted) setPending(matches.filter(match => match.status === "submitted"));
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure.message);
    });
    return () => controller.abort();
  }, [base]);

  if (!pending.length && !error) return null;
  return <section className="gg-account-setting">
    <h3>Previous preview submissions</h3>
    {error && <p role="alert">{error}</p>}
    {pending.map(match => <div className="community-request" key={match.id}>
      <div><strong>{match.home} {match.homeScore}–{match.awayScore} {match.away}</strong><br /><time dateTime={match.date}>{match.date}</time></div>
      <CommunityForm label="Save match decision" save={async data => {
        await submitCommunity(base + "/" + match.id, { decision: data.get("decision") }, null, "PATCH");
        setPending(current => current.filter(item => item.id !== match.id));
      }}>
        <label>Match decision<select name="decision" required defaultValue="">
          <option value="" disabled>Choose a decision</option>
          <option value="approve">Approve</option>
          <option value="decline">Decline</option>
        </select></label>
      </CommunityForm>
    </div>)}
  </section>;
}
