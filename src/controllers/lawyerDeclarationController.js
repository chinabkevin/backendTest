import PDFDocument from 'pdfkit';
import { sql } from '../config/db.js';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isNumericString = (value) => typeof value === 'string' && /^\d+$/.test(value.trim());
const isNumericValue = (value) => typeof value === 'number' && Number.isInteger(value);

async function resolveUserDbId(identifier) {
  if (identifier === null || identifier === undefined) return null;
  if (typeof identifier === 'string' && identifier.includes('-')) {
    const rows = await sql`SELECT id, role FROM "user" WHERE supabase_id = ${identifier}`;
    return rows.length ? rows[0] : null;
  }
  if (isNumericValue(identifier)) {
    const rows = await sql`SELECT id, role FROM "user" WHERE id = ${identifier}`;
    return rows.length ? rows[0] : null;
  }
  if (typeof identifier === 'string') {
    const t = identifier.trim();
    if (isNumericString(t)) {
      const id = parseInt(t, 10);
      const rows = await sql`SELECT id, role FROM "user" WHERE id = ${id}`;
      return rows.length ? rows[0] : null;
    }
    if (emailRegex.test(t.toLowerCase())) {
      const rows = await sql`SELECT id, role FROM "user" WHERE LOWER(email) = LOWER(${t})`;
      return rows.length ? rows[0] : null;
    }
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

function isAdminRequest(req) {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) return false;
  const k = req.headers['x-admin-key'];
  return typeof k === 'string' && k === expected;
}

function validatePayload(body) {
  const {
    fullName,
    firmName,
    regulatoryBody,
    isBarrister,
    declarations,
    platformAgreement,
    dataProtection,
    signature,
    date,
  } = body;

  if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
    return { ok: false, error: 'fullName is required' };
  }
  if (!regulatoryBody || typeof regulatoryBody !== 'string' || !regulatoryBody.trim()) {
    return { ok: false, error: 'regulatoryBody is required' };
  }
  if (!signature || typeof signature !== 'string' || !signature.trim()) {
    return { ok: false, error: 'signature is required' };
  }
  if (!declarations || typeof declarations !== 'object') {
    return { ok: false, error: 'declarations object is required' };
  }
  if (!platformAgreement || typeof platformAgreement !== 'object') {
    return { ok: false, error: 'platformAgreement object is required' };
  }
  if (!dataProtection || typeof dataProtection !== 'object') {
    return { ok: false, error: 'dataProtection object is required' };
  }

  const barrister = isBarrister === true;
  const d = declarations;
  const requiredDecl = [
    'practisingCertificate',
    'authorisedJurisdiction',
    'indemnityInsurance',
    'regulatoryCompliance',
    'independence',
  ];
  for (const key of requiredDecl) {
    if (d[key] !== true) {
      return { ok: false, error: `Declaration "${key}" must be accepted` };
    }
  }
  if (barrister && d.publicAccess !== true) {
    return { ok: false, error: 'Barristers must confirm Public Access authorisation' };
  }

  const p = platformAgreement;
  if (p.independentContractor !== true || p.notPlatformRepresentative !== true || p.fullResponsibility !== true) {
    return { ok: false, error: 'All platform relationship confirmations are required' };
  }

  const dp = dataProtection;
  if (dp.independentController !== true || dp.lawfulProcessing !== true) {
    return { ok: false, error: 'All data protection confirmations are required' };
  }

  let signatureDate = null;
  if (date) {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: 'Invalid date' };
    }
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    if (parsed > end) {
      return { ok: false, error: 'Signature date cannot be in the future' };
    }
    signatureDate = parsed.toISOString().slice(0, 10);
  }

  return {
    ok: true,
    value: {
      fullName: fullName.trim(),
      firmName: typeof firmName === 'string' ? firmName.trim() || null : null,
      regulatoryBody: regulatoryBody.trim(),
      isBarrister: barrister,
      declarations: {
        practisingCertificate: true,
        authorisedJurisdiction: true,
        indemnityInsurance: true,
        publicAccess: barrister ? true : false,
        regulatoryCompliance: true,
        independence: true,
      },
      platformAgreement: {
        independentContractor: true,
        notPlatformRepresentative: true,
        fullResponsibility: true,
      },
      dataProtection: {
        independentController: true,
        lawfulProcessing: true,
      },
      signatureText: signature.trim(),
      signatureDate: signatureDate || new Date().toISOString().slice(0, 10),
    },
  };
}

