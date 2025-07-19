# Document Generator API Setup

## Environment Variables

Add the following to your `.env` file:

```env
# AI Document Generation
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

## Getting OpenRouter API Key

1. Go to [OpenRouter](https://openrouter.ai/)
2. Sign up for a free account
3. Get your API key from the dashboard
4. Add it to your `.env` file

## API Endpoints

### Document Generation
- `POST /api/v1/documents/generate` - Generate a new document
- `GET /api/v1/documents/templates` - Get available templates
- `GET /api/v1/documents/user` - Get user's documents
- `GET /api/v1/documents/:id` - Get specific document
- `DELETE /api/v1/documents/:id` - Delete document

## Document Templates

Currently supported templates:
- **NDA** (Non-Disclosure Agreement)
- **Employment Contract**
- **Rental Agreement**
- **Service Agreement**

## Database Schema

The documents table stores:
- User ID (linked to user table)
- Template ID and name
- Form data (JSON)
- Generated document content
- Document type and status
- Creation and update timestamps

## Usage

1. Start the backend server
2. Ensure your frontend is pointing to the correct API endpoints
3. Test document generation through the UI
4. Documents are automatically saved to the database 