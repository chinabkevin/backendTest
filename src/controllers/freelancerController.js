import { sql } from "../config/db.js";

export async function registerFreelancer(req, res){
    const { name, email, phone, experience, expertiseAreas, idCardUrl, barCertificateUrl, additionalDocuments, userId } = req.body;
    try {
      if (!name || !email || !phone || !experience || !expertiseAreas || !userId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const freelancer = await sql`INSERT INTO freelancer (name, email, phone, experience, expertise_areas, id_card_url, bar_certificate_url, additional_documents, user_id) VALUES (${name}, ${email}, ${phone}, ${experience}, ${expertiseAreas}, ${idCardUrl}, ${barCertificateUrl}, ${additionalDocuments}, ${userId})`;
      if (!freelancer) {
        return res.status(400).json({ error: 'Failed to register freelancer' });
      }
      // Set user role to freelancer
      await sql`UPDATE "user" SET role = 'freelancer' WHERE id = ${userId}`;
      console.log('Freelancer registered successfully');
      res.status(201).json(freelancer);
    } catch (error) {
      console.error('Error registering freelancer:', error);
      res.status(500).json({ error: 'Failed to register freelancer' });
    }
}

export async function getFreelancers(req, res){
    const freelancers = await sql`SELECT * FROM freelancer`;
    console.log('freelancers', freelancers);
    res.json(freelancers);
}

export async function getFreelancerById(req, res){
    try { 
        const { userId } = req.params;
        console.log('userId', userId);
        const freelancer = await sql`SELECT * FROM freelancer WHERE user_id = ${userId} ORDER BY created_at DESC`;
        if (!freelancer) {
          return res.status(404).json({ error: 'Freelancer not found' });
        }
        res.json(freelancer);
      } catch (error) { 
        console.error('Error getting freelancer:', error);
        res.status(500).json({ error: 'Failed to get freelancer' });
      }
}

export async function deleteFreelancer(req, res){
    try {
        const { userId } = req.params;
        if(isNaN(parseInt(userId))){
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        const freelancer = await sql`DELETE FROM freelancer WHERE user_id = ${userId} RETURNING *`;
        console.log('freelancer', freelancer);
        if (freelancer.length === 0) {
          return res.status(404).json({ error: 'Freelancer not found' });
        }
        console.log('Freelancer deleted successfully');
        res.json({ message: 'Freelancer deleted successfully' });
      } catch (error) {
        console.error('Error deleting freelancer:', error);
        res.status(500).json({ error: 'Failed to delete freelancer' });
      }
}

export async function updateFreelancerProfile(req, res) {
    const { userId } = req.params;
    const { name, phone, experience, expertiseAreas } = req.body;
    try {
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        const updated = await sql`
            UPDATE freelancer SET
                name = COALESCE(${name}, name),
                phone = COALESCE(${phone}, phone),
                experience = COALESCE(${experience}, experience),
                expertise_areas = COALESCE(${expertiseAreas}, expertise_areas),
                updated_at = NOW()
            WHERE user_id = ${userId}
            RETURNING *`;
        if (!updated.length) return res.status(404).json({ error: 'Freelancer not found' });
        res.json(updated[0]);
    } catch (error) {
        console.error('Error updating freelancer:', error);
        res.status(500).json({ error: 'Failed to update freelancer' });
    }
}

export async function setFreelancerAvailability(req, res) {
    const { userId } = req.params;
    const { isAvailable } = req.body;
    try {
        if (typeof isAvailable !== 'boolean') return res.status(400).json({ error: 'isAvailable must be boolean' });
        const updated = await sql`
            UPDATE freelancer SET is_available = ${isAvailable}, updated_at = NOW() WHERE user_id = ${userId} RETURNING *`;
        if (!updated.length) return res.status(404).json({ error: 'Freelancer not found' });
        res.json(updated[0]);
    } catch (error) {
        console.error('Error setting availability:', error);
        res.status(500).json({ error: 'Failed to set availability' });
    }
}

export async function getFreelancerEarnings(req, res) {
    const { userId } = req.params;
    try {
        const result = await sql`SELECT total_earnings FROM freelancer WHERE user_id = ${userId}`;
        if (!result.length) return res.status(404).json({ error: 'Freelancer not found' });
        res.json({ totalEarnings: result[0].total_earnings });
    } catch (error) {
        console.error('Error fetching earnings:', error);
        res.status(500).json({ error: 'Failed to fetch earnings' });
    }
}

export async function getFreelancerRatings(req, res) {
    const { userId } = req.params;
    try {
        // Placeholder: Replace with actual ratings table if exists
        const result = await sql`SELECT performance_score FROM freelancer WHERE user_id = ${userId}`;
        if (!result.length) return res.status(404).json({ error: 'Freelancer not found' });
        res.json({ performanceScore: result[0].performance_score });
    } catch (error) {
        console.error('Error fetching ratings:', error);
        res.status(500).json({ error: 'Failed to fetch ratings' });
    }
}

export async function updateFreelancerCredentials(req, res) {
    const { userId } = req.params;
    const { idCardUrl, barCertificateUrl, additionalDocuments } = req.body;
    try {
        const updated = await sql`
            UPDATE freelancer SET
                id_card_url = COALESCE(${idCardUrl}, id_card_url),
                bar_certificate_url = COALESCE(${barCertificateUrl}, bar_certificate_url),
                additional_documents = COALESCE(${additionalDocuments}, additional_documents),
                updated_at = NOW()
            WHERE user_id = ${userId}
            RETURNING *`;
        if (!updated.length) return res.status(404).json({ error: 'Freelancer not found' });
        res.json(updated[0]);
    } catch (error) {
        console.error('Error updating credentials:', error);
        res.status(500).json({ error: 'Failed to update credentials' });
    }
}

// --- CASE MANAGEMENT ---
export async function listFreelancerCases(req, res) {
    const { userId } = req.params;
    try {
        const cases = await sql`SELECT * FROM "case" WHERE freelancer_id = ${userId} ORDER BY created_at DESC`;
        res.json(cases);
    } catch (error) {
        console.error('Error listing cases:', error);
        res.status(500).json({ error: 'Failed to list cases' });
    }
}

export async function acceptCase(req, res) {
    const { caseId } = req.params;
    try {
        const updated = await sql`UPDATE "case" SET status = 'accepted', accepted_at = NOW() WHERE id = ${caseId} RETURNING *`;
        if (!updated.length) return res.status(404).json({ error: 'Case not found' });
        res.json(updated[0]);
    } catch (error) {
        console.error('Error accepting case:', error);
        res.status(500).json({ error: 'Failed to accept case' });
    }
}

export async function declineCase(req, res) {
    const { caseId } = req.params;
    try {
        const updated = await sql`UPDATE "case" SET status = 'declined', declined_at = NOW() WHERE id = ${caseId} RETURNING *`;
        if (!updated.length) return res.status(404).json({ error: 'Case not found' });
        res.json(updated[0]);
    } catch (error) {
        console.error('Error declining case:', error);
        res.status(500).json({ error: 'Failed to decline case' });
    }
}

export async function completeCase(req, res) {
    const { caseId } = req.params;
    try {
        const updated = await sql`UPDATE "case" SET status = 'completed', completed_at = NOW() WHERE id = ${caseId} RETURNING *`;
        if (!updated.length) return res.status(404).json({ error: 'Case not found' });
        res.json(updated[0]);
    } catch (error) {
        console.error('Error completing case:', error);
        res.status(500).json({ error: 'Failed to complete case' });
    }
}

// --- DOCUMENT ANNOTATION ---
export async function annotateCaseDocument(req, res) {
    const { caseId } = req.params;
    const { annotatedDocumentUrl, notes } = req.body;
    try {
        const updated = await sql`UPDATE "case" SET annotated_document_url = ${annotatedDocumentUrl}, annotation_notes = ${notes}, updated_at = NOW() WHERE id = ${caseId} RETURNING *`;
        if (!updated.length) return res.status(404).json({ error: 'Case not found' });
        res.json(updated[0]);
    } catch (error) {
        console.error('Error annotating document:', error);
        res.status(500).json({ error: 'Failed to annotate document' });
    }
}

// --- PAYMENTS ---
export async function requestWithdrawal(req, res) {
    const { userId } = req.params;
    const { amount, method } = req.body;
    try {
        // Placeholder: Insert withdrawal request
        const withdrawal = await sql`INSERT INTO withdrawal (freelancer_id, amount, method, status, requested_at) VALUES (${userId}, ${amount}, ${method}, 'pending', NOW()) RETURNING *`;
        res.status(201).json(withdrawal[0]);
    } catch (error) {
        console.error('Error requesting withdrawal:', error);
        res.status(500).json({ error: 'Failed to request withdrawal' });
    }
}