/** POST /api/lawyer/declaration */
export async function submitLawyerDeclaration(req, res) {
  try {
    const lawyerId = req.body.lawyerId;
    const userRow = await resolveUserDbId(lawyerId);
    if (!userRow || userRow.role !== 'freelancer') {
      return res.status(403).json({
        success: false,
        error: 'Invalid lawyer account',
      });
    }

    const validated = validatePayload({
      ...req.body,
      fullName: req.body.fullName ?? req.body.full_name,
      firmName: req.body.firmName ?? req.body.firm_name,
      regulatoryBody: req.body.regulatoryBody ?? req.body.regulatory_body,
      isBarrister: req.body.isBarrister ?? req.body.is_barrister,
      platformAgreement: req.body.platformAgreement ?? req.body.platform_agreement,
      dataProtection: req.body.dataProtection ?? req.body.data_protection,
      signature: req.body.signature ?? req.body.signatureText,
      date: req.body.date ?? req.body.signedAt,
    });
    if (!validated.ok) {
      return res.status(400).json({ success: false, error: validated.error });
    }

    const v = validated.value;
    const existing = await sql`
      SELECT id FROM lawyer_declarations WHERE lawyer_user_id = ${userRow.id} LIMIT 1
    `;
    if (existing.length) {
      return res.status(409).json({
        success: false,
        error: 'DECLARATION_ALREADY_SUBMITTED',
        message: 'A declaration is already on file for this lawyer. It cannot be amended through this form.',
      });
    }

    const fr = await sql`
      SELECT user_id FROM freelancer WHERE user_id = ${userRow.id} LIMIT 1
    `;
    if (!fr.length) {
      return res.status(400).json({ success: false, error: 'Freelancer profile not found' });
    }

    const ip = clientIp(req);
    const inserted = await sql`
      INSERT INTO lawyer_declarations (
        lawyer_user_id,
        full_name,
        firm_name,
        regulatory_body,
        is_barrister,
        declarations,
        platform_agreement,
        data_protection,
        signature_text,
        signature_date,
        ip_address
      ) VALUES (
        ${userRow.id},
        ${v.fullName},
        ${v.firmName},
        ${v.regulatoryBody},
        ${v.isBarrister},
        ${JSON.stringify(v.declarations)},
        ${JSON.stringify(v.platformAgreement)},
        ${JSON.stringify(v.dataProtection)},
        ${v.signatureText},
        ${v.signatureDate},
        ${ip}
      )
      RETURNING id, signed_at, created_at
    `;

    return res.status(201).json({
      success: true,
      data: {
        declarationId: String(inserted[0].id),
        signedAt: inserted[0].signed_at,
        createdAt: inserted[0].created_at,
      },
    });
  } catch (error) {
    console.error('submitLawyerDeclaration error:', error);
    return res.status(500).json({ success: false, error: 'Failed to save declaration' });
  }
}

/** GET /api/lawyer/declaration/status?lawyerId= */
export async function getLawyerDeclarationStatus(req, res) {
  try {
    const { lawyerId } = req.query;
    const userRow = await resolveUserDbId(lawyerId);
    if (!userRow || userRow.role !== 'freelancer') {
      return res.status(403).json({ success: false, error: 'Invalid lawyer account' });
    }

    const dec = await sql`
      SELECT id, signed_at FROM lawyer_declarations WHERE lawyer_user_id = ${userRow.id} LIMIT 1
    `;
    const fr = await sql`
      SELECT verification_status, is_verified FROM freelancer WHERE user_id = ${userRow.id} LIMIT 1
    `;

    const submitted = dec.length > 0;
    const verificationStatus = fr.length ? fr[0].verification_status : 'pending';
    const approved = verificationStatus === 'approved';

    return res.json({
      success: true,
      data: {
        submitted,
        approved,
        verificationStatus,
        signedAt: dec[0]?.signed_at ?? null,
        declarationId: dec[0] ? String(dec[0].id) : null,
      },
    });
  } catch (error) {
    console.error('getLawyerDeclarationStatus error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load status' });
  }
}

async function getDeclarationRowForLawyerUserId(lawyerUserId) {
  const rows = await sql`
    SELECT * FROM lawyer_declarations WHERE lawyer_user_id = ${lawyerUserId} LIMIT 1
  `;
  return rows.length ? rows[0] : null;
}

