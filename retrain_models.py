"""
ShipmentSure — Full model retraining + preprocessor build script.
Retrains all models with current sklearn version and saves all .pkl files.
"""
import pandas as pd
import numpy as np
import pickle
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, roc_auc_score
from xgboost import XGBClassifier

print("=" * 60)
print("ShipmentSure — Model Retraining & Preprocessor Build")
print("=" * 60)

# === 1. Load Data ===
df = pd.read_csv('data/Train.csv')
print(f"\n[1] Loaded: {df.shape[0]} rows, {df.shape[1]} columns")
print("    Columns:", list(df.columns))

# === 2. Define Features ===
TARGET = 'Reached.on.Time_Y.N'
CATEGORICAL_COLS = ['Warehouse_block', 'Mode_of_Shipment', 'Product_importance', 'Gender']
NUMERICAL_COLS   = ['Customer_care_calls', 'Customer_rating', 'Cost_of_the_Product',
                    'Prior_purchases', 'Discount_offered', 'Weight_in_gms']

X = df[CATEGORICAL_COLS + NUMERICAL_COLS]
y = df[TARGET]

print(f"\n[2] Features: {list(X.columns)}")
print(f"    Target distribution:\n{y.value_counts().to_string()}")

# === 3. Train / Test Split ===
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
print(f"\n[3] Split: {len(X_train)} train / {len(X_test)} test")

# === 4. Build Preprocessor ===
preprocessor = ColumnTransformer(transformers=[
    ('cat', OneHotEncoder(handle_unknown='ignore'), CATEGORICAL_COLS),
    ('num', StandardScaler(), NUMERICAL_COLS)
])

X_train_proc = preprocessor.fit_transform(X_train)
X_test_proc  = preprocessor.transform(X_test)
print(f"\n[4] Preprocessor fit. Output shape: {X_train_proc.shape}")

# Save preprocessor
with open('models/preprocessor.pkl', 'wb') as f:
    pickle.dump(preprocessor, f)
print("    ✅ Saved: models/preprocessor.pkl")

# === 5. Train Models ===
models = {
    'logistic_regression': LogisticRegression(max_iter=1000, random_state=42),
    'random_forest':       RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1),
    'xgboost':             XGBClassifier(n_estimators=100, random_state=42, use_label_encoder=False,
                                         eval_metric='logloss', verbosity=0)
}

results = {}
best_model_name = None
best_auc = 0

print("\n[5] Training models...")
for name, model in models.items():
    model.fit(X_train_proc, y_train)
    y_pred = model.predict(X_test_proc)
    y_prob = model.predict_proba(X_test_proc)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_prob)
    results[name] = {'accuracy': acc, 'auc': auc}

    print(f"\n    [{name}]")
    print(f"      Accuracy : {acc:.4f}")
    print(f"      ROC-AUC  : {auc:.4f}")

    # Save individual model
    with open(f'models/{name}.pkl', 'wb') as f:
        pickle.dump(model, f)
    print(f"      ✅ Saved: models/{name}.pkl")

    if auc > best_auc:
        best_auc = auc
        best_model_name = name

# === 6. Save Best Model ===
best_model = models[best_model_name]
with open('models/best_model.pkl', 'wb') as f:
    pickle.dump(best_model, f)
print(f"\n[6] ✅ Best model: {best_model_name} (AUC={best_auc:.4f})")
print("    ✅ Saved: models/best_model.pkl")

# === 7. Final End-to-End Test ===
print("\n[7] End-to-end test...")
sample = pd.DataFrame([{
    'Warehouse_block': 'D',
    'Mode_of_Shipment': 'Ship',
    'Product_importance': 'High',
    'Gender': 'M',
    'Customer_care_calls': 4,
    'Customer_rating': 3,
    'Cost_of_the_Product': 177.0,
    'Prior_purchases': 3,
    'Discount_offered': 44.0,
    'Weight_in_gms': 4500.0
}])
sample_proc = preprocessor.transform(sample)
pred = best_model.predict(sample_proc)[0]
prob = best_model.predict_proba(sample_proc)[0]
status = "On Time" if pred == 1 else "Delayed"
print(f"    Sample prediction → {status} (confidence: {max(prob):.3f})")

print("\n" + "=" * 60)
print("✅ All models retrained and saved successfully!")
print("=" * 60)
