import PDFDocument from 'pdfkit';
import { sql } from '../config/db.js';
import { getAcceptanceRowById } from '../services/engagementService.js';

const ENGAGEMENT_LETTER_VERSION = '2026-03-v1';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isNumericString = (value) => typeof value === 'string' && /^\d+$/.test(value.trim());
const isNumericValue = (value) => typeof value === 'number' && Number.isInteger(value);

async function resolveClientDbId(identifier) {
  if (identifier === null || identifier === undefined) return null;
  if (typeof identifier === 'string' && identifier.includes('-')) {
    const rows = await sql`SELECT id FROM "user" WHERE supabase_id = ${identifier}`;
    return rows.length ? rows[0].id : null;
  }
  if (isNumericValue(identifier)) return identifier;
  if (typeof identifier === 'string') {
    const t = identifier.trim();
    if (isNumericString(t)) return parseInt(t, 10);
    if (emailRegex.test(t.toLowerCase())) {
      const rows = await sql`SELECT id FROM "user" WHERE LOWER(email) = LOWER(${t})`;
      return rows.length ? rows[0].id : null;
    }
  }
  return null;
}

async function resolveLawyerUserId(lawyerIdentifier) {
  if (lawyerIdentifier === null || lawyerIdentifier === undefined) return null;

  const lookup = async (id) => {
    const byFreelancerId = await sql`
      SELECT user_id FROM freelancer WHERE id = ${id} LIMIT 1
    `;
    if (byFreelancerId.length) return byFreelancerId[0].user_id;
    const byUserId = await sql`
      SELECT user_id FROM freelancer WHERE user_id = ${id} LIMIT 1
    `;
    return byUserId.length ? byUserId[0].user_id : null;
  };

  if (isNumericValue(lawyerIdentifier)) {
    return await lookup(lawyerIdentifier);
  }
  if (typeof lawyerIdentifier === 'string') {
    const t = lawyerIdentifier.trim();
    if (isNumericString(t)) return await lookup(parseInt(t, 10));
  }
  return null;
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || null;
}

/** POST /api/engagement/accept */
export async function acceptEngagement(req, res) {
  try {
    const {
      clientId,
      lawyerId,
      signatureName,
      lawyerFirmName,
      lawyerName,
      clientName,
      scope,
      fees,
      liabilityAmount,
    } = req.body;

    const clientDbId = await resolveClientDbId(clientId);
    const lawyerUserId = await resolveLawyerUserId(lawyerId);

    if (!clientDbId || !lawyerUserId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid clientId or lawyerId',
      });
    }

    const firm = (lawyerFirmName || '').trim() || 'Independent practice';
    const lawyerDisp = (lawyerName || '').trim();
    const clientDisp = (clientName || '').trim();
    const scopeText = (scope || '').trim() || 'Legal consultation and related services as agreed for this matter via Advoqat.';
    const feesText = (fees || '').trim() || 'As displayed at booking stage (including consultant fee where applicable).';
    const liabilityText = (liabilityAmount || '').trim() || '10,000';

    const sig = (signatureName || '').trim() || null;
    const ip = clientIp(req);

    const snapshot = {
      template: ENGAGEMENT_LETTER_VERSION,
      lawyerFirmName: firm,
      lawyerName: lawyerDisp,
      clientName: clientDisp,
      scope: scopeText,
      fees: feesText,
      liabilityAmount: liabilityText,
    };

    const existing = await sql`
      SELECT id FROM lawyer_engagement_acceptances
      WHERE client_id = ${clientDbId}
        AND lawyer_user_id = ${lawyerUserId}
        AND engagement_letter_version = ${ENGAGEMENT_LETTER_VERSION}
      LIMIT 1
    `;

    if (existing.length) {
      return res.json({
        success: true,
        data: {
          engagementId: String(existing[0].id),
          alreadyAccepted: true,
          acceptedAt: null,
        },
      });
    }

    const inserted = await sql`
      INSERT INTO lawyer_engagement_acceptances (
        client_id,
        lawyer_user_id,
        engagement_letter_version,
        accepted_at,
        ip_address,
        signature_name,
        lawyer_firm_name,
        lawyer_display_name,
        client_display_name,
        scope_text,
        fees_text,
        liability_text,
        content_snapshot
      ) VALUES (
        ${clientDbId},
        ${lawyerUserId},
        ${ENGAGEMENT_LETTER_VERSION},
        NOW(),
        ${ip},
        ${sig},
        ${firm},
        ${lawyerDisp},
        ${clientDisp},
        ${scopeText},
        ${feesText},
        ${liabilityText},
        ${JSON.stringify(snapshot)}
      )
      RETURNING id, accepted_at
    `;

    return res.status(201).json({
      success: true,
      data: {
        engagementId: String(inserted[0].id),
        acceptedAt: inserted[0].accepted_at,
        alreadyAccepted: false,
      },
    });
  } catch (error) {
    console.error('acceptEngagement error:', error);
    return res.status(500).json({ success: false, error: 'Failed to record engagement' });
  }
}

/** GET /api/engagement/status?clientId=&lawyerId= */
export async function getEngagementStatus(req, res) {
  try {
    const { clientId, lawyerId } = req.query;
    const clientDbId = await resolveClientDbId(clientId);
    const lawyerUserId = await resolveLawyerUserId(lawyerId);

    if (!clientDbId || !lawyerUserId) {
      return res.status(400).json({ success: false, error: 'Invalid clientId or lawyerId' });
    }

    const rows = await sql`
      SELECT id, accepted_at
      FROM lawyer_engagement_acceptances
      WHERE client_id = ${clientDbId}
        AND lawyer_user_id = ${lawyerUserId}
        AND engagement_letter_version = ${ENGAGEMENT_LETTER_VERSION}
      LIMIT 1
    `;

    if (!rows.length) {
      return res.json({
        success: true,
        data: { accepted: false, engagementId: null, acceptedAt: null },
      });
    }

    return res.json({
      success: true,
      data: {
        accepted: true,
        engagementId: String(rows[0].id),
        acceptedAt: rows[0].accepted_at,
        version: ENGAGEMENT_LETTER_VERSION,
      },
    });
  } catch (error) {
    console.error('getEngagementStatus error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load engagement status' });
  }
}

