import hashlib
import secrets
import time
from contextlib import asynccontextmanager
from datetime import date
from decimal import Decimal
from typing import Annotated, Literal
from urllib.parse import urlsplit

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, StringConstraints

from .database import DATABASE_PATH, ROOT, connect, initialize
from .passwords import hash_password, verify_password

SESSION_COOKIE = "pitstop_session"
SESSION_LIFETIME = 7 * 24 * 60 * 60

ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
Mileage = Annotated[int, Field(ge=0, le=999_999_999)]


class Login(BaseModel):
    email: Annotated[str, StringConstraints(
        strip_whitespace=True, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    )]
    password: Annotated[str, Field(min_length=1, max_length=128)]


class Registration(Login):
    nickname: ShortText
    password: Annotated[str, Field(min_length=8, max_length=128)]


class Vehicle(BaseModel):
    brand: ShortText
    model: ShortText
    year: Annotated[int, Field(ge=1886, le=2100)]
    mileage: Mileage
    plate: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=24)]


class Maintenance(BaseModel):
    vehicle_id: Annotated[int, Field(gt=0, le=2**63 - 1)]
    service_type: Literal[
        "Oil & Filter Change",
        "Brake Replacement",
        "Tire Change",
        "General Inspection",
        "Other",
    ]
    status: Literal["completed", "scheduled"]
    service_date: date
    mileage: Mileage
    cost: Annotated[Decimal, Field(ge=0, max_digits=10, decimal_places=2)] = Decimal("0")
    notes: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] = ""


@asynccontextmanager
async def lifespan(app):
    initialize(DATABASE_PATH)
    yield


app = FastAPI(title="PitStop API", lifespan=lifespan)


@app.middleware("http")
async def protect_api(request: Request, call_next):
    is_api = request.url.path.startswith("/api/")
    origin = request.headers.get("origin")

    # Reject cross-origin writes from browsers, including other subdomains.
    if is_api and request.method == "POST" and origin is not None:
        try:
            source = urlsplit(origin)
            same_host = source.netloc.lower() == request.url.netloc.lower()
            valid_origin = source.scheme in {"http", "https"} and same_host
        except ValueError:
            valid_origin = False
        if not valid_origin or request.headers.get("sec-fetch-site") in {"same-site", "cross-site"}:
            return JSONResponse({"detail": "Cross-origin requests are not allowed."}, status_code=403)

    response = await call_next(request)
    if is_api or request.url.path == "/dashboard.html":
        response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    return JSONResponse(
        {"detail": [{"loc": error["loc"], "msg": error["msg"]} for error in errors]},
        status_code=422,
    )


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def session_user(db, request):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        return db.execute(
            """
            SELECT users.id, users.nickname, users.email
            FROM sessions JOIN users ON users.id = sessions.user_id
            WHERE sessions.token_hash = ? AND sessions.expires_at > ?
            """,
            (token_hash(token), int(time.time())),
        ).fetchone()


def require_user(db, request):
    user = session_user(db, request)
    if user is None:
        raise HTTPException(401, "Please log in.")
    return user


def start_session(db, user_id, request):
    new_token = secrets.token_urlsafe(32)
    now = int(time.time())
    db.execute("DELETE FROM sessions WHERE expires_at <= ?", (now,))
    previous_token = request.cookies.get(SESSION_COOKIE)
    if previous_token:
        db.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash(previous_token),))
    db.execute(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
        (token_hash(new_token), user_id, now + SESSION_LIFETIME),
    )
    return new_token


def set_session_cookie(response, request, token):
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_LIFETIME,
        httponly=True,
        samesite="lax",
        secure=request.url.scheme == "https",
    )


@app.post("/api/register", status_code=201)
def register(payload: Registration, request: Request, response: Response):
    email = payload.email.casefold()
    password_hash = hash_password(payload.password)
    with connect(DATABASE_PATH) as db, db:
        result = db.execute(
            """
            INSERT INTO users (nickname, email, password_hash) VALUES (?, ?, ?)
            ON CONFLICT(email) DO NOTHING
            """,
            (payload.nickname, email, password_hash),
        )
        if result.rowcount == 0:
            raise HTTPException(409, "This email is already registered.")
        user_id = result.lastrowid
        token = start_session(db, user_id, request)
    set_session_cookie(response, request, token)
    return {"id": user_id, "nickname": payload.nickname, "email": email}


