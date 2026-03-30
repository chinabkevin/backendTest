import PDFDocument from 'pdfkit';
import { sql } from '../config/db.js';
import {
  BARRISTER_ENGAGEMENT_VERSION,
  getBarristerAcceptanceRowById,
} from '../services/barristerEngagementService.js';

export { BARRISTER_ENGAGEMENT_VERSION };

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

async function resolveBarristerUserId(raw) {
  if (raw === null || raw === undefined) return null;

  const lookup = async (id) => {
    const byPk = await sql`SELECT user_id FROM barrister WHERE id = ${id} LIMIT 1`;
    if (byPk.length) return byPk[0].user_id;
    const byUser = await sql`SELECT user_id FROM barrister WHERE user_id = ${id} LIMIT 1`;
    return byUser.length ? byUser[0].user_id : null;
  };

  if (isNumericValue(raw)) return await lookup(raw);
  if (typeof raw === 'string') {
    const t = raw.trim();
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

async function verifyBarristerApproved(userId) {
  const rows = await sql`
    SELECT status FROM barrister WHERE user_id = ${userId} LIMIT 1
  `;
  if (!rows.length) return false;
  return (rows[0].status || '').toUpperCase() === 'APPROVED';
}

/** POST /api/barrister/engagement/accept */
export async function acceptBarristerEngagement(req, res) {
  try {
    const {
      clientId,
      barristerId,
      engagementType,
      signatureName,
      barristerName,
      chambersName,
      practisingCertificateNo,
      clientName,
      scope,
      fees,
    } = req.body;

    const type = (engagementType || 'public_access').trim() || 'public_access';
    if (type !== 'public_access') {
      return res.status(400).json({ success: false, error: 'Unsupported engagementType' });
    }

    const clientDbId = await resolveClientDbId(clientId);
    const barristerUserId = await resolveBarristerUserId(barristerId);

    if (!clientDbId || !barristerUserId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid clientId or barristerId',
      });
    }

    const approved = await verifyBarristerApproved(barristerUserId);
    if (!approved) {
      return res.status(400).json({
        success: false,
        error: 'Barrister is not available for Public Access engagement',
      });
    }

    const barristerDisp = (barristerName || '').trim();
    const chambers = (chambersName || '').trim() || 'As disclosed on profile';
    const certNo = (practisingCertificateNo || '').trim() || 'On file with the Bar Standards Board';
    const clientDisp = (clientName || '').trim();
    const scopeText =
      (scope || '').trim() ||
      'Advice, drafting, and conference as appropriate to your instructions under the Public Access scheme (subject to suitability).';
    const feesText =
      (fees || '').trim() ||
      'As agreed in writing (including any fixed fee, brief fee, or hourly rate) before work commences.';
    const sig = (signatureName || '').trim() || null;
    const ip = clientIp(req);

    const snapshot = {
      template: BARRISTER_ENGAGEMENT_VERSION,
      engagementType: type,
      barristerName: barristerDisp,
      chambersName: chambers,
      practisingCertificateNo: certNo,
      clientName: clientDisp,
      scope: scopeText,
      fees: feesText,
      platform: 'One-Tap Legal',
    };

    const existing = await sql`
      SELECT id FROM barrister_engagement_acceptances
      WHERE client_id = ${clientDbId}
        AND barrister_user_id = ${barristerUserId}
        AND engagement_version = ${BARRISTER_ENGAGEMENT_VERSION}
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
      INSERT INTO barrister_engagement_acceptances (
        client_id,
        barrister_user_id,
        engagement_type,
        engagement_version,
        accepted_at,
        ip_address,
        signature_name,
        barrister_display_name,
        chambers_name,
        practising_certificate_no,
        client_display_name,
        scope_text,
        fees_text,
        content_snapshot
      ) VALUES (
        ${clientDbId},
        ${barristerUserId},
        ${type},
        ${BARRISTER_ENGAGEMENT_VERSION},
        NOW(),
        ${ip},
        ${sig},
        ${barristerDisp},
        ${chambers},
        ${certNo},
        ${clientDisp},
        ${scopeText},
        ${feesText},
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
    console.error('acceptBarristerEngagement error:', error);
    return res.status(500).json({ success: false, error: 'Failed to record barrister engagement' });
  }
}

/** GET /api/barrister/engagement/status?clientId=&barristerId= */
export async function getBarristerEngagementStatus(req, res) {
  try {
    const { clientId, barristerId } = req.query;
    const clientDbId = await resolveClientDbId(clientId);
    const barristerUserId = await resolveBarristerUserId(barristerId);

    if (!clientDbId || !barristerUserId) {
      return res.status(400).json({ success: false, error: 'Invalid clientId or barristerId' });
    }

    const rows = await sql`
      SELECT id, accepted_at, engagement_type
      FROM barrister_engagement_acceptances
      WHERE client_id = ${clientDbId}
        AND barrister_user_id = ${barristerUserId}
        AND engagement_version = ${BARRISTER_ENGAGEMENT_VERSION}
      LIMIT 1
    `;

    if (!rows.length) {
      return res.json({
        success: true,
        data: {
          accepted: false,
          engagementId: null,
          acceptedAt: null,
          engagementType: null,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        accepted: true,
        engagementId: String(rows[0].id),
        acceptedAt: rows[0].accepted_at,
        engagementType: rows[0].engagement_type,
        version: BARRISTER_ENGAGEMENT_VERSION,
      },
    });
  } catch (error) {
    console.error('getBarristerEngagementStatus error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load engagement status' });
  }
}

/** GET /api/barrister/engagement/client/:userId — barrister engagements for this client */
export async function listClientBarristerEngagements(req, res) {
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
        e.engagement_version,
        e.engagement_type,
        e.barrister_display_name,
        e.chambers_name,
        e.scope_text,
        e.fees_text,
        u.name AS barrister_name_live,
        u.email AS barrister_email
      FROM barrister_engagement_acceptances e
      LEFT JOIN "user" u ON u.id = e.barrister_user_id
      WHERE e.client_id = ${clientDbId}
      ORDER BY e.accepted_at DESC
    `;

    return res.json({
      success: true,
      data: rows.map((r) => ({
        engagementId: String(r.id),
        acceptedAt: r.accepted_at,
        version: r.engagement_version,
        engagementType: r.engagement_type,
        barristerName: r.barrister_display_name || r.barrister_name_live,
        chambersName: r.chambers_name,
        scope: r.scope_text,
        fees: r.fees_text,
        barristerEmail: r.barrister_email,
        kind: 'barrister_public_access',
      })),
    });
  } catch (error) {
    console.error('listClientBarristerEngagements error:', error);
    return res.status(500).json({ success: false, error: 'Failed to list engagements' });
  }
}

