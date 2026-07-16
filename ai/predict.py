"""
predict.py — Grievance AI Service

Loads the trained model bundle (grievance_model.pkl) and exposes:
  - Python functions:  predict_department(), predict_priority(),
                        predict_summary(), analyze_complaint()
  - A Flask REST API with endpoints matching the architecture doc:

      POST /predict/department   -> {"department": ..., "confidence": ...}
      POST /predict/priority     -> {"priority": ...}
      POST /predict/summary      -> {"summary": ...}
      POST /analyze              -> combined result (department, confidence,
                                     priority, summary) — convenience endpoint
                                     for the Node.js backend to call once.
      GET  /health                -> service health check

Run the API:
    python3 predict.py
    (defaults to http://localhost:5001)

Run a one-off prediction from the command line:
    python3 predict.py "There has been no water supply in my locality for three days."
"""

import sys
import os
import re
import joblib
from flask import Flask, request, jsonify

from summarizer import rule_based_summary

MODEL_PATH = os.path.join(os.path.dirname(__file__), "grievance_model.pkl")

# Below this department-confidence AND with no shared vocabulary with the
# training data, a complaint is treated as not-civic (see is_civic_issue()).
# 8 departments -> chance-level confidence is ~0.125, so 0.35 is a
# deliberately lenient bar meant to catch clearly off-topic text without
# rejecting real complaints that just use unusual phrasing.
CONFIDENCE_THRESHOLD = float(os.environ.get("AI_CONFIDENCE_THRESHOLD", "0.35"))

_bundle = None  # lazy-loaded model bundle


def load_bundle():
    global _bundle
    if _bundle is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                f"'{MODEL_PATH}' not found. Run 'python3 train.py' first to "
                f"train and save the model."
            )
        _bundle = joblib.load(MODEL_PATH)
    return _bundle


def _tokenize(text: str):
    return re.findall(r"[a-z']+", text.lower())


def _civic_vocabulary():
    """
    The set of unigrams + bigrams the department TF-IDF vectorizer was
    actually fitted on (data/complaints.csv). Reusing the fitted
    vectorizer's own vocabulary — rather than hand-writing a keyword list —
    keeps this grounded in exactly what the model learned, and it updates
    automatically if the model is retrained on more data.
    """
    bundle = load_bundle()
    vectorizer = bundle["department_model"].named_steps["tfidf"]
    return set(vectorizer.vocabulary_.keys())


def _shares_civic_vocabulary(text: str) -> bool:
    """
    Requires at least 2 overlapping terms (unigram or bigram) with the
    training vocabulary, not just 1 — a single incidental shared word (e.g.
    a common noun that happens to appear in exactly one training complaint)
    was letting some off-topic text slip through as a false negative.
    Real civic complaints share several domain terms, so this bar doesn't
    cost us any legitimate reports in testing.
    """
    vocab = _civic_vocabulary()
    tokens = _tokenize(text)
    hits = sum(1 for t in tokens if t in vocab)
    bigrams = (f"{a} {b}" for a, b in zip(tokens, tokens[1:]))
    hits += sum(1 for b in bigrams if b in vocab)
    return hits >= 2


def is_civic_issue(text: str, confidence: float) -> bool:
    """
    Relevance filter for off-topic / spam submissions.

    This model is a closed-set classifier over 8 civic departments — it has
    no "not civic" class, so on its own it will confidently force ANY text
    (e.g. "my ex doesn't love me anymore") into one of those 8 buckets.
    We approximate a "not civic" signal with two checks instead:
      1. The department prediction's own confidence is low (the model
         itself is unsure, which off-topic text tends to trigger).
      2. The text shares no vocabulary at all with the training data.

    Only text that fails BOTH is flagged non-civic — deliberately
    permissive, so unusually-phrased real complaints still get through.
    This is a heuristic, not a guarantee; it's meant to catch clearly
    off-topic submissions, not serve as an airtight content filter.
    """
    if confidence >= CONFIDENCE_THRESHOLD:
        return True
    return _shares_civic_vocabulary(text)


def predict_department(complaint_text: str) -> dict:
    """Returns {'department': str, 'confidence': float}"""
    bundle = load_bundle()
    model = bundle["department_model"]

    department = model.predict([complaint_text])[0]
    proba = model.predict_proba([complaint_text])[0]
    confidence = round(float(max(proba)), 4)

    return {"department": department, "confidence": confidence}


def predict_priority(complaint_text: str) -> dict:
    """Returns {'priority': str}"""
    bundle = load_bundle()
    model = bundle["priority_model"]
    priority = model.predict([complaint_text])[0]
    return {"priority": priority}


def predict_summary(complaint_text: str) -> dict:
    """Returns {'summary': str}"""
    return {"summary": rule_based_summary(complaint_text)}


def analyze_complaint(complaint_text: str) -> dict:
    """
    Combined convenience call: department + confidence + priority + summary.

    Runs the relevance filter first. If the complaint doesn't look civic,
    we skip forcing a department/priority guess on it and return
    is_civic_issue: False instead — the Node backend uses that to reject
    the submission outright rather than filing junk as a real ticket.
    """
    dept_result = predict_department(complaint_text)

    if not is_civic_issue(complaint_text, dept_result["confidence"]):
        return {
            "department": None,
            "confidence": dept_result["confidence"],
            "priority": None,
            "summary": rule_based_summary(complaint_text),
            "is_civic_issue": False,
        }

    priority_result = predict_priority(complaint_text)
    summary_result = predict_summary(complaint_text)

    return {
        **dept_result,
        **priority_result,
        **summary_result,
        "is_civic_issue": True,
    }


# ---------------------------------------------------------------------------
# Flask API
# ---------------------------------------------------------------------------

app = Flask(__name__)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


def _get_complaint_text():
    data = request.get_json(silent=True) or {}
    text = data.get("complaint", "").strip()
    if not text:
        return None
    return text


@app.route("/predict/department", methods=["POST"])
def api_predict_department():
    text = _get_complaint_text()
    if not text:
        return jsonify({"error": "Missing 'complaint' field in request body."}), 400
    return jsonify(predict_department(text))


@app.route("/predict/priority", methods=["POST"])
def api_predict_priority():
    text = _get_complaint_text()
    if not text:
        return jsonify({"error": "Missing 'complaint' field in request body."}), 400
    return jsonify(predict_priority(text))


@app.route("/predict/summary", methods=["POST"])
def api_predict_summary():
    text = _get_complaint_text()
    if not text:
        return jsonify({"error": "Missing 'complaint' field in request body."}), 400
    return jsonify(predict_summary(text))


@app.route("/analyze", methods=["POST"])
def api_analyze():
    text = _get_complaint_text()
    if not text:
        return jsonify({"error": "Missing 'complaint' field in request body."}), 400
    return jsonify(analyze_complaint(text))


if __name__ == "__main__":
    if len(sys.argv) > 1:
        # CLI mode: python3 predict.py "some complaint text"
        complaint = " ".join(sys.argv[1:])
        import json
        print(json.dumps(analyze_complaint(complaint), indent=2))
    else:
        # API mode
        port = int(os.environ.get("PORT", 5001))
        print(f"Starting Grievance AI Service on http://localhost:{port}")
        print("Loading model bundle...")
        load_bundle()  # warm it up now, not on the first incoming request —
                        # otherwise that first request pays the joblib.load()
                        # cost and can blow past the Node backend's timeout
        print("Model loaded. Ready for requests.")
        app.run(host="0.0.0.0", port=port, debug=True, use_reloader=False)