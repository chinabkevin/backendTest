import * as brevo from '@getbrevo/brevo';
import logger from './logger.js';
import { loadTemplate, loadBaseTemplate } from './emailTemplates/templateLoader.js';

// Initialize Brevo API client
let apiInstance = null;

const initializeBrevo = () => {
  if (!apiInstance && process.env.BREVO_API_KEY) {
    apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
  }
  return apiInstance;
};
/**
 * Send email using Brevo
 * @param {Object} options - Email options
 * @param {string|string[]} options.to - Recipient email(s)
 * @param {string} options.subject - Email subject
 * @param {string} options.htmlContent - HTML email content
 * @param {string} [options.textContent] - Plain text email content
 * @param {string} [options.fromEmail] - Sender email (defaults to env variable)
 * @param {string} [options.fromName] - Sender name
 * @returns {Promise<Object>} - Brevo API response
 */
export const sendEmail = async ({
  to,
  subject,
  htmlContent,
  textContent,
  fromEmail = process.env.BREVO_FROM_EMAIL || 'noreply@advoqat.com',
  fromName = process.env.BREVO_FROM_NAME || 'AdvoQat'
}) => {
  try {
    const apiInstance = initializeBrevo();
    
    if (!apiInstance) {
      logger.warn('Brevo API not configured. Email sending is disabled.');
      return {
        success: false,
        error: 'Email service not configured'
      };
    }

    // Convert single email to array
    const recipients = Array.isArray(to) ? to : [to];

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = htmlContent;
    sendSmtpEmail.textContent = textContent || htmlContent.replace(/<[^>]*>/g, '');
    sendSmtpEmail.sender = {
      name: fromName,
      email: fromEmail
    };
    sendSmtpEmail.to = recipients.map(email => ({ email }));

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    
    logger.log('Email sent successfully:', {
      messageId: result.messageId,
      to: recipients
    });

    return {
      success: true,
      messageId: result.messageId
    };
  } catch (error) {
    logger.error('Error sending email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email'
    };
  }
};

/**
 * Send barrister document upload confirmation email
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name
 * @returns {Promise<Object>} - Email sending result
 */
export const sendDocumentUploadConfirmation = async (email, name) => {
  try {
    const subject = 'Documents Received - Under Review';
    
    // Load template with variables
    const htmlContent = await loadTemplate('documentUploadConfirmation', {
      name: name || 'there'
    });

    return await sendEmail({
      to: email,
      subject,
      htmlContent
    });
  } catch (error) {
    logger.error('Error sending document upload confirmation email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email'
    };
  }
};

export const sendBarristerWelcomeEmail = async (email, name) => {
  try {
    const subject = 'Welcome to AdvoQat – Complete Your Onboarding';
    const baseUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL?.replace('/api', '') || 'https://advoqat.com';
    const dashboardUrl = `${baseUrl}/signup/barrister/documents`;
    
    const htmlContent = await loadTemplate('barristerWelcome', {
      name: name || 'Barrister',
      dashboardUrl: dashboardUrl,
      year: new Date().getFullYear()
    });

    return await sendEmail({
      to: email,
      subject,
      htmlContent
    });
  } catch (error) {
    logger.error('Error sending barrister welcome email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send welcome email'
    };
  }
};

/**
 * Send client/user welcome email
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name
 * @param {string} [dashboardUrl] - Optional dashboard URL
 * @returns {Promise<Object>} - Email sending result
 */
export const sendClientWelcomeEmail = async (email, name, dashboardUrl = null) => {
  try {
    const subject = 'Welcome to AdvoQat – Your Legal Journey Starts Here';
    const baseUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL?.replace('/api', '') || 'https://advoqat.com';
    const url = dashboardUrl || `${baseUrl}/dashboard`;
    
    const htmlContent = await loadTemplate('clientWelcome', {
      name: name || 'there',
      dashboardUrl: url,
      year: new Date().getFullYear()
    });

    return await sendEmail({
      to: email,
      subject,
      htmlContent
    });
  } catch (error) {
    logger.error('Error sending client welcome email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send welcome email'
    };
  }
};

