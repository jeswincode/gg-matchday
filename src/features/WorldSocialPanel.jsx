import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useOriginalGGRealtime } from "./useOriginalGGRealtime";
import "./original-gg.css";

const reasons = ["spam", "harassment", "inappropriate", "other"];
const labels = { spam: "Spam", harassment: "Harassment", inappropriate: "Inappropriate", other: "Other" };

export default function WorldSocialPanel({ playerId, locationId = "city-plaza" }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState("");
  const [incoming, setIncoming] = useState([]);
  const [connection, setConnection] = useState("connecting");
  const [reportingId,setReportingId] = useState(null);
  const [reportReason,setReportReason] = useState("other");
  const scroller = useRef(null);
  const messageEnd = useRef(null);

  const onEvent = useCallback(({ type, payload }) => {
    if (type === "stream:status") { setConnection(payload?.connected ? "live" : "reconnecting"); return; }
    if (type === "connected") { setConnection("live"); return; }
    if (type === "social:message" && payload?.locationId === locationId) {
      setMessages((current) => current.some((item) => item.id === payload.id) ? current : [...current, payload].slice(-60));
    }
    if (type === "social:message_hidden") {
      setMessages((current) => current.filter((item) => item.id !== payload?.id));
    }
    if (type === "social:interaction" && String(payload?.toPlayerId) === String(playerId)) {
      setIncoming((current) => [{ ...payload, receivedAt: Date.now() }, ...current].slice(0, 4));
      setNotice(payload.fromName + " sent you a " + payload.type.replace("-", " ") + ".");
    }
  }, [locationId, playerId]);

  useOriginalGGRealtime("world", onEvent, Boolean(playerId));

  useEffect(() => {
    let active = true;
    Promise.all([api("/world/social/messages?locationId=" + encodeURIComponent(locationId)),api("/world/social/interactions")]).then(([result,interactionResult]) => {
      if (active) { setMessages(result.messages || []); setIncoming((interactionResult.interactions||[]).map((item)=>({...item,receivedAt:Date.now()}))); }
    }).catch((error) => { if (active) setNotice(error.message || "City chat could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [locationId]);

  useEffect(() => {
    messageEnd.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [messages.length, expanded]);

  async function sendMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true); setNotice("");
    try {
      const result = await api("/world/social/messages", { method: "POST", body: { locationId, text } });
      setMessages((current) => current.some((item) => item.id === result.message.id) ? current : [...current, result.message].slice(-60));
      setDraft("");
      setExpanded(true);
    } catch (error) { setNotice(error.message || "Your message could not be sent."); }
    finally { setSending(false); }
  }

  async function submitReport(messageId) {
    try {
      await api("/world/social/messages/" + messageId + "/report", { method: "POST", body: { reason: reportReason } });
      setNotice("Thanks. The message has been sent to community moderation.");
      setReportingId(null);
    } catch (error) { setNotice(error.message || "Could not report this message."); }
  }

  async function acknowledge(id) {
    try {
      await api("/world/social/interactions/" + id + "/acknowledge", { method: "POST", body: {} });
      setIncoming((current) => current.filter((item) => item.id !== id));
    } catch { /* A failed acknowledgement can safely be retried on refresh. */ }
  }

  return <section className={"gg-social-panel" + (expanded ? " is-expanded" : "")}>
    <header className="gg-social-heading">
      <button type="button" className="gg-social-expand" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <span className="gg-social-icon">✦</span>
        <span><strong>GG Community</strong><small>{connection === "live" ? "Live in Original GG" : connection === "connecting" ? "Connecting to the city…" : "Reconnecting to the city…"}</small></span>
        <i className={connection === "live" ? "is-live" : ""}/>
        <b>{expanded ? "−" : "+"}</b>
      </button>
    </header>
    {incoming.length > 0 && <div className="gg-social-incoming" aria-live="polite">{incoming.map((item) => <div key={item.id}><span><strong>{item.fromName}</strong> sent a {item.type.replace("-", " ")}.</span><button type="button" onClick={() => acknowledge(item.id)}>Got it</button></div>)}</div>}
    {expanded && <>
      <div className="gg-social-message-list" ref={scroller} aria-label="Messages in this location">
        {loading ? <p className="gg-social-empty">Opening the community lounge…</p> : messages.length === 0 ? <p className="gg-social-empty">It’s quiet here. Start the conversation with your fellow players.</p> : messages.map((message) => <article key={message.id} className={String(message.senderPlayerId) === String(playerId) ? "is-own" : ""}>
          <div><strong>{message.displayName}</strong><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>
          <p>{message.text}</p>
          {String(message.senderPlayerId) !== String(playerId) && <><button className="gg-social-report" type="button" onClick={() => {setReportingId(reportingId===message.id?null:message.id);setReportReason("other");}}>Report</button>{reportingId===message.id&&<div className="gg-social-report-form"><label>Reason<select value={reportReason} onChange={(event)=>setReportReason(event.target.value)}>{reasons.map((reason)=><option key={reason} value={reason}>{labels[reason]}</option>)}</select></label><button type="button" onClick={()=>submitReport(message.id)}>Send report</button></div>}</>}
        </article>)}
        <div ref={messageEnd}/>
      </div>
      <form className="gg-social-compose" onSubmit={sendMessage}>
        <label className="gg-sr-only" htmlFor="gg-city-message">Write a city message</label>
        <input id="gg-city-message" maxLength={240} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Say something to the city…" />
        <button type="submit" disabled={sending || !draft.trim()}>{sending ? "Sending…" : "Send"}</button>
        <small>{draft.length}/240</small>
      </form>
      <p className="gg-social-footnote">Be kind. Messages expire after 24 hours. Reported content is reviewed and can be hidden.</p>
    </>}
    {notice && <p className="gg-social-notice" role="status">{notice}</p>}
  </section>;
}
