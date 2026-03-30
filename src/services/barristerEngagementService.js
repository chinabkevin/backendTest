import { sql } from '../config/db.js';

export const BARRISTER_ENGAGEMENT_VERSION = '2026-03-pa-v1';

export async function hasAcceptedBarristerEngagement(clientDbId, barristerUserId, version = BARRISTER_ENGAGEMENT_VERSION) {
  if (!clientDbId || !barristerUserId) return false;
  const rows = await sql`
    SELECT 1 AS ok
    FROM barrister_engagement_acceptances
    WHERE client_id = ${clientDbId}
      AND barrister_user_id = ${barristerUserId}
      AND engagement_version = ${version}
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function getBarristerAcceptanceRowById(id) {
  const rows = await sql`
    SELECT e.*,
           bu.name AS barrister_name_resolved,
           cu.name AS client_name_resolved
    FROM barrister_engagement_acceptances e
    LEFT JOIN "user" bu ON bu.id = e.barrister_user_id
    LEFT JOIN "user" cu ON cu.id = e.client_id
    WHERE e.id = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}