/** GET /api/lawyer/declaration/me?lawyerId= — stored record (lawyer only) */
export async function getMyLawyerDeclaration(req, res) {
  try {
    const { lawyerId } = req.query;
    const userRow = await resolveUserDbId(lawyerId);
    if (!userRow || userRow.role !== 'freelancer') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const row = await getDeclarationRowForLawyerUserId(userRow.id);
    if (!row) {
      return res.status(404).json({ success: false, error: 'No declaration on file' });
    }
    return res.json({
      success: true,
      data: formatDeclarationRow(row),
    });
  } catch (error) {
    console.error('getMyLawyerDeclaration error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load declaration' });
  }
}

function formatDeclarationRow(row) {
  return {
    id: String(row.id),
    lawyerUserId: row.lawyer_user_id,
    fullName: row.full_name,
    firmName: row.firm_name,
    regulatoryBody: row.regulatory_body,
    isBarrister: row.is_barrister,
    declarations: row.declarations,
    platformAgreement: row.platform_agreement,
    dataProtection: row.data_protection,
    signatureText: row.signature_text,
    signedAt: row.signed_at,
    signatureDate: row.signature_date,
    ipAddress: row.ip_address,
    createdAt: row.created_at,
  };
}

/** GET /api/lawyer/declaration/pdf/:lawyerUserId?requesterId= */
export async function downloadLawyerDeclarationPdf(req, res) {
  try {
    const paramId = req.params.lawyerUserId || req.params.lawyerId;
    const { requesterId } = req.query;

    const targetRow = await resolveUserDbId(paramId);
    if (!targetRow) {
      return res.status(404).send('Not found');
    }

    const row = await getDeclarationRowForLawyerUserId(targetRow.id);
    if (!row) {
      return res.status(404).send('Declaration not found');
    }

    const requester = requesterId ? await resolveUserDbId(requesterId) : null;
    const admin = isAdminRequest(req);
    const own =
      requester &&
      requester.id === targetRow.id &&
      requester.role === 'freelancer';

    if (!own && !admin) {
      return res.status(403).send('Forbidden');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="lawyer-declaration-${row.id}.pdf"`
    );

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    doc.fontSize(16).text('LAWYER DECLARATION', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#444');
    doc.text(`Recorded: ${new Date(row.signed_at).toISOString()}`);
    doc.text(`IP address: ${row.ip_address || '—'}`);
    doc.text(`Declaration ID: ${row.id}`);
    doc.fillColor('#000');
    doc.moveDown();

    doc.fontSize(11);
    doc.text(`Legal professional: ${row.full_name}`);
    if (row.firm_name) doc.text(`Firm: ${row.firm_name}`);
    doc.text(`Regulatory body: ${row.regulatory_body}`);
    doc.text(`Barrister (Public Access applies): ${row.is_barrister ? 'Yes' : 'No'}`);
    doc.moveDown();

    const labels = [
      ['Practising certificate', row.declarations?.practisingCertificate],
      ['Authorised in jurisdiction', row.declarations?.authorisedJurisdiction],
      ['Professional indemnity insurance', row.declarations?.indemnityInsurance],
      ['Public Access work (barristers)', row.declarations?.publicAccess],
      ['Regulatory compliance', row.declarations?.regulatoryCompliance],
      ['Independence / not representing platform (declarations)', row.declarations?.independence],
    ];
    doc.fontSize(12).text('Declarations', { underline: true });
    doc.fontSize(10);
    labels.forEach(([label, ok]) => {
      doc.text(`${ok === true ? '[x]' : '[ ]'} ${label}`);
    });
    doc.moveDown();

    doc.fontSize(12).text('Platform relationship', { underline: true });
    doc.fontSize(10);
    doc.text(`${row.platform_agreement?.independentContractor ? '[x]' : '[ ]'} Independent contractor`);
    doc.text(`${row.platform_agreement?.notPlatformRepresentative ? '[x]' : '[ ]'} Not representing Advoqat as employer/partnership`);
    doc.text(`${row.platform_agreement?.fullResponsibility ? '[x]' : '[ ]'} Full responsibility for legal services`);
    doc.moveDown();

    doc.fontSize(12).text('Data protection', { underline: true });
    doc.fontSize(10);
    doc.text(`${row.data_protection?.independentController ? '[x]' : '[ ]'} Independent data controller`);
    doc.text(`${row.data_protection?.lawfulProcessing ? '[x]' : '[ ]'} Lawful processing of client data`);
    doc.moveDown();

    doc.fontSize(12).text('Signature', { underline: true });
    doc.fontSize(10);
    doc.text(`Signed as: ${row.signature_text}`);
    doc.text(`Date: ${row.signature_date}`);

    doc.end();
  } catch (error) {
    console.error('downloadLawyerDeclarationPdf error:', error);
    if (!res.headersSent) {
      res.status(500).send('Failed to generate PDF');
    }
  }
}

/** GET /api/admin/onboarding/lawyers */
export async function adminListLawyersOnboarding(req, res) {
  try {
    const rows = await sql`
      SELECT
        f.user_id,
        f.name,
        f.email,
        f.phone,
        f.verification_status,
        f.is_verified,
        f.created_at as freelancer_created_at,
        d.id as declaration_id,
        d.signed_at as declaration_signed_at,
        d.full_name as declaration_full_name,
        d.signature_text,
        u.supabase_id
      FROM freelancer f
      JOIN "user" u ON u.id = f.user_id
      LEFT JOIN lawyer_declarations d ON d.lawyer_user_id = f.user_id
      ORDER BY f.created_at DESC
    `;

    return res.json({
      success: true,
      data: rows.map((r) => ({
        userId: r.user_id,
        supabaseId: r.supabase_id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        verificationStatus: r.verification_status,
        isVerified: r.is_verified,
        declarationSubmitted: !!r.declaration_id,
        declarationId: r.declaration_id ? String(r.declaration_id) : null,
        declarationSignedAt: r.declaration_signed_at,
        declarationFullName: r.declaration_full_name,
        canApprove: !!r.declaration_id && r.verification_status === 'pending',
        freelancerCreatedAt: r.freelancer_created_at,
      })),
    });
  } catch (error) {
    console.error('adminListLawyersOnboarding error:', error);
    return res.status(500).json({ success: false, error: 'Failed to list lawyers' });
  }
}

/** GET /api/admin/onboarding/lawyers/:userId/declaration */
export async function adminGetLawyerDeclaration(req, res) {
  try {
    const { userId } = req.params;
    const userRow = await resolveUserDbId(userId);
    if (!userRow) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const row = await getDeclarationRowForLawyerUserId(userRow.id);
    if (!row) {
      return res.status(404).json({ success: false, error: 'No declaration on file' });
    }
    return res.json({ success: true, data: formatDeclarationRow(row) });
  } catch (error) {
    console.error('adminGetLawyerDeclaration error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load declaration' });
  }
}

/** POST /api/admin/onboarding/lawyers/:userId/approve */
export async function adminApproveLawyer(req, res) {
  try {
    const { userId } = req.params;
    const userRow = await resolveUserDbId(userId);
    if (!userRow || userRow.role !== 'freelancer') {
      return res.status(404).json({ success: false, error: 'Freelancer not found' });
    }
    const dec = await sql`SELECT id FROM lawyer_declarations WHERE lawyer_user_id = ${userRow.id} LIMIT 1`;
    if (!dec.length) {
      return res.status(400).json({
        success: false,
        error: 'Declaration must be submitted before approval',
      });
    }

    await sql`
      UPDATE freelancer
      SET
        verification_status = 'approved',
        is_verified = true,
        verification_notes = NULL,
        updated_at = NOW()
      WHERE user_id = ${userRow.id}
    `;

    return res.json({ success: true, message: 'Lawyer approved' });
  } catch (error) {
    console.error('adminApproveLawyer error:', error);
    return res.status(500).json({ success: false, error: 'Approval failed' });
  }
}

/** POST /api/admin/onboarding/lawyers/:userId/reject */
export async function adminRejectLawyer(req, res) {
  try {
    const { userId } = req.params;
    const { notes } = req.body || {};
    const userRow = await resolveUserDbId(userId);
    if (!userRow || userRow.role !== 'freelancer') {
      return res.status(404).json({ success: false, error: 'Freelancer not found' });
    }

    await sql`
      UPDATE freelancer
      SET
        verification_status = 'rejected',
        is_verified = false,
        verification_notes = ${typeof notes === 'string' ? notes.slice(0, 2000) : null},
        updated_at = NOW()
      WHERE user_id = ${userRow.id}
    `;

    return res.json({ success: true, message: 'Lawyer application rejected' });
  } catch (error) {
    console.error('adminRejectLawyer error:', error);
    return res.status(500).json({ success: false, error: 'Rejection failed' });
  }
}
