import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT ?? '587'),
  secure: false, // TLS via STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const FROM = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@example.com'
const BASE_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

// ─── Email Templates ──────────────────────────────────────────────────────────

function baseTemplate(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 32px 40px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
    .header p { margin: 6px 0 0; color: #bfdbfe; font-size: 13px; }
    .body { padding: 36px 40px; }
    .body p { color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
    .btn { display: inline-block; margin: 8px 0 24px; padding: 14px 32px; background: #2563eb; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
    .small { font-size: 13px !important; color: #6b7280 !important; }
    .footer { background: #f9fafb; padding: 20px 40px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>✈ PAEC</h1>
      <p>Pilot &amp; ATC English Corpus System</p>
    </div>
    <div class="body">
      ${body}
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} PAEC System &bull; This is an automated message, please do not reply.
    </div>
  </div>
</body>
</html>
`
}

// ─── Send Functions ───────────────────────────────────────────────────────────

export async function sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
  const link = `${BASE_URL}/auth/verify-email?token=${token}`
  const firstName = name.split(' ')[0]

  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Verify your PAEC account',
    html: baseTemplate('Verify your email', `
      <p>Hi ${firstName},</p>
      <p>Welcome to PAEC! Please verify your email address to activate your account.</p>
      <a href="${link}" class="btn">Verify Email Address</a>
      <hr class="divider" />
      <p class="small">This link expires in <strong>24 hours</strong>. If you did not create an account, you can safely ignore this email.</p>
      <p class="small">Or copy this link into your browser:<br />${link}</p>
    `),
  })
}

export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
  const link = `${BASE_URL}/auth/reset-password?token=${token}`
  const firstName = name.split(' ')[0]

  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Reset your PAEC password',
    html: baseTemplate('Reset your password', `
      <p>Hi ${firstName},</p>
      <p>We received a request to reset the password for your account. Click the button below to choose a new password.</p>
      <a href="${link}" class="btn">Reset Password</a>
      <hr class="divider" />
      <p class="small">This link expires in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email — your password will not be changed.</p>
      <p class="small">Or copy this link into your browser:<br />${link}</p>
    `),
  })
}

export async function sendPasswordChangeCode(to: string, name: string, code: string): Promise<void> {
  const firstName = name.split(' ')[0]

  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Your PAEC password change code',
    html: baseTemplate('Password Change Verification', `
      <p>Hi ${firstName},</p>
      <p>You requested to change your PAEC account password. Use the code below to confirm this action.</p>
      <div style="text-align:center;margin:24px 0;">
        <span style="display:inline-block;padding:16px 32px;background:#f3f4f6;border:2px dashed #d1d5db;border-radius:10px;font-size:32px;font-weight:700;letter-spacing:8px;color:#111827;">${code}</span>
      </div>
      <hr class="divider" />
      <p class="small">This code expires in <strong>10 minutes</strong>. If you did not request a password change, please secure your account immediately.</p>
    `),
  })
}

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  const firstName = name.split(' ')[0]

  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Welcome to PAEC!',
    html: baseTemplate('Welcome to PAEC', `
      <p>Hi ${firstName},</p>
      <p>Your email has been verified and your PAEC account is now active. You're ready to start training!</p>
      <a href="${BASE_URL}/auth/login" class="btn">Go to Dashboard</a>
      <hr class="divider" />
      <p class="small">PAEC helps pilots and ATC officers improve aviation English communication through corpus-based exercises and real-world scenarios.</p>
    `),
  })
}
