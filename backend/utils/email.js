// Sends transactional emails through Brevo's HTTP API (https://api.brevo.com).
//
// Why the API instead of SMTP: some hosts (Render included, on certain plans)
// are inconsistent about outbound SMTP ports, and SMTP credentials are a
// second thing to rotate/misconfigure. The HTTP API just needs one API key
// over normal HTTPS, which every host allows.
//
// Required environment variables:
//   BREVO_API_KEY  - your Brevo API key (Settings -> SMTP & API -> API Keys)
//   EMAIL_FROM     - the sender address. This MUST be a verified sender (or
//                    part of a verified domain) in your Brevo account, or
//                    Brevo will reject the send.
//
// Requires Node 18+ for the built-in global `fetch`. If your runtime is
// older than that, install `node-fetch` and replace the fetch call below.

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const SENDER_NAME = "SnapMind";

async function sendViaBrevo({ to, subject, html }) {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    throw new Error(
      "BREVO_API_KEY is not set. Add it to your environment variables."
    );
  }

  const fromEmail = process.env.EMAIL_FROM;

  if (!fromEmail) {
    throw new Error(
      "EMAIL_FROM is not set. Add it to your environment variables."
    );
  }

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: fromEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    let details;

    try {
      details = await response.json();
    } catch (parseError) {
      details = await response.text().catch(() => "(no response body)");
    }

    const error = new Error(
      `Brevo API request failed with status ${response.status}: ${
        typeof details === "string" ? details : JSON.stringify(details)
      }`
    );

    error.code = "BREVO_API_ERROR";
    error.status = response.status;
    error.details = details;

    throw error;
  }

  return response.json();
}

async function sendPasswordResetEmail(toEmail, resetUrl) {
  await sendViaBrevo({
    to: toEmail,
    subject: "Reset your SnapMind password",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #111;">Reset your password</h2>
        <p>We received a request to reset your SnapMind password. This link
        expires in 1 hour and can only be used once.</p>
        <p>
          <a href="${resetUrl}"
             style="display:inline-block; padding:12px 20px; background:#6d28d9;
                    color:#fff; text-decoration:none; border-radius:8px;">
            Reset password
          </a>
        </p>
        <p>If you didn't request this, you can safely ignore this email —
        your password will not be changed.</p>
        <p style="color:#888; font-size:12px;">${resetUrl}</p>
      </div>
    `,
  });
}

async function sendWelcomeVerificationEmail(toEmail, name, verifyUrl) {
  await sendViaBrevo({
    to: toEmail,
    subject: "Welcome to SnapMind — verify your email",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #111;">Welcome to SnapMind${name ? `, ${name}` : ""}!</h2>
        <p>You're one step away from building your personal screenshot memory.
        Please verify your email to activate your account. This link expires
        in 24 hours and can only be used once.</p>
        <p>
          <a href="${verifyUrl}"
             style="display:inline-block; padding:12px 20px; background:#6d28d9;
                    color:#fff; text-decoration:none; border-radius:8px;">
            Verify email
          </a>
        </p>
        <p>If you didn't create a SnapMind account, you can ignore this email.</p>
        <p style="color:#888; font-size:12px;">${verifyUrl}</p>
      </div>
    `,
  });
}

module.exports = { sendPasswordResetEmail, sendWelcomeVerificationEmail };