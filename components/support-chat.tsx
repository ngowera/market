"use client";
import { useEffect, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";

type SupportMessage = {
  id: string;
  sender: "customer" | "admin";
  body: string;
  created_at: string;
};
type AuthState = "loading" | "google" | "required";

const tokenKey = "cmrp_support_token";

export default function SupportChat() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem(tokenKey) || "",
  );
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const checkSession = async () => {
      try {
        let response = await fetch("/api/session", { cache: "no-store" });
        if (response.status === 401) {
          const refreshed = await fetch("/api/auth/refresh", { method: "POST" });
          if (refreshed.ok) response = await fetch("/api/session", { cache: "no-store" });
        }
        const session = response.ok ? await response.json() as {
          user?: { app_metadata?: { providers?: string[]; provider?: string } };
        } : null;
        const providers = session?.user?.app_metadata?.providers || [];
        if (active) setAuthState(
          providers.includes("google") || session?.user?.app_metadata?.provider === "google"
            ? "google"
            : "required",
        );
      } catch {
        if (active) setAuthState("required");
      }
    };
    void checkSession();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!open || authState !== "google" || !token) return;
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
        if (!response.ok) {
          if (response.status === 404) {
            localStorage.removeItem(tokenKey);
            if (active) setToken("");
          }
          throw Error(result.error || "Could not load messages.");
        }
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
  }, [authState, open, token]);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = String(form.get("message") || "").trim();
    if (authState !== "google") {
      setError("Sign in with Google before sending a message.");
      setBusy(false);
      return;
    }
    const isNew = !token;
    const newToken = token || crypto.randomUUID();
    const endpoint = isNew ? "/api/support/start" : "/api/support/reply";
    const payload = { token: newToken, message: body };
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

  function signInUrl() {
    const returnPath = window.location.pathname + window.location.search;
    return `${import.meta.env.BASE_URL}account?next=${encodeURIComponent(returnPath)}`;
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
          {authState === "google" && token && (
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
          {authState === "loading" ? (
            <p className="support-empty">Checking your sign-in…</p>
          ) : authState === "required" ? (
            <div className="support-form">
              <p className="support-privacy">
                Sign in with Google to message our team and continue your conversation.
              </p>
              <a className="btn primary" href={signInUrl()}>Continue with Google</a>
            </div>
          ) : (
            <form className="support-form" onSubmit={send}>
              <label>
                Message
                <textarea name="message" required maxLength={2000} rows={3} />
              </label>
              <button className="btn primary" disabled={busy}>
                <Send size={15} />
                {busy ? "Sending…" : "Send message"}
              </button>
              <small className="support-privacy">
                Avoid sending passwords, payment credentials, or security codes.
              </small>
            </form>
          )}
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