@app.post("/api/login")
def login(payload: Login, request: Request, response: Response):
    with connect(DATABASE_PATH) as db, db:
        user = db.execute(
            "SELECT id, nickname, email, password_hash FROM users WHERE email = ?",
            (payload.email.casefold(),),
        ).fetchone()
        stored_hash = user["password_hash"] if user else ""
        if not verify_password(payload.password, stored_hash):
            raise HTTPException(401, "Incorrect email or password.")
        # A local password reset may have occurred while the hash was being checked.
        db.execute("BEGIN IMMEDIATE")
        password_is_current = db.execute(
            "SELECT 1 FROM users WHERE id = ? AND password_hash = ?",
            (user["id"], stored_hash),
        ).fetchone()
        if not password_is_current:
            raise HTTPException(401, "Incorrect email or password.")
        token = start_session(db, user["id"], request)
    set_session_cookie(response, request, token)
    return {"id": user["id"], "nickname": user["nickname"], "email": user["email"]}


@app.post("/api/logout", status_code=204)
def logout(request: Request):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        with connect(DATABASE_PATH) as db, db:
            db.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash(token),))
    response = Response(status_code=204)
    response.delete_cookie(
        SESSION_COOKIE, httponly=True, samesite="lax", secure=request.url.scheme == "https"
    )
    return response


@app.get("/api/dashboard")
def get_dashboard(request: Request):
    with connect(DATABASE_PATH) as db, db:
        db.execute("BEGIN")
        user = require_user(db, request)
        vehicles = db.execute(
            "SELECT id, brand, model, year, mileage, plate FROM vehicles WHERE user_id = ? ORDER BY id",
            (user["id"],),
        ).fetchall()
        records = db.execute(
            """
            SELECT maintenance.* FROM maintenance
            JOIN vehicles ON vehicles.id = maintenance.vehicle_id
            WHERE vehicles.user_id = ?
            ORDER BY maintenance.id DESC
            """,
            (user["id"],),
        ).fetchall()
    return {
        "user": dict(user),
        "vehicles": [dict(vehicle) for vehicle in vehicles],
        "maintenance": [dict(record) for record in records],
    }


@app.post("/api/vehicles", status_code=201)
def add_vehicle(payload: Vehicle, request: Request):
    vehicle = payload.model_dump()
    with connect(DATABASE_PATH) as db, db:
        user = require_user(db, request)
        result = db.execute(
            """
            INSERT INTO vehicles (user_id, brand, model, year, mileage, plate)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user["id"], payload.brand, payload.model, payload.year, payload.mileage, payload.plate),
        )
    return {"id": result.lastrowid, **vehicle}


@app.post("/api/maintenance", status_code=201)
def add_maintenance(payload: Maintenance, request: Request):
    service_date = payload.service_date.isoformat()
    cost_cents = int(payload.cost * 100)
    with connect(DATABASE_PATH) as db, db:
        user = require_user(db, request)
        result = db.execute(
            """
            INSERT INTO maintenance (vehicle_id, service_type, status, service_date, mileage, cost_cents, notes)
            SELECT id, ?, ?, ?, ?, ?, ? FROM vehicles WHERE id = ? AND user_id = ?
            """,
            (
                payload.service_type,
                payload.status,
                service_date,
                payload.mileage,
                cost_cents,
                payload.notes,
                payload.vehicle_id,
                user["id"],
            ),
        )
        if result.rowcount == 0:
            raise HTTPException(404, "Vehicle not found.")
    return {
        **payload.model_dump(exclude={"cost"}),
        "id": result.lastrowid,
        "service_date": service_date,
        "cost_cents": cost_cents,
    }


@app.get("/", include_in_schema=False)
@app.get("/index.html", include_in_schema=False)
def index():
    return FileResponse(ROOT / "index.html")


@app.get("/dashboard.html", include_in_schema=False)
def dashboard(request: Request):
    with connect(DATABASE_PATH) as db:
        user = session_user(db, request)
    if user is None:
        return RedirectResponse("/?login=1", status_code=303)
    return FileResponse(ROOT / "dashboard.html")


# Serve the existing frontend at its original URLs without exposing the repository or database.
if (ROOT / "resimler").is_dir():
    app.mount("/resimler", StaticFiles(directory=ROOT / "resimler"), name="images")


@app.get("/{asset}", include_in_schema=False)
def serve_asset(asset: str):
    if asset not in {"style.css", "dashboard.css", "script.js", "dashscript.js", "api.js"}:
        raise HTTPException(404)
    return FileResponse(ROOT / asset)
