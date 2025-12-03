import * as brevo from '@getbrevo/brevo';
import logger from './logger.js';
import { loadTemplate } from './emailTemplates/templateLoader.js';

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
    const subject = 'Welcome to AdvoQat – Next Steps';
    const htmlContent = await loadTemplate('barristerWelcome', {
      name: name || 'Barrister'
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
 * Send lawyer/freelancer welcome email
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name
 * @returns {Promise<Object>} - Email sending result
 */
export const sendLawyerWelcomeEmail = async (email, name) => {
  try {
    const subject = 'Welcome to AdvoQat – Registration Under Review';
    const htmlContent = await loadTemplate('lawyerWelcome', {
      name: name || 'Lawyer'
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

