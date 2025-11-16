# Email Templates

This directory contains HTML email templates for the AdvoQat platform.

## Structure

- `base.html` - Base template with header, footer, and styling. Use `loadBaseTemplate()` to inject content.
- `documentUploadConfirmation.html` - Template for barrister document upload confirmation emails.
- `templateLoader.js` - Utility functions to load and render templates.

## Usage

### Loading a Template

```javascript
import { loadTemplate } from './emailTemplates/templateLoader.js';

// Load template with variables
const htmlContent = await loadTemplate('documentUploadConfirmation', {
  name: 'John Doe'
});
```

### Template Variables

Templates use `{{variableName}}` syntax for variable replacement:

```html
<h2>Hello {{name}},</h2>
<p>Welcome to {{platformName}}!</p>
```

### Creating New Templates

1. Create a new `.html` file in this directory
2. Use `{{variableName}}` for dynamic content
3. Load it using `loadTemplate('templateName', { variables })`

### Base Template

For emails that need consistent styling, use the base template:

```javascript
import { loadBaseTemplate } from './emailTemplates/templateLoader.js';

const content = `
  <h2>Hello {{name}},</h2>
  <p>Your account has been created successfully.</p>
`;

const htmlContent = await loadBaseTemplate(content, {
  name: 'John Doe'
});
```

## Template Variables

### Common Variables
- `{{name}}` - Recipient name
- `{{year}}` - Current year (auto-populated if not provided)

### Document Upload Confirmation
- `{{name}}` - Barrister name

## Notes

- All templates should be responsive and email-client compatible
- Use inline CSS for better email client support
- Test templates in multiple email clients before deploying

