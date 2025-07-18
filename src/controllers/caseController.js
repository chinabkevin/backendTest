import { sql } from "../config/db.js";

export async function registerCase(req, res) {
    const { clientId, title, description, caseSummaryUrl, expertiseArea } = req.body;
    try {
        if (!clientId || !title || !caseSummaryUrl) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Auto-assign available freelancer with matching expertise
        let freelancer = null;
        if (expertiseArea) {
            const candidates = await sql`
                SELECT * FROM freelancer WHERE is_available = true AND ${expertiseArea} = ANY(expertise_areas) ORDER BY performance_score DESC, total_earnings ASC LIMIT 1`;
            if (candidates.length > 0) {
                freelancer = candidates[0];
            }
        }
        let freelancerId = freelancer ? freelancer.user_id : null;
        const newCase = await sql`
            INSERT INTO "case" (client_id, freelancer_id, title, description, case_summary_url, status, assigned_at, created_at, updated_at)
            VALUES (${clientId}, ${freelancerId}, ${title}, ${description}, ${caseSummaryUrl}, 'pending', ${freelancerId ? 'NOW()' : null}, NOW(), NOW())
            RETURNING *`;
        res.status(201).json(newCase[0]);
    } catch (error) {
        console.error('Error registering case:', error);
        res.status(500).json({ error: 'Failed to register case' });
    }
}

export async function getClientCases(req, res) {
    const { clientId } = req.params;
    try {
        const cases = await sql`SELECT * FROM "case" WHERE client_id = ${clientId} ORDER BY created_at DESC`;
        res.json(cases);
    } catch (error) {
        console.error('Error fetching client cases:', error);
        res.status(500).json({ error: 'Failed to fetch client cases' });
    }
}

export async function assignCaseToFreelancer(req, res) {
    const { caseId } = req.params;
    const { freelancerId } = req.body;
    try {
        if (!freelancerId) return res.status(400).json({ error: 'Missing freelancerId' });
        const updated = await sql`
            UPDATE "case" SET freelancer_id = ${freelancerId}, assigned_at = NOW(), updated_at = NOW() WHERE id = ${caseId} RETURNING *`;
        if (!updated.length) return res.status(404).json({ error: 'Case not found' });
        res.json(updated[0]);
    } catch (error) {
        console.error('Error assigning case:', error);
        res.status(500).json({ error: 'Failed to assign case' });
    }
} 