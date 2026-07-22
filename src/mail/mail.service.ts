import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { AppConfigService } from '../config/app-config.service';

export interface SendInviteEmailInput {
  to: string;
  displayName: string;
  invitedByDisplayName: string;
  inviteUrl: string;
  expiresAt: Date;
}

export interface SendPasswordResetEmailInput {
  to: string;
  displayName: string;
  resetUrl: string;
  expiresAt: Date;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly fromEmail: string;

  constructor(configService: AppConfigService) {
    const apiKey = configService.get('mail.resendApiKey');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.fromEmail = configService.get('mail.fromEmail');
  }

  async sendInviteEmail(input: SendInviteEmailInput): Promise<void> {
    if (!this.resend) {
      // No API key: log the link instead of failing, for local/CI testing.
      this.logger.warn(
        `RESEND_API_KEY is not configured; logging the invite link for ${input.to} instead of emailing it.`,
      );
      this.logger.log(`Invite link for ${input.to}: ${input.inviteUrl}`);
      return;
    }

    const result = await this.resend.emails.send({
      from: this.fromEmail,
      to: input.to,
      subject: "You're invited to Internal ID",
      html: renderInviteEmailHtml(input),
      text: renderInviteEmailText(input),
    });

    if (result.error) {
      throw new Error(`Failed to send invite email: ${result.error.message}`);
    }
  }

  async sendPasswordResetEmail(
    input: SendPasswordResetEmailInput,
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `RESEND_API_KEY is not configured; logging the password reset link for ${input.to} instead of emailing it.`,
      );
      this.logger.log(`Password reset link for ${input.to}: ${input.resetUrl}`);
      return;
    }

    const result = await this.resend.emails.send({
      from: this.fromEmail,
      to: input.to,
      subject: 'Reset your Internal ID password',
      html: renderPasswordResetEmailHtml(input),
      text: renderPasswordResetEmailText(input),
    });

    if (result.error) {
      throw new Error(
        `Failed to send password reset email: ${result.error.message}`,
      );
    }
  }
}

function renderInviteEmailText(input: SendInviteEmailInput): string {
  return [
    `Hi ${input.displayName},`,
    '',
    `${input.invitedByDisplayName} invited you to Internal ID.`,
    'Set your password to finish setting up your account:',
    input.inviteUrl,
    '',
    `This link expires on ${input.expiresAt.toUTCString()}.`,
  ].join('\n');
}

function renderInviteEmailHtml(input: SendInviteEmailInput): string {
  return [
    '<!doctype html>',
    '<html><body style="font-family: ui-sans-serif, system-ui, sans-serif; color: #181a1f;">',
    `<p>Hi ${escapeHtml(input.displayName)},</p>`,
    `<p>${escapeHtml(input.invitedByDisplayName)} invited you to Internal ID.</p>`,
    `<p><a href="${escapeHtml(input.inviteUrl)}" style="display:inline-block;background:#4b7fe0;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Set your password</a></p>`,
    `<p style="color:#6b7280;font-size:13px;">This link expires on ${escapeHtml(input.expiresAt.toUTCString())}.</p>`,
    '</body></html>',
  ].join('');
}

function renderPasswordResetEmailText(
  input: SendPasswordResetEmailInput,
): string {
  return [
    `Hi ${input.displayName},`,
    '',
    'We received a request to reset your Internal ID password.',
    'Choose a new password:',
    input.resetUrl,
    '',
    `This link expires on ${input.expiresAt.toUTCString()}.`,
    'If you did not request this, you can safely ignore this email.',
  ].join('\n');
}

function renderPasswordResetEmailHtml(
  input: SendPasswordResetEmailInput,
): string {
  return [
    '<!doctype html>',
    '<html><body style="font-family: ui-sans-serif, system-ui, sans-serif; color: #181a1f;">',
    `<p>Hi ${escapeHtml(input.displayName)},</p>`,
    '<p>We received a request to reset your Internal ID password.</p>',
    `<p><a href="${escapeHtml(input.resetUrl)}" style="display:inline-block;background:#4b7fe0;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Choose a new password</a></p>`,
    `<p style="color:#6b7280;font-size:13px;">This link expires on ${escapeHtml(input.expiresAt.toUTCString())}. If you did not request this, you can safely ignore this email.</p>`,
    '</body></html>',
  ].join('');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
