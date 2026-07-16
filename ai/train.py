"""
train.py — Train the Grievance Classification Models

Trains two models on the complaint dataset (data/complaints.csv):
  1. Department classifier  (TF-IDF + Logistic Regression)
  2. Priority classifier    (TF-IDF + Logistic Regression)

Both models + their shared/independent TF-IDF vectorizers are bundled and
saved into a single pickle file: grievance_model.pkl

Also generates a short text-based summarizer helper (rule-based, no model
needed — see summarizer.py) used by predict.py for the "AI Summary" feature.

Run:
    python3 train.py
"""

import json
import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from sklearn.pipeline import Pipeline

DATA_PATH = "data/complaints.csv"
MODEL_PATH = "grievance_model.pkl"
RANDOM_STATE = 42


def load_data():
    df = pd.read_csv(DATA_PATH)
    df = df.dropna(subset=["text", "department", "priority"])
    return df


def train_department_model(df):
    X_train, X_test, y_train, y_test = train_test_split(
        df["text"], df["department"],
        test_size=0.2, random_state=RANDOM_STATE, stratify=df["department"]
    )

    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            lowercase=True,
            stop_words="english",
            ngram_range=(1, 2),
            min_df=1,
            max_df=0.95,
        )),
        ("clf", LogisticRegression(
            max_iter=1000,
            C=5.0,
            class_weight="balanced",
        )),
    ])

    pipeline.fit(X_train, y_train)
    preds = pipeline.predict(X_test)

    print("\n=== Department Classifier ===")
    print(f"Accuracy: {accuracy_score(y_test, preds):.3f}")
    print(classification_report(y_test, preds, zero_division=0))

    # Refit on full dataset for the final deployed model
    pipeline.fit(df["text"], df["department"])
    return pipeline


def train_priority_model(df):
    X_train, X_test, y_train, y_test = train_test_split(
        df["text"], df["priority"],
        test_size=0.2, random_state=RANDOM_STATE, stratify=df["priority"]
    )

    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            lowercase=True,
            stop_words="english",
            ngram_range=(1, 2),
            min_df=1,
            max_df=0.95,
        )),
        ("clf", LogisticRegression(
            max_iter=1000,
            C=5.0,
            class_weight="balanced",
        )),
    ])

    pipeline.fit(X_train, y_train)
    preds = pipeline.predict(X_test)

    print("\n=== Priority Classifier ===")
    print(f"Accuracy: {accuracy_score(y_test, preds):.3f}")
    print(classification_report(y_test, preds, zero_division=0))

    # Refit on full dataset for the final deployed model
    pipeline.fit(df["text"], df["priority"])
    return pipeline


def main():
    df = load_data()
    print(f"Loaded {len(df)} labeled complaints.")
    print(f"Departments: {sorted(df['department'].unique())}")
    print(f"Priorities:  {sorted(df['priority'].unique())}")

    department_model = train_department_model(df)
    priority_model = train_priority_model(df)

    bundle = {
        "department_model": department_model,
        "priority_model": priority_model,
        "department_labels": sorted(df["department"].unique().tolist()),
        "priority_labels": sorted(df["priority"].unique().tolist()),
    }

    joblib.dump(bundle, MODEL_PATH)
    print(f"\nSaved trained models to {MODEL_PATH}")


if __name__ == "__main__":
    main()
