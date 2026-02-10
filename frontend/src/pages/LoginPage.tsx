import { useEffect, useState } from "react";
import SplashScreen from "../components/SplashScreen";

type VerifyResponse = {
  access_token: string;
  token_type: string;
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 900);
    return () => clearTimeout(timer);
  }, []);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    setError(null);
    setStatus("Authenticating...");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/password-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: password.trim() })
      });
      // Prefer JSON when available; fall back to text so we can surface
      // backend error messages even if the response isn't JSON.
      const contentType = res.headers.get("content-type") || "";
      let data: any = null;
      let rawText: string | null = null;
      if (contentType.includes("application/json")) {
        try {
          data = await res.json();
        } catch (_) {
          // leave data as null and try text below
        }
      }
      if (!data) {
        try {
          rawText = await res.text();
        } catch (_) {
          rawText = null;
        }
      }

      if (!res.ok) {
        const serverMsg = (data && (data.detail || data.message || data.error))
          || rawText
          || res.statusText
          || "Authentication failed";
        throw new Error(serverMsg);
      }

      const token = data?.access_token;
      if (!token) {
        const msg = rawText || "Unexpected server response (missing token)";
        throw new Error(msg);
      }

      localStorage.setItem("access_token", token);
      setStatus("Success! Redirecting...");
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    } catch (err: any) {
      setStatus(null);
      setIsLoading(false);
      setError(err.message || "Authentication failed. Please verify your credentials.");
    }
  };

  if (showSplash) {
    return <SplashScreen label="Login" />;
  }

  return (
    <div className="login-shell-v2">
      {/* Background image with overlay */}
      <div className="login-bg" />
      <div className="login-bg-overlay" />

      {/* Main content */}
      <div className="login-container-v2">
        {/* Left panel — branding */}
        <div className="login-brand-panel">
          <div className="login-brand-content">
            <img src="/365.png" alt="365 Fiscal" className="login-brand-logo" />
            <h1 className="login-brand-title">365 Fiscal</h1>
            <p className="login-brand-tagline">
              Professional invoicing, payments, taxes & fiscalization — all in one platform.
            </p>
            <div className="login-brand-features">
              <div className="login-brand-feature">
                <div className="login-feature-dot" />
                <span>Multi-company management</span>
              </div>
              <div className="login-brand-feature">
                <div className="login-feature-dot" />
                <span>ZIMRA fiscal compliance</span>
              </div>
              <div className="login-brand-feature">
                <div className="login-feature-dot" />
                <span>Real-time analytics & reports</span>
              </div>
            </div>
          </div>
          <div className="login-brand-footer">
            <img src="/geenet.trim.png" alt="GeeNet" className="login-brand-footer-logo" />
          </div>
        </div>

        {/* Right panel — form */}
        <div className="login-form-panel">
          <div className="login-form-wrapper">
            <div className="login-form-header">
              <h2>Welcome back</h2>
              <p>Sign in to your account to continue</p>
            </div>

            <form className="login-form" onSubmit={signIn}>
              <div className="login-field">
                <label htmlFor="email">Email</label>
                <div className="login-input-wrap">
                  <svg className="login-input-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="password">Password</label>
                <div className="login-input-wrap">
                  <svg className="login-input-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <button className="login-submit-btn" type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <span className="spinner"></span>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>

            {status && !error && (
              <div className="login-msg login-msg-success">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                {status}
              </div>
            )}
            {error && (
              <div className="login-msg login-msg-error">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}



