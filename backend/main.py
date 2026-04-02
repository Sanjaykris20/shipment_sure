from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr
import pandas as pd
import numpy as np
import pickle
import os
import sqlite3
import hashlib
import uuid
from datetime import datetime

app = FastAPI(
    title="ShipmentSure API",
    description="Predicts On-Time Delivery Using Supplier Data — with User Auth",
    version="2.0.0"
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Paths ──────────────────────────────────────────────────────────────
BASE_DIR          = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH        = os.path.join(BASE_DIR, "models", "best_model.pkl")
PREPROCESSOR_PATH = os.path.join(BASE_DIR, "models", "preprocessor.pkl")
DB_PATH           = os.path.join(BASE_DIR, "backend", "users.db")

# ── Globals ─────────────────────────────────────────────────────────────
model        = None
preprocessor = None


# ══════════════════════════════════════════════════════════════════════
#  DATABASE HELPERS
# ══════════════════════════════════════════════════════════════════════

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            name         TEXT    NOT NULL,
            email        TEXT    UNIQUE NOT NULL,
            password_hash TEXT   NOT NULL,
            created_at   TEXT    NOT NULL
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            token      TEXT PRIMARY KEY,
            user_id    INTEGER NOT NULL,
            email      TEXT    NOT NULL,
            name       TEXT    NOT NULL,
            created_at TEXT    NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS prediction_history (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL,
            inputs      TEXT    NOT NULL,
            status      TEXT    NOT NULL,
            confidence  REAL    NOT NULL,
            created_at  TEXT    NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    conn.commit()
    conn.close()
    print("[OK] Database initialised.")

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def get_user_from_token(token: str):
    conn = get_db()
    row  = conn.execute(
        "SELECT * FROM sessions WHERE token = ?", (token,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


# ══════════════════════════════════════════════════════════════════════
#  STARTUP
# ══════════════════════════════════════════════════════════════════════

@app.on_event("startup")
async def startup():
    global model, preprocessor
    init_db()
    try:
        with open(MODEL_PATH, "rb") as f:
            model = pickle.load(f)
        with open(PREPROCESSOR_PATH, "rb") as f:
            preprocessor = pickle.load(f)
        print("[OK] ML model and preprocessor loaded.")
    except Exception as e:
        print(f"[ERROR] Loading artifacts: {e}")


# ══════════════════════════════════════════════════════════════════════
#  AUTH SCHEMAS
# ══════════════════════════════════════════════════════════════════════

class RegisterInput(BaseModel):
    name:     str
    email:    str
    password: str

class LoginInput(BaseModel):
    email:    str
    password: str


# ══════════════════════════════════════════════════════════════════════
#  AUTH ROUTES
# ══════════════════════════════════════════════════════════════════════

@app.post("/auth/register", tags=["Auth"])
def register(data: RegisterInput):
    if len(data.name.strip()) < 2:
        raise HTTPException(400, "Name must be at least 2 characters.")
    if "@" not in data.email:
        raise HTTPException(400, "Invalid email address.")
    if len(data.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")

    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM users WHERE email = ?", (data.email.lower(),)
    ).fetchone()

    if existing:
        conn.close()
        raise HTTPException(409, "Email already registered. Please log in.")

    conn.execute(
        "INSERT INTO users (name, email, password_hash, created_at) VALUES (?,?,?,?)",
        (data.name.strip(), data.email.lower(),
         hash_password(data.password), datetime.utcnow().isoformat())
    )
    conn.commit()
    conn.close()
    return {"message": "Account created successfully. Please log in."}


@app.post("/auth/login", tags=["Auth"])
def login(data: LoginInput):
    conn  = get_db()
    user  = conn.execute(
        "SELECT * FROM users WHERE email = ? AND password_hash = ?",
        (data.email.lower(), hash_password(data.password))
    ).fetchone()

    if not user:
        conn.close()
        raise HTTPException(401, "Invalid email or password.")

    token = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO sessions (token, user_id, email, name, created_at) VALUES (?,?,?,?,?)",
        (token, user["id"], user["email"], user["name"],
         datetime.utcnow().isoformat())
    )
    conn.commit()
    conn.close()

    return {
        "token": token,
        "user":  {"name": user["name"], "email": user["email"]}
    }


@app.get("/auth/me", tags=["Auth"])
def me(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    session = get_user_from_token(token)
    if not session:
        raise HTTPException(401, "Invalid or expired token.")
    return {"name": session["name"], "email": session["email"]}


@app.post("/auth/logout", tags=["Auth"])
def logout(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    conn  = get_db()
    conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()
    return {"message": "Logged out."}


# ══════════════════════════════════════════════════════════════════════
#  STATUS
# ══════════════════════════════════════════════════════════════════════

@app.get("/api")
def root():
    return {"message": "Welcome to ShipmentSure API v2", "docs": "/docs"}

@app.get("/status")
def status():
    if model and preprocessor:
        return {"status": "ready", "model": "loaded", "preprocessor": "loaded"}
    return {"status": "error", "message": "Artifacts not loaded."}


# ══════════════════════════════════════════════════════════════════════
#  PREDICTION  (protected — requires token)
# ══════════════════════════════════════════════════════════════════════

class ShipmentInput(BaseModel):
    Warehouse_block:      str
    Mode_of_Shipment:     str
    Customer_care_calls:  int
    Customer_rating:      int
    Cost_of_the_Product:  float
    Prior_purchases:      int
    Product_importance:   str
    Gender:               str
    Discount_offered:     float
    Weight_in_gms:        float


@app.post("/predict", tags=["Prediction"])
def predict(shipment: ShipmentInput, authorization: str = Header(...)):
    # Verify token
    token   = authorization.replace("Bearer ", "")
    session = get_user_from_token(token)
    if not session:
        raise HTTPException(401, "Authentication required. Please log in.")

    if model is None or preprocessor is None:
        raise HTTPException(503, "ML model not loaded.")

    try:
        input_df = pd.DataFrame([{
            "Warehouse_block":     shipment.Warehouse_block,
            "Mode_of_Shipment":    shipment.Mode_of_Shipment,
            "Product_importance":  shipment.Product_importance,
            "Gender":              shipment.Gender,
            "Customer_care_calls": shipment.Customer_care_calls,
            "Customer_rating":     shipment.Customer_rating,
            "Cost_of_the_Product": shipment.Cost_of_the_Product,
            "Prior_purchases":     shipment.Prior_purchases,
            "Discount_offered":    shipment.Discount_offered,
            "Weight_in_gms":       shipment.Weight_in_gms,
        }])

        processed   = preprocessor.transform(input_df)
        prediction  = int(model.predict(processed)[0])
        probability = model.predict_proba(processed)[0].tolist()
        confidence  = float(max(probability))
        label       = "On Time" if prediction == 1 else "Delayed"

        # Save to history
        import json
        conn = get_db()
        conn.execute(
            "INSERT INTO prediction_history (user_id, inputs, status, confidence, created_at) VALUES (?,?,?,?,?)",
            (session["user_id"], json.dumps(shipment.dict()), label,
             round(confidence, 4), datetime.utcnow().isoformat())
        )
        conn.commit()
        conn.close()

        return {
            "prediction":  prediction,
            "status":      label,
            "confidence":  round(confidence, 4),
            "probability": [round(p, 4) for p in probability],
        }
    except Exception as e:
        raise HTTPException(400, f"Prediction error: {str(e)}")


@app.get("/history", tags=["Prediction"])
def history(authorization: str = Header(...)):
    token   = authorization.replace("Bearer ", "")
    session = get_user_from_token(token)
    if not session:
        raise HTTPException(401, "Authentication required.")

    import json
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM prediction_history WHERE user_id=? ORDER BY id DESC LIMIT 10",
        (session["user_id"],)
    ).fetchall()
    conn.close()

    return [
        {
            "id":         r["id"],
            "status":     r["status"],
            "confidence": r["confidence"],
            "created_at": r["created_at"],
            "inputs":     json.loads(r["inputs"])
        }
        for r in rows
    ]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

# ── Serve React frontend (MUST be last, after all API routes) ─────────
FRONT_DIST = os.path.join(BASE_DIR, "front", "dist")
if os.path.isdir(FRONT_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONT_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        """Serve React app for all non-API routes (SPA fallback)."""
        file_path = os.path.join(FRONT_DIST, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONT_DIST, "index.html"))
