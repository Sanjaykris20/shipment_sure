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
import json
from datetime import datetime
from dotenv import load_dotenv

# Load .env file for local development
load_dotenv()

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

# ── Paths & Config ───────────────────────────────────────────────────
BASE_DIR          = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH        = os.path.join(BASE_DIR, "models", "best_model.pkl")
PREPROCESSOR_PATH = os.path.join(BASE_DIR, "models", "preprocessor.pkl")
DB_PATH           = os.path.join(BASE_DIR, "users.db")

# Use DATABASE_URL for Vercel/Production, fallback to local sqlite
DATABASE_URL = os.getenv("DATABASE_URL")
IS_POSTGRES  = DATABASE_URL and DATABASE_URL.startswith("postgres")

# ── Globals ─────────────────────────────────────────────────────────────
model        = None
preprocessor = None


# ══════════════════════════════════════════════════════════════════════
#  DATABASE HELPERS
# ══════════════════════════════════════════════════════════════════════

def get_db():
    if IS_POSTGRES:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
        return conn
    else:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    
    # SQLite vs Postgres syntax handled via base SQL
    users_sql = """
        CREATE TABLE IF NOT EXISTS users (
            id           SERIAL PRIMARY KEY,
            name         TEXT    NOT NULL,
            email        TEXT    UNIQUE NOT NULL,
            password_hash TEXT   NOT NULL,
            created_at   TEXT    NOT NULL
        )
    """
    sessions_sql = """
        CREATE TABLE IF NOT EXISTS sessions (
            token      TEXT PRIMARY KEY,
            user_id    INTEGER NOT NULL,
            email      TEXT    NOT NULL,
            name       TEXT    NOT NULL,
            created_at TEXT    NOT NULL
        )
    """
    history_sql = """
        CREATE TABLE IF NOT EXISTS prediction_history (
            id          SERIAL PRIMARY KEY,
            user_id     INTEGER NOT NULL,
            inputs      TEXT    NOT NULL,
            status      TEXT    NOT NULL,
            confidence  REAL    NOT NULL,
            created_at  TEXT    NOT NULL
        )
    """
    
    # Simple fix for SQLite which doesn't know SERIAL
    if not IS_POSTGRES:
        users_sql = users_sql.replace("SERIAL", "INTEGER")
        history_sql = history_sql.replace("SERIAL", "INTEGER")

    c.execute(users_sql)
    c.execute(sessions_sql)
    c.execute(history_sql)
    conn.commit()
    conn.close()
    print(f"[OK] Database initialised ({'Postgres' if IS_POSTGRES else 'SQLite'}).")

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def get_user_from_token(token: str):
    conn = get_db()
    c = conn.cursor()
    
    query = "SELECT * FROM sessions WHERE token = %s" if IS_POSTGRES else "SELECT * FROM sessions WHERE token = ?"
    c.execute(query, (token,))
    row = c.fetchone()
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

