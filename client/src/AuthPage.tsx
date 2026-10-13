import { useState, type FormEvent } from "react";
import { ArrowRight, BookOpen, Command, LoaderCircle, ShieldCheck } from "lucide-react";
import type { Student } from "./types";

type AuthPageProps = {
  initialError: string;
  onAuthenticated: (student: Student) => void;
};

export default function AuthPage({ initialError, onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(mode === "signup" ? { name } : {}), email, password })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to authenticate.");
      onAuthenticated(result as Student);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect to Deadline Radar.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page">
    <section className="auth-story">
      <a className="auth-brand" href="#" onClick={(event) => event.preventDefault()}>
        <span className="auth-brand-icon"><Command size={21} /></span>
        <span>deadline<span>radar</span></span>
      </a>
      <div className="auth-story-copy">
        <span className="auth-kicker"><BookOpen size={14} /> STUDENT WORKSPACE</span>
        <h1>Stay ahead of every deadline.</h1>
        <p>Keep assignments, study sessions and your next steps together in one calm, clear workspace.</p>
        <div className="auth-benefit"><span><ShieldCheck size={16} /></span><div><strong>Your work, in your account</strong><small>Assignments and reports are saved in your MongoDB database.</small></div></div>
      </div>
      <span className="auth-story-footer">A little progress, consistently, adds up.</span>
    </section>
    <section className="auth-form-side">
      <div className="auth-card">
        <div className="auth-card-heading">
          <span className="auth-mobile-mark"><Command size={19} /></span>
          <div className="eyebrow">{mode === "signup" ? "CREATE YOUR ACCOUNT" : "WELCOME BACK"}</div>
          <h2>{mode === "signup" ? "Create your workspace" : "Log in to Deadline Radar"}</h2>
          <p>{mode === "signup" ? "Your dashboard starts empty and fills with the work you add." : "Sign in to see your saved assignments and study history."}</p>
        </div>
        {(error || initialError) && <div className="auth-error" role="alert">{error || initialError}</div>}
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          {mode === "signup" && <label className="field"><span>Full name</span><input autoComplete="name" required maxLength={100} placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} /></label>}
          <label className="field"><span>Email address</span><input autoComplete="email" type="email" required maxLength={254} placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label className="field"><span>Password</span><input autoComplete={mode === "signup" ? "new-password" : "current-password"} type="password" required minLength={8} maxLength={72} placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {mode === "signup" && <small className="auth-hint">Use at least 8 characters. Your password is stored as a one-way hash.</small>}
          <button className="button primary auth-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : null}{mode === "signup" ? "Create account" : "Log in"}{!busy && <ArrowRight size={16} />}</button>
        </form>
        <div className="auth-switch">{mode === "signup" ? "Already have an account?" : "New to Deadline Radar?"}<button type="button" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); }}>{mode === "signup" ? "Log in" : "Create an account"}</button></div>
        <div className="auth-data-note"><ShieldCheck size={14} /> Private account · Data stored in your configured MongoDB</div>
      </div>
    </section>
  </main>;
}
