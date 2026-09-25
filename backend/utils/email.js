const nodemailer = require("nodemailer");

// Reads SMTP config from environment variables only — never hardcode
// credentials, and never send them to the frontend.
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === "true", // true for port 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendPasswordResetEmail(toEmail, resetUrl) {
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;

  await transporter.sendMail({
    from: `"SnapMind" <${fromAddress}>`,
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
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;

  await transporter.sendMail({
    from: `"SnapMind" <${fromAddress}>`,
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