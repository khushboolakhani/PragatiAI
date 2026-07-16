const axios = require('axios');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';

/**
 * Calls Person 1's Flask AI service to classify a complaint's text.
 * Returns { department, confidence, summary, priority, aiAvailable }.
 *
 * The AI now determines routing: the citizen no longer picks a category,
 * so `department` becomes the ticket's `category`, and `priority` becomes
 * the baseline priority estimate that createOrIncrementTicket escalates
 * based on report_count (see computePriority in ticketController.js).
 * ai_department / ai_confidence / ai_summary are also stored on the ticket
 * so staff can see the AI's own reasoning (e.g. in the NLP log / admin view).
 *
 * If the AI service is unreachable, we don't block ticket creation —
 * we fall back to an "Unclassified" department and a "Low" priority, and
 * flag aiAvailable: false so the frontend/staff know it wasn't AI-routed.
 */
async function analyzeComplaint(text) {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/analyze`,
      { complaint: text },
      { timeout: 15000 }
    );

    const { department, confidence, summary, priority } = response.data;

    if (!department) {
      throw new Error('AI service response missing department');
    }

    return {
      department,
      confidence: confidence ?? null,
      summary: summary ?? null,
      priority: priority ?? 'Low',
      aiAvailable: true,
    };
  } catch (err) {
    console.error('AI service call failed:', err.message);
    return { department: 'Unclassified', confidence: null, summary: null, priority: 'Low', aiAvailable: false };
  }
}

module.exports = { analyzeComplaint };