/** GET /api/engagement/client/:userId — list acceptances for a client */
export async function listClientEngagements(req, res) {
  try {
    const { userId } = req.params;
    const clientDbId = await resolveClientDbId(userId);
    if (!clientDbId) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    const rows = await sql`
      SELECT
        e.id,
        e.accepted_at,
        e.engagement_letter_version,
        e.lawyer_firm_name,
        e.lawyer_display_name,
        e.client_display_name,
        e.scope_text,
        e.fees_text,
        e.liability_text,
        u.name AS lawyer_name_live,
        u.email AS lawyer_email
      FROM lawyer_engagement_acceptances e
      LEFT JOIN "user" u ON u.id = e.lawyer_user_id
      WHERE e.client_id = ${clientDbId}
      ORDER BY e.accepted_at DESC
    `;

    return res.json({
      success: true,
      data: rows.map((r) => ({
        engagementId: String(r.id),
        acceptedAt: r.accepted_at,
        version: r.engagement_letter_version,
        lawyerFirmName: r.lawyer_firm_name,
        lawyerName: r.lawyer_display_name || r.lawyer_name_live,
        clientName: r.client_display_name,
        scope: r.scope_text,
        fees: r.fees_text,
        liability: r.liability_text,
        lawyerEmail: r.lawyer_email,
      })),
    });
  } catch (error) {
    console.error('listClientEngagements error:', error);
    return res.status(500).json({ success: false, error: 'Failed to list engagements' });
  }
}

/** GET /api/engagement/pdf/:id?userId= (client must own record) */
export async function downloadEngagementPdf(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).send('Invalid id');
    }

    const { userId } = req.query;
    const clientDbId = await resolveClientDbId(userId);
    if (!clientDbId) {
      return res.status(401).send('Unauthorized');
    }

    const row = await getAcceptanceRowById(id);
    if (!row || row.client_id !== clientDbId) {
      return res.status(404).send('Not found');
    }

    const firm = row.lawyer_firm_name || 'Independent practice';
    const lawyerName = row.lawyer_display_name || row.lawyer_name_resolved || 'Lawyer';
    const clientName = row.client_display_name || row.client_name_resolved || 'Client';
    const scope = row.scope_text || '';
    const fees = row.fees_text || '';
    const liability = row.liability_text || '';
    const accepted = row.accepted_at
      ? new Date(row.accepted_at).toISOString()
      : '';
    const version = row.engagement_letter_version || ENGAGEMENT_LETTER_VERSION;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="engagement-letter-${id}.pdf"`
    );

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    doc.fontSize(16).text('LAWYER ENGAGEMENT LETTER', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).fillColor('#444');
    doc.text(`Version: ${version}`);
    doc.text(`Accepted: ${accepted}`);
    doc.text(`Client IP recorded: ${row.ip_address || '—'}`);
    if (row.signature_name) doc.text(`Acknowledgement (typed name): ${row.signature_name}`);
    doc.fillColor('#000');
    doc.moveDown();

    doc.fontSize(11);
    doc.text(`Lawyer / Firm: ${firm}`);
    doc.text(`Lawyer: ${lawyerName}`);
    doc.text(`Client: ${clientName}`);
    doc.moveDown();

    doc.fontSize(12).text('1. INTRODUCTION', { underline: true });
    doc.fontSize(10).text(
      `This Engagement Letter sets out the terms on which ${lawyerName} (“we”) will provide legal services to you (“Client”). This engagement arises from your connection via Advoqat.`,
      { align: 'justify' }
    );
    doc.moveDown();

    doc.fontSize(12).text('2. STATUS OF ADVOQAT', { underline: true });
    doc.fontSize(10).text(
      'You acknowledge that Advoqat is not a law firm, does not provide legal advice, and is not a party to this agreement. This agreement is solely between you and the Legal Professional.',
      { align: 'justify' }
    );
    doc.moveDown();

    doc.fontSize(12).text('3. SCOPE OF SERVICES', { underline: true });
    doc.fontSize(10).text(scope, { align: 'justify' });
    doc.moveDown();

    doc.fontSize(12).text('4. FEES', { underline: true });
    doc.fontSize(10).text(fees, { align: 'justify' });
    doc.moveDown();

    doc.fontSize(12).text('5. LIMITATION OF LIABILITY', { underline: true });
    doc.fontSize(10).text(
      `Our liability is limited to £${liability} (or as stated in your professional indemnity). We are not liable for indirect or consequential losses or issues arising from incomplete or inaccurate information.`,
      { align: 'justify' }
    );
    doc.moveDown();

    doc.fontSize(12).text('6. GOVERNING LAW', { underline: true });
    doc.fontSize(10).text(
      'This agreement is governed by the laws of England and Wales.',
      { align: 'justify' }
    );

    doc.end();
  } catch (error) {
    console.error('downloadEngagementPdf error:', error);
    if (!res.headersSent) {
      res.status(500).send('Failed to generate PDF');
    }
  }
}

export { ENGAGEMENT_LETTER_VERSION, resolveClientDbId, resolveLawyerUserId };
