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

    const { department, confidence, summary, priority, is_civic_issue } = response.data;

    if (is_civic_issue === false) {
      // The AI ran fine but judged this isn't a civic/municipal complaint
      // (e.g. relationship drama, random venting). Don't force a department
      // guess onto it — let the controller reject the submission outright.
      return {
        department: null,
        confidence: confidence ?? null,
        summary: summary ?? null,
        priority: null,
        isCivicIssue: false,
        aiAvailable: true,
      };
    }

    if (!department) {
      throw new Error('AI service response missing department');
    }

    return {
      department,
      confidence: confidence ?? null,
      summary: summary ?? null,
      priority: priority ?? 'Low',
      isCivicIssue: true,
      aiAvailable: true,
    };
  } catch (err) {
    console.error('AI service call failed:', err.message);
    // Fail OPEN, not closed: if the AI service itself is unreachable, we
    // can't judge relevance at all, so we still file the ticket rather than
    // blocking citizens because of an infra hiccup on our end.
    return { department: 'Unclassified', confidence: null, summary: null, priority: 'Low', isCivicIssue: true, aiAvailable: false };
  }
}

module.exports = { analyzeComplaint };