function canAccessPdf(row, userIdQuery) {
  if (!row || !userIdQuery) return false;
  return (
    row.client_id === userIdQuery ||
    row.barrister_user_id === userIdQuery
  );
}

/** GET /api/barrister/engagement/pdf/:id?userId= */
export async function downloadBarristerEngagementPdf(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).send('Invalid id');
    }

    const { userId } = req.query;
    const viewerDbId = await resolveClientDbId(userId);
    if (!viewerDbId) {
      return res.status(401).send('Unauthorized');
    }

    const row = await getBarristerAcceptanceRowById(id);
    if (!row || !canAccessPdf(row, viewerDbId)) {
      return res.status(404).send('Not found');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="barrister-engagement-${id}.pdf"`
    );

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    const bn = row.barrister_display_name || row.barrister_name_resolved || 'Barrister';
    const ch = row.chambers_name || '';
    const cn = row.client_display_name || row.client_name_resolved || 'Client';
    const scope = row.scope_text || '';
    const fees = row.fees_text || '';
    const cert = row.practising_certificate_no || '';
    const accepted = row.accepted_at ? new Date(row.accepted_at).toISOString() : '';

    doc.fontSize(16).text('BARRISTER ENGAGEMENT LETTER (PUBLIC ACCESS)', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).fillColor('#444');
    doc.text(`Version: ${row.engagement_version || BARRISTER_ENGAGEMENT_VERSION}`);
    doc.text(`Accepted: ${accepted}`);
    doc.text(`IP address: ${row.ip_address || '—'}`);
    if (row.signature_name) doc.text(`Client acknowledgement (typed name): ${row.signature_name}`);
    doc.fillColor('#000');
    doc.moveDown();

    doc.fontSize(11);
    doc.text(`Barrister: ${bn}`);
    if (ch) doc.text(`Chambers: ${ch}`);
    doc.text(`Practising certificate reference: ${cert}`);
    doc.text(`Client: ${cn}`);
    doc.moveDown();

    doc.fontSize(12).text('1. INTRODUCTION', { underline: true });
    doc
      .fontSize(10)
      .text(
        `This Engagement Letter sets out the terms on which I, ${bn}, will provide legal services to you (“Client”) under the Public Access scheme. This instruction arises via One-Tap Legal.`,
        { align: 'justify' }
      );
    doc.moveDown();

    doc.fontSize(12).text('2. STATUS OF PLATFORM', { underline: true });
    doc
      .fontSize(10)
      .text(
        'You acknowledge that One-Tap Legal is not a law firm or chambers, does not provide legal advice, and is not a party to this agreement. This agreement is solely between you and the Barrister.',
        { align: 'justify' }
      );
    doc.moveDown();

    doc.fontSize(12).text('3. PUBLIC ACCESS NOTICE', { underline: true });
    doc
      .fontSize(10)
      .text(
        'The Barrister is authorised to accept instructions directly from the public where appropriate. Not all matters are suitable for Public Access; the Barrister may decline instructions if a solicitor is required.',
        { align: 'justify' }
      );
    doc.moveDown();

    doc.fontSize(12).text('4. SCOPE OF SERVICES', { underline: true });
    doc.fontSize(10).text(scope, { align: 'justify' });
    doc.moveDown();

    doc.fontSize(12).text('5. FEES', { underline: true });
    doc.fontSize(10).text(fees, { align: 'justify' });
    doc.moveDown();

    doc.fontSize(12).text('6. LIMITATION OF LIABILITY', { underline: true });
    doc
      .fontSize(10)
      .text(
        'Liability is limited to professional indemnity coverage (including via BMIF or equivalent) as applicable to the Barrister’s practice.',
        { align: 'justify' }
      );
    doc.moveDown();

    doc.fontSize(12).text('7. CONFIDENTIALITY, COMPLAINTS & GOVERNING LAW', { underline: true });
    doc
      .fontSize(10)
      .text(
        'Information will be treated as confidential subject to legal obligations. Complaints should be raised with the Barrister in the first instance; you may escalate to the Legal Ombudsman where applicable. Governing law: England and Wales.',
        { align: 'justify' }
      );

    doc.end();
  } catch (error) {
    console.error('downloadBarristerEngagementPdf error:', error);
    if (!res.headersSent) {
      res.status(500).send('Failed to generate PDF');
    }
  }
}
