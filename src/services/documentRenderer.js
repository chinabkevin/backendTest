/**
 * Renders full document content as a .docx with disclaimer footer and metadata.
 * Used only after payment verification.
 */

import {
  Document,
  Paragraph,
  TextRun,
  Footer,
  Packer,
  AlignmentType,
} from 'docx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = process.env.DOCUMENT_UPLOADS_DIR || path.join(__dirname, '../../uploads/documents');

const DISCLAIMER = 'This AI-generated document is not legal advice.';
const METADATA_LINE = 'Document ID: {documentId} | Version: {versionId} | Generated: {timestamp} | Jurisdiction: {jurisdiction} | Risk: {riskLevel}';

/**
 * Build docx from plain text content and metadata.
 * @param {Object} opts
 * @param {string} opts.content - Full document text
 * @param {string} opts.documentId
 * @param {string} opts.versionId
 * @param {string} [opts.jurisdiction]
 * @param {string} [opts.riskLevel]
 * @returns {Promise<Buffer>}
 */
async function renderWordDocument({ content, documentId, versionId, jurisdiction = 'England & Wales', riskLevel = 'Simple' }) {
  const timestamp = new Date().toISOString();
  const paragraphs = content
    .split(/\n+/)
    .filter(Boolean)
    .map(line => new Paragraph({
      children: [new TextRun(line.trim())],
    }));

  const footerText = METADATA_LINE
    .replace('{documentId}', String(documentId))
    .replace('{versionId}', String(versionId))
    .replace('{timestamp}', timestamp)
    .replace('{jurisdiction}', jurisdiction)
    .replace('{riskLevel}', riskLevel);

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        ...paragraphs,
        new Paragraph({ children: [new TextRun('')] }),
        new Paragraph({
          children: [
            new TextRun({
              text: DISCLAIMER,
              italics: true,
              size: 20,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
      ],
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: DISCLAIMER, italics: true, size: 18 }),
              ],
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              children: [new TextRun({ text: footerText, size: 16 })],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
      },
    }],
  });

  return Packer.toBuffer(doc);
}

/**
 * Ensure uploads directory exists and write buffer to user folder.
 * @param {Buffer} buffer
 * @param {number} userId
 * @param {string} documentId
 * @param {string} versionId
 * @returns {Promise<string>} relative path for DB storage
 */
async function saveDocumentToStorage(buffer, userId, documentId, versionId) {
  const dir = path.join(UPLOADS_DIR, String(userId));
  await fs.promises.mkdir(dir, { recursive: true });
  const filename = `doc_${documentId}_v${versionId}.docx`;
  const filePath = path.join(dir, filename);
  await fs.promises.writeFile(filePath, buffer);
  return path.relative(path.join(UPLOADS_DIR, '..'), filePath);
}

export { renderWordDocument, saveDocumentToStorage, UPLOADS_DIR, DISCLAIMER };
