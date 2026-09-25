import { useState } from "react";
import {
  Sparkles,
  Lock,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

function ResetPassword({ token, onDone }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "https://snapmind-4t5b.onrender.com/api/auth/reset-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not reset password.");
      }

      setSuccess(true);
    } catch (err) {
      console.error("Reset password error:", err);
      setError(err.message || "Could not reset password.");
    } finally {
      setLoading(false);
    }
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
            {success ? "Password reset" : "Choose a new password"}
          </h1>

          <p className="auth-subtitle">
            {success
              ? "Your password has been updated successfully."
              : "Enter a new password for your account."}
          </p>
        </div>

        {success ? (
          <>
            <div className="auth-message auth-success" role="status">
              <CheckCircle2 size={15} />
              <span>You can now log in with your new password.</span>
            </div>

            <button className="auth-submit" type="button" onClick={onDone}>
              Back to sign in
              <ArrowRight size={17} />
            </button>
          </>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-field">
              <label htmlFor="reset-password">New password</label>

              <div className="auth-input-group">
                <Lock size={16} className="auth-input-icon" />

                <input
                  id="reset-password"
                  className="auth-input auth-input-has-toggle"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
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

            <div className="auth-field">
              <label htmlFor="reset-confirm-password">Confirm password</label>

              <div className="auth-input-group">
                <Lock size={16} className="auth-input-icon" />

                <input
                  id="reset-confirm-password"
                  className="auth-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {error && (
              <div className="auth-message auth-error" role="alert">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={17} className="loading-spinner" />
                  Please wait...
                </>
              ) : (
                <>
                  Reset password
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default ResetPassword;