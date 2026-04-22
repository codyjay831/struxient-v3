export type DeliveryContentVariables = {
  customerName: string;
  projectName: string;
  portalUrl: string;
  companyName: string;
};

export type EmailContent = {
  subject: string;
  body: string;
  html: string;
};

export type SmsContent = {
  body: string;
};

/**
 * Renders the email content for a customer share delivery.
 */
export function renderEmailContent(vars: DeliveryContentVariables, isFollowUp?: boolean): EmailContent {
  const subjectPrefix = isFollowUp ? "FOLLOW-UP: " : "";
  const subject = `${subjectPrefix}Work Evidence Portal: ${vars.projectName}`;
  
  const intro = isFollowUp 
    ? `Following up on your project "${vars.projectName}". Just a reminder that you can view the verified work evidence at the link below:`
    : `You can view the verified work evidence for your project "${vars.projectName}" at the following link:`;

  const body = `Hi ${vars.customerName},\n\n` +
    `${intro}\n\n` +
    `${vars.portalUrl}\n\n` +
    `This portal contains all verified task outcomes, completion notes, and media evidence.\n\n` +
    `Thank you,\n${vars.companyName}`;

  const html = `
    <div style="font-family: sans-serif; line-height: 1.5; color: #111;">
      <p>Hi ${vars.customerName},</p>
      <p>${intro.replace(vars.projectName, `<strong>${vars.projectName}</strong>`)}</p>
      <p><a href="${vars.portalUrl}" style="color: #0284c7; font-weight: bold;">${vars.portalUrl}</a></p>
      <p>This portal contains all verified task outcomes, completion notes, and media evidence.</p>
      <p>Thank you,<br/><strong>${vars.companyName}</strong></p>
    </div>
  `;

  return { subject, body, html };
}

/**
 * Renders the SMS content for a customer share delivery.
 */
export function renderSmsContent(vars: DeliveryContentVariables, isFollowUp?: boolean): SmsContent {
  const msg = isFollowUp
    ? `Follow-up: View your project "${vars.projectName}" evidence at: ${vars.portalUrl}`
    : `Hi ${vars.customerName}, view your project evidence for "${vars.projectName}" at: ${vars.portalUrl}`;
  return {
    body: msg
  };
}

/**
 * Renders the email content for a project-level share delivery.
 */
export function renderProjectEmailContent(vars: DeliveryContentVariables): EmailContent {
  const subject = `Project Evidence Dashboard: ${vars.projectName}`;
  
  const intro = `You can now view the full verified work evidence dashboard for your project "${vars.projectName}" at the following link:`;

  const body = `Hi ${vars.customerName},\n\n` +
    `${intro}\n\n` +
    `${vars.portalUrl}\n\n` +
    `This dashboard provides a roll-up of all verified task outcomes and media evidence across all completed work stages.\n\n` +
    `Thank you,\n${vars.companyName}`;

  const html = `
    <div style="font-family: sans-serif; line-height: 1.5; color: #111;">
      <p>Hi ${vars.customerName},</p>
      <p>${intro.replace(vars.projectName, `<strong>${vars.projectName}</strong>`)}</p>
      <p><a href="${vars.portalUrl}" style="color: #0284c7; font-weight: bold;">${vars.portalUrl}</a></p>
      <p>This dashboard provides a roll-up of all verified task outcomes and media evidence across all completed work stages.</p>
      <p>Thank you,<br/><strong>${vars.companyName}</strong></p>
    </div>
  `;

  return { subject, body, html };
}

/**
 * Renders the SMS content for a project-level share delivery.
 */
export function renderProjectSmsContent(vars: DeliveryContentVariables): SmsContent {
  const msg = `Hi ${vars.customerName}, view your full project evidence dashboard for "${vars.projectName}" at: ${vars.portalUrl}`;
  return {
    body: msg
  };
}

export type QuotePortalDeliveryVariables = {
  customerName: string;
  quoteNumber: string;
  versionNumber: number;
  portalUrl: string;
  companyName: string;
};

export function renderQuotePortalEmailContent(
  vars: QuotePortalDeliveryVariables,
  isFollowUp?: boolean,
): EmailContent {
  const label = `Quote ${vars.quoteNumber} (v${vars.versionNumber})`;
  const subjectPrefix = isFollowUp ? "FOLLOW-UP: " : "";
  const subject = `${subjectPrefix}Review & sign: ${label}`;

  const intro = isFollowUp
    ? `Following up on ${label}. Please review and accept at the secure link below:`
    : `You can review and electronically accept ${label} at the following secure link:`;

  const body =
    `Hi ${vars.customerName},\n\n` +
    `${intro}\n\n` +
    `${vars.portalUrl}\n\n` +
    `This link shows the proposal as frozen when it was sent.\n\n` +
    `Thank you,\n${vars.companyName}`;

  const html = `
    <div style="font-family: sans-serif; line-height: 1.5; color: #111;">
      <p>Hi ${vars.customerName},</p>
      <p>${intro.replace(label, `<strong>${label}</strong>`)}</p>
      <p><a href="${vars.portalUrl}" style="color: #0284c7; font-weight: bold;">${vars.portalUrl}</a></p>
      <p>This link shows the proposal as frozen when it was sent.</p>
      <p>Thank you,<br/><strong>${vars.companyName}</strong></p>
    </div>
  `;

  return { subject, body, html };
}

export function renderQuotePortalSmsContent(vars: QuotePortalDeliveryVariables, isFollowUp?: boolean): SmsContent {
  const label = `${vars.quoteNumber} v${vars.versionNumber}`;
  const body = isFollowUp
    ? `Follow-up: Review & sign quote ${label}: ${vars.portalUrl}`
    : `Hi ${vars.customerName}, review & sign quote ${label}: ${vars.portalUrl}`;
  return { body };
}
