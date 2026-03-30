import { sql } from '../config/db.js';

/**
 * @param {number} clientDbId - "user".id for the client
 * @param {number} lawyerUserId - "user".id for the lawyer (freelancer.user_id)
 */
export async function hasAcceptedEngagement(clientDbId, lawyerUserId, version = null) {
  if (!clientDbId || !lawyerUserId) return false;
  const rows = version
    ? await sql`
        SELECT 1 AS ok
        FROM lawyer_engagement_acceptances
        WHERE client_id = ${clientDbId}
          AND lawyer_user_id = ${lawyerUserId}
          AND engagement_letter_version = ${version}
        LIMIT 1
      `
    : await sql`
        SELECT 1 AS ok
        FROM lawyer_engagement_acceptances
        WHERE client_id = ${clientDbId}
          AND lawyer_user_id = ${lawyerUserId}
        LIMIT 1
      `;
  return rows.length > 0;
}

export async function getAcceptanceRowById(id) {
  const rows = await sql`
    SELECT e.*,
           lc.name AS lawyer_name_resolved,
           cc.name AS client_name_resolved
    FROM lawyer_engagement_acceptances e
    LEFT JOIN "user" lc ON lc.id = e.lawyer_user_id
    LEFT JOIN "user" cc ON cc.id = e.client_id
    WHERE e.id = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}
