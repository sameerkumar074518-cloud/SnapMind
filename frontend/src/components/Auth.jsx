import { useState } from "react";
import {
  Sparkles,
  Mail,
  Lock,
  User,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

function Auth({ onLogin }) {
  const [mode, setMode] = useState("login"); // "login" | "register" | "forgot"

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    resetMessages();

    if (mode === "forgot") {
      if (!email.trim()) {
        setError("Please enter your email.");
        return;
      }

      setLoading(true);

      try {
        const response = await fetch(
          "https://snapmind-4t5b.onrender.com/api/auth/forgot-password",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email.trim() }),
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Something went wrong.");
        }

        setSuccess(
          data.message ||
            "If an account exists for that email, a reset link has been sent."
        );
      } catch (err) {
        console.error("Forgot password error:", err);
        setError(err.message || "Could not send reset email.");
      } finally {
        setLoading(false);
      }

      return;
    }

    if (mode === "register" && !name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const endpoint =
        mode === "login"
          ? "https://snapmind-4t5b.onrender.com/api/auth/login"
          : "https://snapmind-4t5b.onrender.com/api/auth/register";

      const body =
        mode === "login"
          ? {
              email: email.trim(),
              password,
            }
          : {
              name: name.trim(),
              email: email.trim(),
              password,
            };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Something went wrong.");
      }

            if (mode === "register") {
        setSuccess(
          data.message ||
            "Account created! Please check your email to verify your account before logging in."
        );

        setMode("login");
        setPassword("");
      } else {
        localStorage.setItem("snapmind_token", data.token);
        localStorage.setItem("snapmind_user", JSON.stringify(data.user));

        onLogin(data.user);
      }
    } catch (error) {
      console.error("Authentication error:", error);

      setError(error.message || "Could not connect to SnapMind.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode) => {
    resetMessages();

    setMode(nextMode);

    setPassword("");
    setShowPassword(false);
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">
            <Sparkles size={18} />
          </div>

          <span>SnapMind</span>
        </div>

        <div className="auth-header">
          <h1 className="auth-title">
            {mode === "login"
              ? "Welcome back"
              : mode === "register"
              ? "Create your memory"
              : "Reset your password"}
          </h1>

          <p className="auth-subtitle">
            {mode === "login"
              ? "Sign in to access your personal screenshot memory."
              : mode === "register"
              ? "Start building your personal screenshot memory."
              : "Enter your registered email and we'll send you a reset link."}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {mode === "register" && (
            <div className="auth-field">
              <label htmlFor="auth-name">Name</label>

              <div className="auth-input-group">
                <User size={16} className="auth-input-icon" />

                <input
                  id="auth-name"
                  className="auth-input"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="auth-email">Email</label>

            <div className="auth-input-group">
              <Mail size={16} className="auth-input-icon" />

              <input
                id="auth-email"
                className="auth-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
          </div>

          {mode !== "forgot" && (
            <div className="auth-field">
              <label htmlFor="auth-password">Password</label>

              <div className="auth-input-group">
                <Lock size={16} className="auth-input-icon" />

                <input
                  id="auth-password"
                  className="auth-input auth-input-has-toggle"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                />

                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          )}

          {mode === "login" && (
            <button
              type="button"
              className="auth-forgot-link"
              onClick={() => switchMode("forgot")}
            >
              Forgot password?
            </button>
          )}

          {error && (
            <div className="auth-message auth-error" role="alert">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="auth-message auth-success" role="status">
              <CheckCircle2 size={15} />
              <span>{success}</span>
            </div>
          )}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={17} className="loading-spinner" />
                Please wait...
              </>
            ) : mode === "login" ? (
              <>
                Sign in
                <ArrowRight size={17} />
              </>
            ) : mode === "register" ? (
              <>
                Create account
                <ArrowRight size={17} />
              </>
            ) : (
              <>
                Send reset link
                <ArrowRight size={17} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          {mode === "forgot" ? (
            <button
              type="button"
              className="auth-switch"
              onClick={() => switchMode("login")}
            >
              Back to sign in
            </button>
          ) : (
            <>
              <span>
                {mode === "login"
                  ? "Don't have an account?"
                  : "Already have an account?"}
              </span>

              <button
                type="button"
                className="auth-switch"
                onClick={() => switchMode(mode === "login" ? "register" : "login")}
              >
                {mode === "login" ? "Create account" : "Sign in"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Auth;