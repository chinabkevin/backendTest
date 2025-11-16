import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load and render an email template
 * @param {string} templateName - Name of the template file (without .html extension)
 * @param {Object} variables - Variables to replace in the template (e.g., { name: 'John' })
 * @returns {Promise<string>} - Rendered HTML content
 */
export const loadTemplate = async (templateName, variables = {}) => {
  try {
    const templatePath = path.join(__dirname, `${templateName}.html`);
    
    // Check if template file exists
    if (!fs.existsSync(templatePath)) {
      logger.error(`Email template not found: ${templatePath}`);
      throw new Error(`Email template not found: ${templateName}`);
    }

    // Read template file
    let htmlContent = fs.readFileSync(templatePath, 'utf-8');

    // Replace variables in template
    // Support both {{variable}} and {{ variable }} syntax
    htmlContent = htmlContent.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
      const value = variables[key];
      if (value === undefined || value === null) {
        logger.warn(`Template variable '${key}' not provided, using empty string`);
        return '';
      }
      return String(value);
    });

    // Add default variables if not provided
    if (!variables.year) {
      htmlContent = htmlContent.replace(/\{\{\s*year\s*\}\}/g, new Date().getFullYear().toString());
    }

    return htmlContent;
  } catch (error) {
    logger.error(`Error loading email template ${templateName}:`, error);
    throw error;
  }
};

/**
 * Load base template and inject content
 * @param {string} content - Content to inject into base template
 * @param {Object} variables - Additional variables for the template
 * @returns {Promise<string>} - Rendered HTML content
 */
export const loadBaseTemplate = async (content, variables = {}) => {
  return await loadTemplate('base', {
    ...variables,
    content
  });
};

