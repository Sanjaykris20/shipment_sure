"""
Build and save the preprocessing pipeline for ShipmentSure.
This creates models/preprocessor.pkl which the FastAPI backend needs.
"""
import pandas as pd
import numpy as np
import pickle
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.model_selection import train_test_split

# === Load raw training data ===
df = pd.read_csv('data/Train.csv')
print(f"Loaded {len(df)} rows, {df.shape[1]} columns")
print("Columns:", list(df.columns))

# === Define feature columns ===
TARGET = 'Reached.on.Time_Y.N'
DROP_COLS = ['ID', TARGET]

CATEGORICAL_COLS = ['Warehouse_block', 'Mode_of_Shipment', 'Product_importance', 'Gender']
NUMERICAL_COLS   = ['Customer_care_calls', 'Customer_rating', 'Cost_of_the_Product',
                    'Prior_purchases', 'Discount_offered', 'Weight_in_gms']

X = df.drop(columns=DROP_COLS)
y = df[TARGET]

# Keep only the columns the preprocessor will actually handle
X = X[CATEGORICAL_COLS + NUMERICAL_COLS]

print("Feature set:", list(X.columns))
print("Class distribution:\n", y.value_counts())

# === Build the ColumnTransformer ===
categorical_transformer = Pipeline(steps=[
    ('onehot', OneHotEncoder(handle_unknown='ignore'))
])

numerical_transformer = Pipeline(steps=[
    ('scaler', StandardScaler())
])

preprocessor = ColumnTransformer(transformers=[
    ('cat', categorical_transformer, CATEGORICAL_COLS),
    ('num', numerical_transformer,   NUMERICAL_COLS)
])

# === Fit on training data ===
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

preprocessor.fit(X_train)
print("Preprocessor fitted successfully")

# === Quick test ===
sample = X_test.iloc[:1]
transformed = preprocessor.transform(sample)
print(f"Sample transform output shape: {transformed.shape}")

# === Save ===
with open('models/preprocessor.pkl', 'wb') as f:
    pickle.dump(preprocessor, f)

print("✅ Saved: models/preprocessor.pkl")

# === Verify with best model ===
with open('models/best_model.pkl', 'rb') as f:
    model = pickle.load(f)

X_test_transformed = preprocessor.transform(X_test)
pred = model.predict(X_test_transformed)
prob = model.predict_proba(X_test_transformed)
print(f"✅ End-to-end test passed: prediction={pred[0]}, confidence={max(prob[0]):.3f}")
print("Done!")
