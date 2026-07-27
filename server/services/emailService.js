/**
 * Email Service using Nodemailer
 * Uses SMTP (works with Gmail, Outlook, or any SMTP provider)
 * Set EMAIL_USER and EMAIL_PASS in environment variables
 */

import nodemailer from 'nodemailer';

const createTransporter = () => {
    // Support Gmail SMTP (free)
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS  // Use Gmail App Password
        }
    });
};

/**
 * Send email verification link
 */
export async function sendVerificationEmail(email, name, token) {
    const baseUrl = process.env.FRONTEND_URL || 'https://fintechpro.vercel.app';
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error('Server misconfiguration: EMAIL_USER or EMAIL_PASS environment variables are missing (check Vercel/Render).');
    }

    const transporter = createTransporter();

    const mailOptions = {
        from: `"FinTechPro" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Verify your FinTechPro account',
        html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Inter',system-ui,sans-serif;">
          <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 32px rgba(31,38,135,0.1);">
            
            <!-- Header -->
            <div style="background:linear-gradient(135deg,#10b981,#059669);padding:40px 32px;text-align:center;">
              <h1 style="color:#ffffff;font-size:28px;font-weight:800;margin:0;letter-spacing:-0.5px;">FinTechPro</h1>
              <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Wealth Management Platform</p>
            </div>
            
            <!-- Body -->
            <div style="padding:40px 32px;">
              <h2 style="color:#1e293b;font-size:22px;font-weight:700;margin:0 0 12px;">Welcome, ${name}! 👋</h2>
              <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 32px;">
                Thanks for signing up. Please verify your email address to activate your account and start tracking your portfolio.
              </p>
              
              <!-- CTA Button -->
              <div style="text-align:center;margin-bottom:32px;">
                <a href="${verifyUrl}" 
                   style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:50px;font-size:16px;font-weight:700;letter-spacing:0.3px;">
                  ✓ Verify Email Address
                </a>
              </div>
              
              <!-- Expiry note -->
              <p style="color:#94a3b8;font-size:13px;text-align:center;margin:0 0 24px;">
                This link expires in <strong>24 hours</strong>
              </p>
              
              <!-- Fallback URL -->
              <div style="background:#f8fafc;border-radius:12px;padding:16px;border:1px solid #e2e8f0;">
                <p style="color:#64748b;font-size:12px;margin:0 0 8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Or copy this link:</p>
                <p style="color:#10b981;font-size:12px;margin:0;word-break:break-all;">${verifyUrl}</p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background:#f8fafc;padding:24px 32px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="color:#94a3b8;font-size:12px;margin:0;">
                If you didn't create this account, you can safely ignore this email.<br>
                © ${new Date().getFullYear()} FinTechPro — Wealth Management
              </p>
            </div>
          </div>
        </body>
        </html>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Verification email sent to ${email}`);
        return { success: true, simulated: false };
    } catch (error) {
        console.error('❌ Failed to send verification email (wrong credentials?):', error.message);
        throw error;
    }
}
