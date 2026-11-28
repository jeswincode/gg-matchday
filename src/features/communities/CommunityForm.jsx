import { useRef, useState } from "react";

export default function CommunityForm({ children, label, save, success = "Saved." }) {
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const request = useRef({ locked: false, key: "", previous: "" });

  async function submit(event) {
    event.preventDefault();
    if (request.current.locked) return;
    const data = new FormData(event.currentTarget);
    const signature = JSON.stringify([...data.entries()]);
    if (signature !== request.current.previous || !request.current.key) {
      request.current = { locked: false, key: crypto.randomUUID(), previous: signature };
    }
    request.current.locked = true;
    setPending(true);
    setFeedback("");
    try {
      const message = await save(data, request.current.key);
      request.current.key = "";
      setFeedback(message || success);
    } catch (error) {
      setFeedback(error.message);
    } finally {
      request.current.locked = false;
      setPending(false);
    }
  }

  return <form className="community-form" onSubmit={submit}>
    <fieldset disabled={pending}>
      {children}
      <button type="submit" className="secondary-button">{pending ? "Saving…" : label}</button>
    </fieldset>
    {feedback && <p role="status" className="community-feedback">{feedback}</p>}
  </form>;
}