@app.post("/api/auth/register", tags=["Auth"])
def register(data: RegisterInput):
    if len(data.name.strip()) < 2:
        raise HTTPException(400, "Name must be at least 2 characters.")
    if "@" not in data.email:
        raise HTTPException(400, "Invalid email address.")
    if len(data.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")

    conn = get_db()
    c = conn.cursor()
    
    query = "SELECT id FROM users WHERE email = %s" if IS_POSTGRES else "SELECT id FROM users WHERE email = ?"
    c.execute(query, (data.email.lower(),))
    existing = c.fetchone()

    if existing:
        conn.close()
        raise HTTPException(409, "Email already registered. Please log in.")

    insert_query = """
        INSERT INTO users (name, email, password_hash, created_at) 
        VALUES (%s, %s, %s, %s)
    """ if IS_POSTGRES else """
        INSERT INTO users (name, email, password_hash, created_at) 
        VALUES (?, ?, ?, ?)
    """
    c.execute(insert_query, (data.name.strip(), data.email.lower(),
         hash_password(data.password), datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()
    return {"message": "Account created successfully. Please log in."}


@app.post("/api/auth/login", tags=["Auth"])
def login(data: LoginInput):
    conn = get_db()
    c = conn.cursor()
    
    query = """
        SELECT * FROM users WHERE email = %s AND password_hash = %s
    """ if IS_POSTGRES else """
        SELECT * FROM users WHERE email = ? AND password_hash = ?
    """
    c.execute(query, (data.email.lower(), hash_password(data.password)))
    user = c.fetchone()

    if not user:
        conn.close()
        raise HTTPException(401, "Invalid email or password.")

    token = str(uuid.uuid4())
    insert_session_query = """
        INSERT INTO sessions (token, user_id, email, name, created_at) 
        VALUES (%s, %s, %s, %s, %s)
    """ if IS_POSTGRES else """
        INSERT INTO sessions (token, user_id, email, name, created_at) 
        VALUES (?, ?, ?, ?, ?)
    """
    c.execute(insert_session_query, (token, user["id"], user["email"], user["name"],
         datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()

    return {
        "token": token,
        "user":  {"name": user["name"], "email": user["email"]}
    }


@app.get("/api/auth/me", tags=["Auth"])
def me(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    session = get_user_from_token(token)
    if not session:
        raise HTTPException(401, "Invalid or expired token.")
    return {"name": session["name"], "email": session["email"]}


@app.post("/api/auth/logout", tags=["Auth"])
def logout(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    conn = get_db()
    c = conn.cursor()
    query = "DELETE FROM sessions WHERE token = %s" if IS_POSTGRES else "DELETE FROM sessions WHERE token = ?"
    c.execute(query, (token,))
    conn.commit()
    conn.close()
    return {"message": "Logged out."}


# ══════════════════════════════════════════════════════════════════════
#  STATUS
# ══════════════════════════════════════════════════════════════════════

@app.get("/api")
def root():
    return {"message": "Welcome to ShipmentSure API v2", "docs": "/docs"}

@app.get("/api/status")
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


@app.post("/api/predict", tags=["Prediction"])
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
        conn = get_db()
        c = conn.cursor()
        query = """
            INSERT INTO prediction_history (user_id, inputs, status, confidence, created_at) 
            VALUES (%s, %s, %s, %s, %s)
        """ if IS_POSTGRES else """
            INSERT INTO prediction_history (user_id, inputs, status, confidence, created_at) 
            VALUES (?, ?, ?, ?, ?)
        """
        c.execute(query, (session["user_id"], json.dumps(shipment.dict()), label,
              round(confidence, 4), datetime.utcnow().isoformat()))
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


@app.get("/api/history", tags=["Prediction"])
def history(authorization: str = Header(...)):
    token   = authorization.replace("Bearer ", "")
    session = get_user_from_token(token)
    if not session:
        raise HTTPException(401, "Authentication required.")

    conn = get_db()
    c = conn.cursor()
    query = """
        SELECT * FROM prediction_history WHERE user_id=%s ORDER BY id DESC LIMIT 10
    """ if IS_POSTGRES else """
        SELECT * FROM prediction_history WHERE user_id=? ORDER BY id DESC LIMIT 10
    """
    c.execute(query, (session["user_id"],))
    rows = c.fetchall()
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

# ── Serve React frontend (ONLY if built assets exist locally) ─────────
FRONT_DIST = os.path.join(BASE_DIR, "front", "dist")
if os.path.isdir(FRONT_DIST) and os.path.isdir(os.path.join(FRONT_DIST, "assets")):
    try:
        app.mount("/assets", StaticFiles(directory=os.path.join(FRONT_DIST, "assets")), name="assets")
        
        @app.get("/{full_path:path}")
        def serve_spa(full_path: str):
            """Serve React app for all non-API routes (SPA fallback)."""
            # Do not shadow API routes
            if full_path.startswith("api/"):
                raise HTTPException(status_code=404, detail="API route not found")
                
            file_path = os.path.join(FRONT_DIST, full_path)
            if os.path.isfile(file_path):
                return FileResponse(file_path)
            # Only return index.html if it exists
            index_path = os.path.join(FRONT_DIST, "index.html")
            if os.path.isfile(index_path):
                return FileResponse(index_path)
            raise HTTPException(status_code=404, detail="Static assets missing")
    except Exception as e:
        print(f"[WARNING] Could not mount static files: {e}")
