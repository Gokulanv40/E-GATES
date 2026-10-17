const nodemailer = require('nodemailer');
const config = require('../config/env');

let transporter = null;

// Initialize Nodemailer transporter if credentials exist
const isSmtpConfigured =
  Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);

if (isSmtpConfigured) {
  try {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465, // true for 465, false for other ports
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  } catch (err) {
    console.warn('[Email Service Warning]: Failed to initialize SMTP transporter:', err.message);
  }
}

/**
 * Base email layout wrapper
 */
function wrapHtmlLayout(title, contentHtml) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: #1e40af; color: #ffffff; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.025em; }
    .content { padding: 32px 24px; font-size: 15px; line-height: 1.6; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 20px 0; }
    .info-box { background: #f1f5f9; border-left: 4px solid #2563eb; padding: 12px 16px; margin: 20px 0; border-radius: 4px; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Layout Association Management</h1>
    </div>
    <div class="content">
      ${contentHtml}
    </div>
    <div class="footer">
      <p style="margin: 0 0 4px 0;">This is an automated system notification.</p>
      <p style="margin: 0; font-weight: 500;">Powered by JishnuInfotech</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Send generic email
 */
async function sendEmail({ to, subject, html, text }) {
  if (!transporter) {
    console.log('\n================== [EMAIL SIMULATION] ==================');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body (Plain Text / Preview):\n${text || html?.replace(/<[^>]+>/g, ' ').slice(0, 300)}...`);
    console.log('========================================================\n');
    return {
      success: true,
      simulated: true,
      messageId: `sim-${Date.now()}`,
    };
  }

  try {
    const info = await transporter.sendMail({
      from: config.smtp.from,
      to,
      subject,
      text: text || html?.replace(/<[^>]+>/g, ' '),
      html,
    });
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error(`[Email Error] Failed to send email to ${to}:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send Welcome / Registration Submitted Email
 */
async function sendWelcomeEmail({ to, name, memberCode, associationName }) {
  const subject = `Welcome to ${associationName || 'Layout Association'} - Registration Received`;
  const content = `
    <h2>Welcome, ${name}!</h2>
    <p>Thank you for submitting your registration to join <strong>${associationName || 'the Layout Association'}</strong>.</p>
    <div class="info-box">
      <strong>Your Member Code:</strong> ${memberCode || 'Assigned Upon Approval'}<br>
      <strong>Status:</strong> Pending Verification
    </div>
    <p>Your address documents (EB Bill / Property Tax Receipt) are currently under review by the association administration. You will receive an email as soon as your account is approved.</p>
    <p>If you have any questions, please reach out to your layout administrator.</p>
  `;
  return sendEmail({
    to,
    subject,
    html: wrapHtmlLayout('Registration Received', content),
  });
}

/**
 * Send Account Approval Notification Email
 */
async function sendApprovalEmail({ to, name, memberCode, associationName, loginUrl }) {
  const targetLoginUrl = loginUrl || `${config.clientUrl}/login`;
  const subject = `Registration Approved - Welcome to ${associationName || 'Layout Association'}`;
  const content = `
    <h2>Registration Approved!</h2>
    <p>Dear ${name},</p>
    <p>We are pleased to inform you that your registration for <strong>${associationName || 'the Layout Association'}</strong> has been verified and approved!</p>
    <div class="info-box">
      <strong>Your Official Member Code:</strong> <span style="font-size: 18px; color: #1e40af;">${memberCode}</span><br>
      <strong>Login Email / Phone:</strong> ${to}
    </div>
    <p>You can now sign in to access community announcements, voting polls, maintenance fees, and emergency SOS safety features.</p>
    <div style="text-align: center;">
      <a href="${targetLoginUrl}" class="btn">Log In to Your Account</a>
    </div>
  `;
  return sendEmail({
    to,
    subject,
    html: wrapHtmlLayout('Account Approved', content),
  });
}

/**
 * Send Account Rejection Notification Email
 */
async function sendRejectionEmail({ to, name, associationName, reason }) {
  const subject = `Registration Update - ${associationName || 'Layout Association'}`;
  const content = `
    <h2>Registration Status Update</h2>
    <p>Dear ${name},</p>
    <p>Thank you for your interest in joining <strong>${associationName || 'the Layout Association'}</strong>.</p>
    <p>After reviewing your submitted address details and documents, the administration was unable to approve your application at this time.</p>
    <div class="info-box" style="border-left-color: #dc2626; background-color: #fef2f2;">
      <strong>Reason for Rejection:</strong><br>
      ${reason || 'Document verification could not be completed with the provided information.'}
    </div>
    <p>Please contact your layout administrator or re-register with valid supporting documents.</p>
  `;
  return sendEmail({
    to,
    subject,
    html: wrapHtmlLayout('Registration Update', content),
  });
}

/**
 * Send Password Reset Token Email
 */
async function sendPasswordResetEmail({ to, name, resetUrl, expiresInMinutes = 15 }) {
  const subject = 'Password Reset Request - Layout Association';
  const content = `
    <h2>Password Reset Request</h2>
    <p>Hello ${name || 'Resident'},</p>
    <p>We received a request to reset your password. Click the link below to set a new password for your account:</p>
    <div style="text-align: center;">
      <a href="${resetUrl}" class="btn">Reset My Password</a>
    </div>
    <p>This password reset link is valid for <strong>${expiresInMinutes} minutes</strong>.</p>
    <p style="color: #64748b; font-size: 13px;">If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
  `;
  return sendEmail({
    to,
    subject,
    html: wrapHtmlLayout('Password Reset', content),
  });
}

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendApprovalEmail,
  sendRejectionEmail,
  sendPasswordResetEmail,
};
