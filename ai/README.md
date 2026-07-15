# Grievance AI Service

The AI/NLP component of the Grievance Lodging & Tracking System. Takes a
citizen's complaint text and returns:

- **Department** the complaint should be routed to, with a confidence score
- **Priority** (Low / Medium / High)
- A short **summary** of the complaint

## Folder structure

```
ai/
├── data/
│   ├── complaints.csv          # labeled training data (288 rows)
│   └── generate_dataset.py     # script that generated complaints.csv
├── train.ipynb                 # model training notebook (run this first)
├── train.py                    # same training pipeline as a plain script
├── grievance_model.pkl         # trained model bundle (output of training)
├── predict.py                  # prediction functions + Flask REST API
├── summarizer.py               # lightweight rule-based summarizer
├── requirements.txt
└── README.md
```

## Setup

```bash
cd ai
pip install -r requirements.txt
```

## 1. Train the model

Either run the notebook (`train.ipynb`) cell by cell, or from the command line:

```bash
python3 train.py
```

This reads `data/complaints.csv`, trains two TF-IDF + Logistic Regression
pipelines (department, priority), and saves both into `grievance_model.pkl`.
Re-run this any time the dataset is updated.

Current accuracy on a held-out 20% split: **100%** department classification,
**~95%** priority classification (288 examples across 8 departments).

## 2. Run the API

```bash
python3 predict.py
```

Starts a Flask server on `http://localhost:5001`.

### Endpoints

**`POST /predict/department`**
```json
// request
{ "complaint": "No street lights are working." }
// response
{ "department": "Electricity", "confidence": 0.94 }
```

**`POST /predict/priority`**
```json
// request
{ "complaint": "Transformer exploded and wires are sparking." }
// response
{ "priority": "High" }
```

**`POST /predict/summary`**
```json
// request
{ "complaint": "There has been no garbage collection for two weeks in Sector 8." }
// response
{ "summary": "Garbage collection has been delayed for two weeks in Sector 8." }
```

**`POST /analyze`** — combined endpoint, recommended for the backend to call once
per complaint instead of hitting the three endpoints separately.
```json
// request
{ "complaint": "There has been no water supply in my locality for three days." }
// response
{
  "department": "Water Supply",
  "confidence": 0.9455,
  "priority": "High",
  "summary": "No water supply in my locality for three days."
}
```

**`GET /health`** — health check, returns `{ "status": "ok" }`.

### Command-line usage (no server needed)

```bash
python3 predict.py "There has been no water supply in my locality for three days."
```

## Departments the model predicts

Water Supply · Roads & Infrastructure · Electricity · Waste Management ·
Sanitation · Public Transport · Parks · Others

## Notes for the backend (Person 2 / Node.js)

- Call `POST /analyze` with `{ "complaint": "<title + description>" }` right
  after a complaint is submitted, then store the returned `department`,
  `confidence`, `priority`, and `summary` alongside the complaint record.
- `confidence` is a float between 0 and 1 — if it's low (e.g. below ~0.4),
  consider flagging the complaint for manual department review instead of
  auto-routing it.
- The service is stateless — safe to call from any backend instance.

## Extending later

- Swap the dataset for real complaint logs as they're collected; retrain with
  `python3 train.py` — no code changes needed elsewhere.
- `summarizer.py` is intentionally rule-based (fast, zero dependencies) for
  the hackathon. If time allows, it can be swapped for a transformer
  summarization pipeline behind the same `rule_based_summary()` signature.
- Sentence-Transformer embeddings would likely push priority accuracy higher
  once the dataset grows past a few hundred examples — worth revisiting after
  the hackathon.