/**
 * Send lawyer/freelancer welcome email
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name
 * @returns {Promise<Object>} - Email sending result
 */
export const sendLawyerWelcomeEmail = async (email, name) => {
  try {
    const subject = 'Welcome to AdvoQat – Registration Under Review';
    const htmlContent = await loadTemplate('lawyerWelcome', {
      name: name || 'Lawyer',
      year: new Date().getFullYear()
    });

    return await sendEmail({
      to: email,
      subject,
      htmlContent
    });
  } catch (error) {
    logger.error('Error sending lawyer welcome email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send welcome email'
    };
  }
};

/**
 * Send case accepted email notification
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name
 * @param {string} caseTitle - Case title
 * @returns {Promise<Object>} - Email sending result
 */
export const sendCaseAcceptedEmail = async (email, name, caseTitle) => {
  try {
    const subject = 'Case Accepted - Your Case is Now Active';
    // Load the content template and wrap it in base template
    const content = await loadTemplate('caseAccepted', {
      name: name || 'Client',
      caseTitle: caseTitle || 'Your case'
    });
    const htmlContent = await loadBaseTemplate(content, {
      name: name || 'Client'
    });

    return await sendEmail({
      to: email,
      subject,
      htmlContent
    });
  } catch (error) {
    logger.error('Error sending case accepted email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send case accepted email'
    };
  }
};

/**
 * Send case declined email notification
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name
 * @param {string} caseTitle - Case title
 * @returns {Promise<Object>} - Email sending result
 */
export const sendCaseDeclinedEmail = async (email, name, caseTitle) => {
  try {
    const subject = 'Case Update - Case Declined';
    // Load the content template and wrap it in base template
    const content = await loadTemplate('caseDeclined', {
      name: name || 'Client',
      caseTitle: caseTitle || 'Your case'
    });
    const htmlContent = await loadBaseTemplate(content, {
      name: name || 'Client'
    });

    return await sendEmail({
      to: email,
      subject,
      htmlContent
    });
  } catch (error) {
    logger.error('Error sending case declined email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send case declined email'
    };
  }
};

/**
 * Send case assigned email notification to lawyer/freelancer
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name
 * @param {string} caseTitle - Case title
 * @param {Object} caseDetails - Additional case details (expertiseArea, priority, jurisdiction)
 * @returns {Promise<Object>} - Email sending result
 */
export const sendCaseAssignedEmail = async (email, name, caseTitle, caseDetails = {}) => {
  try {
    const subject = 'New Case Assigned - Action Required';
    
    // Build case details HTML
    let caseDetailsHtml = `<li><strong>Case Title:</strong> ${caseTitle || 'N/A'}</li>`;
    if (caseDetails.expertiseArea) {
      caseDetailsHtml += `<li><strong>Expertise Area:</strong> ${caseDetails.expertiseArea}</li>`;
    }
    if (caseDetails.priority) {
      caseDetailsHtml += `<li><strong>Priority:</strong> ${caseDetails.priority}</li>`;
    }
    if (caseDetails.jurisdiction) {
      caseDetailsHtml += `<li><strong>Jurisdiction:</strong> ${caseDetails.jurisdiction}</li>`;
    }
    
    // Load the content template and replace variables
    let content = await loadTemplate('caseAssigned', {
      name: name || 'Lawyer',
      caseTitle: caseTitle || 'New Case',
      expertiseArea: caseDetails.expertiseArea ? `<li><strong>Expertise Area:</strong> ${caseDetails.expertiseArea}</li>` : '',
      priority: caseDetails.priority ? `<li><strong>Priority:</strong> ${caseDetails.priority}</li>` : '',
      jurisdiction: caseDetails.jurisdiction ? `<li><strong>Jurisdiction:</strong> ${caseDetails.jurisdiction}</li>` : ''
    });
    
    // Wrap in base template
    const htmlContent = await loadBaseTemplate(content, {
      name: name || 'Lawyer'
    });

    return await sendEmail({
      to: email,
      subject,
      htmlContent
    });
  } catch (error) {
    logger.error('Error sending case assigned email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send case assigned email'
    };
  }
};

