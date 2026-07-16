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
import joblib
from flask import Flask, request, jsonify

from summarizer import rule_based_summary

MODEL_PATH = os.path.join(os.path.dirname(__file__), "grievance_model.pkl")

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
    """Combined convenience call: department + confidence + priority + summary."""
    dept_result = predict_department(complaint_text)
    priority_result = predict_priority(complaint_text)
    summary_result = predict_summary(complaint_text)

    return {
        **dept_result,
        **priority_result,
        **summary_result,
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