import { useEffect, useState } from "react";
import {
  Sparkles,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

function VerifyEmail({ token, onDone }) {
  const [status, setStatus] = useState("verifying"); // "verifying" | "success" | "error"
  const [message, setMessage] = useState("");

  useEffect(() => {
    const runVerification = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/auth/verify-email",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Could not verify email.");
        }

        setStatus("success");
        setMessage(data.message);
      } catch (error) {
        console.error("Email verification error:", error);
        setStatus("error");
        setMessage(error.message || "Could not verify email.");
      }
    };

    runVerification();
  }, [token]);

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
            {status === "verifying"
              ? "Verifying your email..."
              : status === "success"
              ? "Email verified"
              : "Verification failed"}
          </h1>

          <p className="auth-subtitle">
            {status === "verifying"
              ? "Hang tight, this only takes a second."
              : message}
          </p>
        </div>

        {status === "verifying" && (
          <div className="auth-message" role="status">
            <Loader2 size={17} className="loading-spinner" />
            <span>Verifying...</span>
          </div>
        )}

        {status === "success" && (
          <>
            <div className="auth-message auth-success" role="status">
              <CheckCircle2 size={15} />
              <span>You can now sign in.</span>
            </div>

            <button className="auth-submit" type="button" onClick={onDone}>
              Back to sign in
              <ArrowRight size={17} />
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <div className="auth-message auth-error" role="alert">
              <AlertCircle size={15} />
              <span>{message}</span>
            </div>

            <button className="auth-submit" type="button" onClick={onDone}>
              Back to sign in
              <ArrowRight size={17} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default VerifyEmail;