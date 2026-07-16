const axios = require('axios');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';

/**
 * Calls Person 1's Flask AI service to classify a complaint's text.
 * Returns { department, confidence, summary, aiAvailable }.
 *
 * This is informational only in the new flow — the citizen still picks
 * a category from the grid, and priority is still driven by report_count
 * (see computePriority in ticketController.js). The AI's department guess
 * is stored alongside the ticket (ai_department / ai_confidence / ai_summary)
 * so it can power the "System NLP Logs" panel or be cross-checked by staff.
 *
 * If the AI service is unreachable, we don't block ticket creation —
 * we just store nulls and flag aiAvailable: false.
 */
async function analyzeComplaint(text) {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/analyze`,
      { complaint: text },
      { timeout: 8000 }
    );

    const { department, confidence, summary } = response.data;

    if (!department) {
      throw new Error('AI service response missing department');
    }

    return { department, confidence: confidence ?? null, summary: summary ?? null, aiAvailable: true };
  } catch (err) {
    console.error('AI service call failed:', err.message);
    return { department: null, confidence: null, summary: null, aiAvailable: false };
  }
}

module.exports = { analyzeComplaint };
