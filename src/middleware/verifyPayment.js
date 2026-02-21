import { sql } from '../config/db.js';

/**
 * Ensures the document has been paid for before allowing download.
 * Use on GET /documents/download/:id only.
 */
export async function verifyDocumentPayment(req, res, next) {
  try {
    const documentId = req.params.id;
    const [doc] = await sql`
      SELECT id, user_id, payment_status, generated_file_path
      FROM documents
      WHERE id = ${documentId}
    `;
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    if (doc.payment_status !== 'paid') {
      return res.status(403).json({ error: 'Payment required to download this document' });
    }
    if (!doc.generated_file_path) {
      return res.status(503).json({ error: 'Document file is being prepared. Please try again shortly.' });
    }
    req.document = doc;
    next();
  } catch (err) {
    console.error('verifyDocumentPayment error:', err);
    res.status(500).json({ error: 'Failed to verify document access' });
  }
}
