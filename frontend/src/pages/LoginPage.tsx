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
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Invalid JSON response:", text);
        throw new Error("Server Error: Received non-JSON response");
      }

      if (!res.ok) {
        throw new Error(data.detail || "Invalid credentials");
      }
      
      localStorage.setItem("access_token", data.access_token);
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
    <div className="login-shell login-split">
      {/* Left Panel - Branding */}
      <div className="login-panel">
        <div className="login-brand">
          <img 
            className="brand-logo" 
            src="/zimra.png" 
            alt="ZIMRA - Zimbabwe Revenue Authority"
          />
        </div>

        

        <div className="login-features">
          <div className="login-feature">
            <div className="feature-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div className="feature-text">
              <strong>Fiscal Day Management</strong>
              <span>Open, manage, and close fiscal days with automatic counters</span>
            </div>
          </div>
          <div className="login-feature">
            <div className="feature-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
            <div className="feature-text">
              <strong>Real-Time Receipt Submission</strong>
              <span>Instant fiscalization of invoices and credit notes to ZIMRA</span>
            </div>
          </div>
          <div className="login-feature">
            <div className="feature-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <polyline points="9 12 11 14 15 10"/>
              </svg>
            </div>
            <div className="feature-text">
              <strong>ZIMRA Compliance</strong>
              <span>Fully certified integration with Zimbabwe Revenue Authority</span>
            </div>
          </div>
        </div>

        <div className="login-footer">
          <div className="footer-badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-11v6h2v-6h-2zm0-4v2h2V7h-2z"/>
            </svg>
            Trusted by Businesses Across Zimbabwe
          </div>
        </div>
      </div>

      {/* Right Panel - Login Card */}
      <div className="login-card">
        <div className="login-floating-365">
          <span className="text-365">365</span>
          <div className="badge-sep"></div>
          <span className="text-fiscal">Fiscal</span>
        </div>
        <div className="login-card-header">
          <h2 className="login-card-title">Welcome Back</h2>
          {/* <p className="login-card-sub">Sign in to access your dashboard</p> */}
        </div>
        <div className="login-card-body">

          <form className="login-form" onSubmit={signIn}>
            <div className="input-group">
              <input
                id="email"
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={isLoading}
              />
            </div>

            <div className="input-group">
              <input
                id="password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={isLoading}
              />
            </div>

            <button className="login-btn" type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="spinner"></span>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          {status && !error && (
            <div className="login-status">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              {status}
            </div>
          )}
          {error && (
            <div className="login-error">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}
        </div>

        <div className="login-card-footer">
          <p>Powered by Geenet</p>
        </div>
      </div>
    </div>
  );
}



