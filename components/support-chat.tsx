"use client";
import { useEffect, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";

type SupportMessage = {
  id: string;
  sender: "customer" | "admin";
  body: string;
  created_at: string;
};

const tokenKey = "cmrp_support_token";

export default function SupportChat() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem(tokenKey) || "",
  );
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !token) return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/support/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          cache: "no-store",
        });
        const result = await response.json() as {
          messages?: SupportMessage[];
          error?: string;
        };
        if (!response.ok) throw Error(result.error || "Could not load messages.");
        if (active) {
          setMessages(result.messages || []);
          setError("");
        }
      } catch (failure) {
        if (active) setError((failure as Error).message);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 8000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [open, token]);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = String(form.get("message") || "").trim();
    const isNew = !token;
    const newToken = token || crypto.randomUUID();
    const endpoint = isNew ? "/api/support/start" : "/api/support/reply";
    const payload = isNew
      ? {
          token: newToken,
          name: String(form.get("name") || "").trim(),
          email: String(form.get("email") || "").trim(),
          message: body,
        }
      : { token: newToken, message: body };
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw Error(result.error || "Could not send message.");
      if (isNew) {
        localStorage.setItem(tokenKey, newToken);
        setToken(newToken);
      }
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          sender: "customer",
          body,
          created_at: new Date().toISOString(),
        },
      ]);
      formElement.reset();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="support-float">
      {open && (
        <section className="support-panel" aria-label="Message Nyasa Market support">
          <div className="support-panel-heading">
            <div>
              <b>Message our team</b>
              <span>Send a message and get a reply here.</span>
            </div>
            <button type="button" aria-label="Close messages" onClick={() => setOpen(false)}>
              <X size={18} />
            </button>
          </div>
          {token && (
            <div className="support-messages" aria-live="polite">
              {messages.map((message) => (
                <div
                  className={`support-message ${message.sender}`}
                  key={message.id}
                >
                  <span>{message.sender === "admin" ? "Nyasa Market" : "You"}</span>
                  <p>{message.body}</p>
                  <time>{new Date(message.created_at).toLocaleString()}</time>
                </div>
              ))}
              {!messages.length && !error && (
                <p className="support-empty">Your conversation will appear here.</p>
              )}
            </div>
          )}
          {error && <p className="error support-error">{error}</p>}
          <form className="support-form" onSubmit={send}>
            {!token && (
              <>
                <label>
                  Your name
                  <input name="name" required maxLength={120} />
                </label>
                <label>
                  Email for this conversation
                  <input name="email" type="email" required maxLength={254} />
                </label>
              </>
            )}
            <label>
              Message
              <textarea name="message" required maxLength={2000} rows={3} />
            </label>
            <button className="btn primary" disabled={busy}>
              <Send size={15} />
              {busy ? "Sending…" : "Send message"}
            </button>
            {!token && (
              <small className="support-privacy">
                Keep this browser to continue the conversation. Avoid sending
                passwords or financial account details.
              </small>
            )}
          </form>
        </section>
      )}
      <button
        className="support-float-button"
        type="button"
        aria-label={open ? "Close direct messages" : "Message Nyasa Market"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X size={24} /> : <MessageCircle size={25} />}
      </button>
    </div>
  );
}
