"""
growthos_backend/main.py
-------------------------
FastAPI app — server pe seedha kaam karta hai. Same pattern as
ebook_generator/main.py: ek hi file mein sab, env vars se config,
koi hardcoded secret nahi.

FLOW:
  1. lead_generation (MySQL) table se leads read/write
  2. EasyLearn site ke get_prospect_list se bhi leads khींचो aur
     dono ko ek hi shape mein merge karke frontend ko do
  3. Customer 360 ke "Email" card se aane wali request pe SMTP
     (real mailbox) se mail bhejo — koi third-party service nahi

Endpoints:
  GET  /leads            — sirf lead_generation table se
  GET  /leads/easylearn   — sirf EasyLearn site se
  GET  /leads/all         — dono merge karke (Customer 360/Campaign Builder isi ko call karein)
  POST /leads             — naya lead insert karo
  GET  /leads/discover    — ek product ke category+location ke hisaab se OpenStreetMap
                             (free, no API key) se real businesses discover karo (Lead Generation page)
  GET  /leads/ai-prospects — product info Groq (free) ko bhejke AI-inferred prospect
                             research karo (server-side, key kabhi browser tak nahi jaati)
  POST /send-email        — SMTP se mail bhejo (Customer 360 Email card)
  GET  /health            — health check

Env vars (DigitalOcean App Platform -> Settings -> App-Level Env Vars mein set karo):
  DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_TABLE
  EASYLEARN_LIST_PROSPECT_URL   — e.g. https://easylearnv3.org.in/Easylearn/Configuration_Controller/get_prospect_list
  SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM_NAME
  ALLOWED_ORIGINS               — comma-separated, e.g. http://localhost:5173,https://isfathena.com
"""

import os
import re
import json
from dotenv import load_dotenv

load_dotenv()  # reads .env in the same folder as main.py, if present
import logging
import smtplib
from datetime import datetime
from email.mime.text import MIMEText
from typing import Optional

import shutil
import uuid
from datetime import timedelta

import bcrypt
import jwt
import requests
import pymysql
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, EmailStr

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("growthos_backend")

app = FastAPI(title="GrowthOS AI Backend")


allowed_origins = [
    o.strip() for o in os.environ.get(
        "ALLOWED_ORIGINS", "http://localhost:5173"
    ).split(",") if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Company logos uploaded during registration get saved here and served
# back at /uploads/<filename> — swap for S3/Spaces later without
# touching the DB schema (it only ever stores the resulting URL/path).
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ─── Auth (Company Registration login) ───────────────────────────
# JWT_SECRET MUST be set as a real env var in production — the
# fallback here is only so local dev doesn't crash without a .env.
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-only-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.environ.get("JWT_EXPIRE_HOURS", "24"))
bearer_scheme = HTTPBearer()


# ═══════════════════════════════════════════════════════════════
# REQUEST / RESPONSE MODELS
# ═══════════════════════════════════════════════════════════════

class Lead(BaseModel):
    id: Optional[int] = None
    company_id: Optional[int] = None  # set server-side from the logged-in company, never trusted from the client
    product_id: Optional[int] = None  # which of the company's products this lead is for — validated server-side
    country: str = ""
    user_name: str = Field(..., min_length=1, max_length=100)
    user_address: str = ""
    gmb_status: str = ""
    web_url: str = ""
    user_mobile_number: str = ""
    user_email: str = ""
    assigned_prospect: str = ""
    current_status: str = ""
    prospect_comment: str = ""
    lead_source: str = ""      # Website | WhatsApp | Facebook | Google Ads | Referral | LinkedIn | Instagram | Email Campaign | AI Search | OpenStreetMap
    is_contacted: int = 0      # 0 = "Due" (never reached out to), 1 = "Contacted" (Email/SMS/WhatsApp/Call attempted at least once)
    ai_score: Optional[int] = None  # 0-99 — computed server-side on insert, unless the client provides one (AI Search already scores its own prospects)
    # AI Search prospect enrichment — optional, populated only for leads
    # discovered via Lead Generation's AI Search, blank for manually-added leads.
    decision_maker: str = ""
    designation: str = ""
    linkedin_url: str = ""
    industry: str = ""
    company_size: str = ""
    estimated_scale: str = ""
    technology_used: str = ""
    pain_points: str = ""
    reason: str = ""
    source: str = "growthos"   # "growthos" | "easylearn" — set automatically, not by the client


class LeadsResponse(BaseModel):
    success: bool
    data: list[Lead] = []
    message: Optional[str] = None


class EmailRequest(BaseModel):
    to_email: EmailStr
    to_name: str = "there"
    subject: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1)
    lead_id: Optional[int] = None  # if set, the send gets logged to Communication Hub


class EmailResponse(BaseModel):
    success: bool
    error: Optional[str] = None


class VerifyUrlResponse(BaseModel):
    reachable: bool
    checked_url: str


class SMSRequest(BaseModel):
    to_number: str = Field(..., min_length=10, max_length=15)
    message: str = Field(..., min_length=1, max_length=918)  # Fast2SMS Quick SMS length cap
    lead_id: Optional[int] = None  # if set, the send gets logged to Communication Hub


class SMSResponse(BaseModel):
    success: bool
    error: Optional[str] = None


class AssignRequest(BaseModel):
    lead_ids: list[int] = Field(..., min_length=1)
    assigned_prospect: str = Field(..., min_length=1)


class AssignResponse(BaseModel):
    success: bool
    updated: int = 0
    error: Optional[str] = None


class MarkContactedResponse(BaseModel):
    success: bool
    error: Optional[str] = None


class Conversation(BaseModel):
    id: int
    lead_id: int
    lead_name: str = ""
    lead_email: str = ""
    lead_mobile_number: str = ""
    channel: str
    last_message_at: Optional[str] = None
    last_message_body: str = ""


class Message(BaseModel):
    id: Optional[int] = None
    conversation_id: int
    direction: str = "sent"  # "sent" | "received"
    body: str
    created_at: Optional[str] = None


class ConversationsResponse(BaseModel):
    success: bool
    data: list[Conversation] = []


class MessagesResponse(BaseModel):
    success: bool
    data: list[Message] = []


class Automation(BaseModel):
    id: Optional[int] = None
    workflow_name: str = Field(..., min_length=1, max_length=150)
    channel: str = Field(..., min_length=1, max_length=50)
    status: str = "Draft"  # Draft | Running | Paused
    enrolled: int = 0
    completed: int = 0
    conversion_rate: float = 0.0
    budget: float = 0.0


class AutomationsResponse(BaseModel):
    success: bool
    data: list[Automation] = []
    message: Optional[str] = None


class UpdateAutomationStatsRequest(BaseModel):
    status: str = "Draft"
    enrolled: int = 0
    completed: int = 0
    conversion_rate: float = 0.0
    budget: float = 0.0


class UpdateAutomationStatsResponse(BaseModel):
    success: bool
    error: Optional[str] = None


class Deal(BaseModel):
    id: Optional[int] = None
    contact_name: str = Field(..., min_length=1, max_length=150)
    account_name: str = ""
    deal_value: float = 0
    stage: str = "New Leads"  # New Leads | Qualified | Proposal | Negotiation | Closed Won
    assigned_to: str = ""
    closing_date: Optional[str] = None  # "YYYY-MM-DD" or None
    is_won: int = 0
    won_at: Optional[str] = None  # server-set the moment stage becomes "Closed Won", cleared otherwise
    created_at: Optional[str] = None  # server-set, ignored on insert


class DealsResponse(BaseModel):
    success: bool
    data: list[Deal] = []
    message: Optional[str] = None


class UpdateDealStageRequest(BaseModel):
    stage: str = Field(..., min_length=1, max_length=50)


class UpdateDealStageResponse(BaseModel):
    success: bool
    error: Optional[str] = None


class WhatsAppRequest(BaseModel):
    to_number: str = Field(..., min_length=10, max_length=15)
    name: str = "there"  # fills the {{1}} variable in the approved template
    lead_id: Optional[int] = None  # if set, the send gets logged to Communication Hub
    message_for_log: Optional[str] = None  # the resolved template text, for logging only


class WhatsAppResponse(BaseModel):
    success: bool
    error: Optional[str] = None


# ═══════════════════════════════════════════════════════════════
# COMPANY REGISTRATION (3-step form) + LOGIN
# ═══════════════════════════════════════════════════════════════

class CompanyRegistrationCreate(BaseModel):
    # Step 1 — Company details
    company_logo_url: str = ""
    company_name: str = Field(..., min_length=1, max_length=200)
    date_of_incorporation: Optional[str] = None  # "YYYY-MM-DD"
    phase: str = ""
    industry_sector: str = ""
    company_type: str = ""
    registration_number: str = ""
    project_name: str = ""
    net_worth_currency: str = ""
    net_worth: float = 0
    raise_currency: str = ""
    amount_to_be_raised: float = 0
    corporate_jurisdiction: str = ""
    company_location: str = ""

    # Step 2 — Account details
    email: EmailStr
    website: str = ""
    password: str = Field(..., min_length=6, max_length=100)
    confirm_password: str = Field(..., min_length=6, max_length=100)
    contact_number: str = ""
    contact_number_2: str = ""

    # Step 3 — Address
    address_house: str = ""
    address_street: str = ""
    address_city: str = ""
    address_state: str = ""
    address_postal_code: str = ""
    address_country: str = ""
    corr_house: str = ""
    corr_street: str = ""
    corr_city: str = ""
    corr_state: str = ""
    corr_postal_code: str = ""
    corr_country: str = ""


class CompanyRegistration(BaseModel):
    id: int
    company_logo_url: str = ""
    company_name: str
    date_of_incorporation: Optional[str] = None
    phase: str = ""
    industry_sector: str = ""
    company_type: str = ""
    registration_number: str = ""
    project_name: str = ""
    net_worth_currency: str = ""
    net_worth: float = 0
    raise_currency: str = ""
    amount_to_be_raised: float = 0
    corporate_jurisdiction: str = ""
    company_location: str = ""
    email: str
    website: str = ""
    contact_number: str = ""
    contact_number_2: str = ""
    address_house: str = ""
    address_street: str = ""
    address_city: str = ""
    address_state: str = ""
    address_postal_code: str = ""
    address_country: str = ""
    corr_house: str = ""
    corr_street: str = ""
    corr_city: str = ""
    corr_state: str = ""
    corr_postal_code: str = ""
    corr_country: str = ""
    created_at: Optional[str] = None


class RegistrationResponse(BaseModel):
    success: bool
    data: Optional[CompanyRegistration] = None
    message: Optional[str] = None


class Product(BaseModel):
    id: Optional[int] = None
    company_id: Optional[int] = None  # set server-side from the logged-in company, never trusted from the client
    product_name: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    price: float = 0
    image_url: str = ""
    # Lead-gen targeting — stored now, used once a specific external
    # lead-source integration is wired up (not built yet).
    category: str = ""
    target_keywords: str = ""
    target_location: str = ""
    target_audience: str = ""
    created_at: Optional[str] = None


class ProductsResponse(BaseModel):
    success: bool
    data: list[Product] = []
    message: Optional[str] = None


class DiscoveredLead(BaseModel):
    osm_id: Optional[int] = None
    user_name: str
    user_address: str = ""
    user_email: str = ""
    user_mobile_number: str = ""
    web_url: str = ""
    country: str = ""
    gmb_status: str = ""
    lead_source: str = ""


class DiscoverLeadsResponse(BaseModel):
    success: bool
    data: list[DiscoveredLead] = []
    product_name: Optional[str] = None
    message: Optional[str] = None


class AiProspect(BaseModel):
    company_name: str = ""
    website: str = ""
    decision_maker: str = ""
    designation: str = ""
    email: str = ""
    phone: str = ""
    linkedin: str = ""
    location: str = ""
    industry: str = ""
    company_size: str = ""
    estimated_scale: str = ""
    technology_used: str = ""
    pain_points: str = ""
    lead_score: Optional[int] = None
    reason: str = ""


class AiProspectsResponse(BaseModel):
    success: bool
    data: list[AiProspect] = []
    message: Optional[str] = None


class EmailCheckResponse(BaseModel):
    exists: bool


class LogoUploadResponse(BaseModel):
    success: bool
    company_logo_url: str = ""


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class LoginResponse(BaseModel):
    success: bool
    token: Optional[str] = None
    company: Optional[CompanyRegistration] = None
    error: Optional[str] = None


# ═══════════════════════════════════════════════════════════════
# DB — lead_generation table (MySQL)
# ═══════════════════════════════════════════════════════════════

DB_TABLE = os.environ.get("DB_TABLE", "lead_generation")

# ⚠️ REQUIRED ONE-TIME MIGRATION — this table must have company_id AND
# product_id columns for the per-company/per-product scoping below to
# work at all. Run this against your DB if they don't already exist:
#
#   ALTER TABLE lead_generation ADD COLUMN company_id INT DEFAULT NULL;
#   ALTER TABLE lead_generation ADD COLUMN product_id INT DEFAULT NULL;
#
# Any pre-existing rows will have company_id/product_id = NULL after
# this — they won't show up for ANY company/product until manually
# backfilled (e.g. UPDATE lead_generation SET company_id = <id>,
# product_id = <id> WHERE id IN (...);), since NULL matches no
# `company_id = %s` / `product_id = %s` filter.

# Column list kept explicit (not SELECT *) so the API shape stays
# stable even if the table gains extra internal columns later.
# Matches the current `lead_generation` table structure exactly —
# user_type / connected_date were dropped from that table, and
# lead_source was added (see Lead_Management.jsx's "Source" field).
LEAD_COLUMNS = [
    "id", "country", "user_name", "user_address",
    "gmb_status", "web_url", "user_mobile_number", "user_email",
    "assigned_prospect", "current_status", "prospect_comment", "lead_source",
    "is_contacted", "ai_score", "company_id", "product_id",
    "decision_maker", "designation", "linkedin_url", "industry",
    "company_size", "estimated_scale", "technology_used", "pain_points", "reason",
]

# Heuristic lead score (0-99), computed from the fields captured on the
# "Add Lead" form itself — not from pipeline status or row id. Signals,
# chosen to reflect how sales-ready/reachable a lead looks at the moment
# it's captured:
#   - lead_source quality        (Referral/LinkedIn score higher than cold channels)
#   - gmb_status                 (a claimed Google Business listing = a real, managed business)
#   - presence of a website URL  (an established web presence)
#   - contact completeness       (having BOTH a valid email and valid 10-digit phone)
#   - comment/detail length      (more context typically means a more qualified lead)
AI_SCORE_BASE = 40

AI_SCORE_SOURCE_POINTS = {
    "Referral": 20,
    "LinkedIn": 15,
    "Website": 12,
    "Google Ads": 10,
    "OpenStreetMap": 10,
    "Email Campaign": 8,
    "WhatsApp": 8,
    "AI Search": 6,  # AI-inferred, not yet verified — scored lower than confirmed real sources
    "Instagram": 5,
    "Facebook": 5,
}

AI_SCORE_GMB_POINTS = {
    "Claimed": 15,
    "Unclaimed": 5,
    "Uncategorized": 0,
}


def compute_ai_score(lead: "Lead") -> int:
    score = AI_SCORE_BASE
    score += AI_SCORE_SOURCE_POINTS.get(lead.lead_source, 0)
    score += AI_SCORE_GMB_POINTS.get(lead.gmb_status, 0)

    if lead.web_url and lead.web_url.strip():
        score += 10

    has_valid_email = bool(lead.user_email and "@" in lead.user_email and "." in lead.user_email.split("@")[-1])
    phone_digits = "".join(ch for ch in (lead.user_mobile_number or "") if ch.isdigit())
    has_valid_phone = len(phone_digits) == 10
    if has_valid_email and has_valid_phone:
        score += 10
    elif has_valid_email or has_valid_phone:
        score += 5

    comment_len = len((lead.prospect_comment or "").strip())
    if comment_len > 100:
        score += 5
    elif comment_len > 30:
        score += 3
    elif comment_len > 0:
        score += 1

    return min(99, score)


def get_db_connection():
    try:
        return pymysql.connect(
            host=os.environ.get("DB_HOST", "localhost"),
            port=int(os.environ.get("DB_PORT", "3306")),
            user=os.environ.get("DB_USER", "root"),
            password=os.environ.get("DB_PASSWORD", ""),
            database=os.environ.get("DB_NAME", "isfathena"),
            cursorclass=pymysql.cursors.DictCursor,
            connect_timeout=8,
        )
    except Exception as e:
        logger.error(f"DB connection failed: {e}")
        raise HTTPException(500, "Database connection failed")


def fetch_local_leads(company_id: int, product_id: Optional[int] = None) -> list[dict]:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cols = ", ".join(LEAD_COLUMNS)
            # is_del is the soft-delete flag on this table — skip rows that
            # have been "deleted" without a hard DELETE. Rows where it's
            # NULL (e.g. never set) are treated as not-deleted. Scoped to
            # company_id so one company never sees another's leads — and,
            # when product_id is given, further scoped so one product's
            # dashboard never shows another product's leads.
            where = "(is_del = 0 OR is_del IS NULL) AND company_id = %s"
            params = [company_id]
            if product_id is not None:
                where += " AND product_id = %s"
                params.append(product_id)
            cur.execute(
                f"SELECT {cols} FROM {DB_TABLE} WHERE {where} ORDER BY id DESC",
                params,
            )
            rows = cur.fetchall()
            for r in rows:
                r["source"] = "growthos"
            return rows
    finally:
        conn.close()


def insert_local_lead(lead: Lead, company_id: int) -> int:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # A product_id is only trusted once we've confirmed it's one of
            # THIS company's own products — otherwise it's silently dropped
            # (set to NULL) rather than trusting whatever the client sent.
            product_id = None
            if lead.product_id is not None:
                product = fetch_product_by_id(lead.product_id, company_id)
                if product:
                    product_id = product["id"]

            # For every source EXCEPT "AI Search", ai_score is derived from
            # the lead's own form fields (source, gmb_status, web_url,
            # contact info, comment) — never taken from the client — so
            # every lead is scored the same consistent way.
            # "AI Search" leads are the one exception: the AI already
            # produced its own fit-score during discovery (shown on the
            # Lead Generation page), and the user asked for that exact
            # number to carry through to Lead Management instead of being
            # silently replaced by a different computed one.
            fields = [c for c in LEAD_COLUMNS if c not in ("id", "ai_score", "company_id", "product_id")]
            all_cols = fields + ["ai_score", "company_id", "product_id", "account_id", "is_del"]
            placeholders = ", ".join(["%s"] * len(all_cols))
            cols = ", ".join(all_cols)
            if lead.lead_source == "AI Search" and lead.ai_score is not None:
                score = max(0, min(99, int(lead.ai_score)))
            else:
                score = compute_ai_score(lead)
            values = [getattr(lead, f) for f in fields] + [score, company_id, product_id, 0, 0]
            cur.execute(f"INSERT INTO {DB_TABLE} ({cols}) VALUES ({placeholders})", values)
            conn.commit()
            return cur.lastrowid
    finally:
        conn.close()


# Fields the "Edit Lead" form can change. Deliberately excludes
# ai_score/company_id/product_id/lead_source-driven scoring — editing
# contact details shouldn't silently recompute or reassign the lead's
# score or ownership; that stays exactly what it was.
LEAD_EDITABLE_FIELDS = [
    "country", "user_name", "user_address", "gmb_status", "web_url",
    "user_mobile_number", "user_email", "assigned_prospect", "current_status",
    "prospect_comment", "lead_source",
]


def update_local_lead(lead_id: int, lead: Lead, company_id: int) -> bool:
    """Company-scoped — WHERE also checks company_id so a company can
    never edit another company's lead, even by guessing an id."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            set_clause = ", ".join(f"{f} = %s" for f in LEAD_EDITABLE_FIELDS)
            values = [getattr(lead, f) for f in LEAD_EDITABLE_FIELDS] + [lead_id, company_id]
            cur.execute(
                f"UPDATE {DB_TABLE} SET {set_clause} WHERE id = %s AND company_id = %s",
                values,
            )
            conn.commit()
            return cur.rowcount > 0
    finally:
        conn.close()


def assign_local_leads(lead_ids: list[int], assigned_prospect: str, company_id: int) -> int:
    """Bulk-updates assigned_prospect for the given lead ids in ONE query —
    used by Lead Management's "Assign" action on multi-selected rows.
    Scoped to company_id so a company can never touch another's lead
    just by guessing an id."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            placeholders = ", ".join(["%s"] * len(lead_ids))
            cur.execute(
                f"UPDATE {DB_TABLE} SET assigned_prospect = %s WHERE id IN ({placeholders}) AND company_id = %s",
                [assigned_prospect, *lead_ids, company_id],
            )
            conn.commit()
            return cur.rowcount
    finally:
        conn.close()


def mark_lead_contacted(lead_id: int, company_id: int) -> bool:
    """Sets is_contacted = 1 for a single lead — called after a successful
    Email/SMS/WhatsApp send, or a Call attempt, from the Reachable Channels
    card. Drives the "Contacted" vs "Due" status shown in Lead Management.
    Scoped to company_id so a company can never mark-contacted another
    company's lead just by guessing an id."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE {DB_TABLE} SET is_contacted = 1 WHERE id = %s AND company_id = %s",
                [lead_id, company_id],
            )
            conn.commit()
            return cur.rowcount > 0
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════
# COMPANY REGISTRATION — isfathena.company_registrations table
#
# Run this once against the DB (or paste into your migration tool):
#
#   CREATE TABLE company_registrations (
#     id INT AUTO_INCREMENT PRIMARY KEY,
#     company_logo_url VARCHAR(500) DEFAULT '',
#     company_name VARCHAR(200) NOT NULL,
#     date_of_incorporation DATE NULL,
#     phase VARCHAR(100) DEFAULT '',
#     industry_sector VARCHAR(100) DEFAULT '',
#     company_type VARCHAR(100) DEFAULT '',
#     registration_number VARCHAR(100) DEFAULT '',
#     project_name VARCHAR(200) DEFAULT '',
#     net_worth_currency VARCHAR(10) DEFAULT '',
#     net_worth DECIMAL(18,2) DEFAULT 0,
#     raise_currency VARCHAR(10) DEFAULT '',
#     amount_to_be_raised DECIMAL(18,2) DEFAULT 0,
#     corporate_jurisdiction VARCHAR(150) DEFAULT '',
#     company_location VARCHAR(200) DEFAULT '',
#     email VARCHAR(150) NOT NULL UNIQUE,
#     website VARCHAR(200) DEFAULT '',
#     password_hash VARCHAR(255) NOT NULL,
#     contact_number VARCHAR(30) DEFAULT '',
#     contact_number_2 VARCHAR(30) DEFAULT '',
#     address_house VARCHAR(150) DEFAULT '',
#     address_street VARCHAR(200) DEFAULT '',
#     address_city VARCHAR(100) DEFAULT '',
#     address_state VARCHAR(100) DEFAULT '',
#     address_postal_code VARCHAR(20) DEFAULT '',
#     address_country VARCHAR(100) DEFAULT '',
#     corr_house VARCHAR(150) DEFAULT '',
#     corr_street VARCHAR(200) DEFAULT '',
#     corr_city VARCHAR(100) DEFAULT '',
#     corr_state VARCHAR(100) DEFAULT '',
#     corr_postal_code VARCHAR(20) DEFAULT '',
#     corr_country VARCHAR(100) DEFAULT '',
#     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
#   );
# ═══════════════════════════════════════════════════════════════

COMPANY_TABLE = "company_registrations"

COMPANY_COLUMNS = [
    "id", "company_logo_url", "company_name", "date_of_incorporation", "phase",
    "industry_sector", "company_type", "registration_number", "project_name",
    "net_worth_currency", "net_worth", "raise_currency", "amount_to_be_raised",
    "corporate_jurisdiction", "company_location", "email", "website",
    "contact_number", "contact_number_2", "address_house", "address_street",
    "address_city", "address_state", "address_postal_code", "address_country",
    "corr_house", "corr_street", "corr_city", "corr_state",
    "corr_postal_code", "corr_country", "created_at",
]


def _row_to_company(row: dict) -> dict:
    """DATE/TIMESTAMP columns come back as date/datetime objects from
    pymysql — stringify them so the Pydantic response model (which
    types these as str) doesn't choke."""
    if row.get("date_of_incorporation") is not None:
        row["date_of_incorporation"] = str(row["date_of_incorporation"])
    if row.get("created_at") is not None:
        row["created_at"] = str(row["created_at"])
    return row


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


def create_jwt_token(company_id: int, email: str) -> str:
    payload = {
        "sub": str(company_id),
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Session expired, please log in again")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid session, please log in again")


async def get_current_company(creds: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> dict:
    """Dependency for any endpoint that needs to know which logged-in
    company is calling it — use as: `company = Depends(get_current_company)`."""
    payload = decode_jwt_token(creds.credentials)
    company = get_company_by_id(int(payload["sub"]))
    if not company:
        raise HTTPException(401, "Account not found")
    return company


def email_exists(email: str) -> bool:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT id FROM {COMPANY_TABLE} WHERE email = %s LIMIT 1", [email])
            return cur.fetchone() is not None
    finally:
        conn.close()


def get_company_by_email(email: str) -> Optional[dict]:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cols = ", ".join(COMPANY_COLUMNS + ["password_hash"])
            cur.execute(f"SELECT {cols} FROM {COMPANY_TABLE} WHERE email = %s LIMIT 1", [email])
            row = cur.fetchone()
            return _row_to_company(row) if row else None
    finally:
        conn.close()


def get_company_by_id(company_id: int) -> Optional[dict]:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cols = ", ".join(COMPANY_COLUMNS)
            cur.execute(f"SELECT {cols} FROM {COMPANY_TABLE} WHERE id = %s LIMIT 1", [company_id])
            row = cur.fetchone()
            return _row_to_company(row) if row else None
    finally:
        conn.close()


def insert_company_registration(reg: CompanyRegistrationCreate) -> int:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            fields = [c for c in COMPANY_COLUMNS if c not in ("id", "created_at")]
            all_cols = fields + ["password_hash"]
            placeholders = ", ".join(["%s"] * len(all_cols))
            cols = ", ".join(all_cols)
            values = [getattr(reg, f) for f in fields] + [hash_password(reg.password)]
            cur.execute(f"INSERT INTO {COMPANY_TABLE} ({cols}) VALUES ({placeholders})", values)
            conn.commit()
            return cur.lastrowid
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════
# CUSTOM DROPDOWN OPTIONS — "Other" -> typed value on the Company
# Registration form gets saved here (isfathena.custom_dropdown_options)
# so the NEXT company to register sees it as a normal option instead
# of typing it again. Shared across all companies (this form runs
# before anyone is logged in), deduped case-insensitively per field.
#
# Run this once against the DB:
#
#   CREATE TABLE custom_dropdown_options (
#     id INT AUTO_INCREMENT PRIMARY KEY,
#     field_name VARCHAR(50) NOT NULL,
#     value VARCHAR(150) NOT NULL,
#     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
#     UNIQUE KEY uniq_field_value (field_name, value)
#   );
# ═══════════════════════════════════════════════════════════════

DROPDOWN_OPTIONS_TABLE = "custom_dropdown_options"
# Only fields whose dropdown actually offers an "Other" choice on the form.
DROPDOWN_ALLOWED_FIELDS = {"industry_sector", "company_type"}


class DropdownOptionsResponse(BaseModel):
    success: bool
    data: list[str] = []
    message: Optional[str] = None


class AddDropdownOptionRequest(BaseModel):
    value: str = Field(..., min_length=1, max_length=150)


def fetch_custom_dropdown_options(field_name: str) -> list[str]:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT value FROM {DROPDOWN_OPTIONS_TABLE} WHERE field_name = %s ORDER BY value ASC",
                [field_name],
            )
            return [r["value"] for r in cur.fetchall()]
    finally:
        conn.close()


def add_custom_dropdown_option(field_name: str, value: str) -> list[str]:
    """Insert only if this value isn't already there (case-insensitive) —
    then return the full, current list so the frontend can just replace
    its state with the response instead of guessing what changed."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT id FROM {DROPDOWN_OPTIONS_TABLE} WHERE field_name = %s AND LOWER(value) = LOWER(%s)",
                [field_name, value],
            )
            if not cur.fetchone():
                cur.execute(
                    f"INSERT INTO {DROPDOWN_OPTIONS_TABLE} (field_name, value) VALUES (%s, %s)",
                    [field_name, value],
                )
                conn.commit()
    finally:
        conn.close()
    return fetch_custom_dropdown_options(field_name)


# ═══════════════════════════════════════════════════════════════
# PRODUCTS — Home page (isfathena.products), scoped per logged-in company
# ═══════════════════════════════════════════════════════════════

PRODUCTS_TABLE = "company_products"
PRODUCT_SELECT_COLUMNS = [
    "id", "company_id", "product_name", "description", "price", "image_url",
    "category", "target_keywords", "target_location", "target_audience", "created_at",
]
PRODUCT_INSERT_FIELDS = ["product_name", "description", "price", "image_url", "category", "target_keywords", "target_location", "target_audience"]


def fetch_products(company_id: int) -> list[dict]:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cols = ", ".join(PRODUCT_SELECT_COLUMNS)
            cur.execute(
                f"SELECT {cols} FROM {PRODUCTS_TABLE} WHERE is_del = 0 AND company_id = %s ORDER BY id DESC",
                [company_id],
            )
            rows = cur.fetchall()
            for r in rows:
                if r.get("created_at") is not None:
                    r["created_at"] = str(r["created_at"])
            return rows
    finally:
        conn.close()


def insert_product(product: Product, company_id: int) -> int:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            all_cols = PRODUCT_INSERT_FIELDS + ["company_id", "account_id", "is_del"]
            placeholders = ", ".join(["%s"] * len(all_cols))
            cols = ", ".join(all_cols)
            values = [getattr(product, f) for f in PRODUCT_INSERT_FIELDS] + [company_id, 0, 0]
            cur.execute(f"INSERT INTO {PRODUCTS_TABLE} ({cols}) VALUES ({placeholders})", values)
            conn.commit()
            return cur.lastrowid
    finally:
        conn.close()


def fetch_product_by_id(product_id: int, company_id: int) -> Optional[dict]:
    """Scoped the same way fetch_products() is — a company can only ever
    look up its OWN product, never another company's, regardless of what
    product_id the client sends."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cols = ", ".join(PRODUCT_SELECT_COLUMNS)
            cur.execute(
                f"SELECT {cols} FROM {PRODUCTS_TABLE} WHERE is_del = 0 AND company_id = %s AND id = %s",
                [company_id, product_id],
            )
            row = cur.fetchone()
            if row and row.get("created_at") is not None:
                row["created_at"] = str(row["created_at"])
            return row
    finally:
        conn.close()


def update_product(product_id: int, product: Product, company_id: int) -> bool:
    """Scoped the same way fetch_product_by_id() is — WHERE company_id = %s
    means a company can only ever update its OWN product, never another
    company's, regardless of what product_id the client sends. Returns
    False (no rows matched) if the product doesn't exist or isn't theirs."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            set_clause = ", ".join([f"{f} = %s" for f in PRODUCT_INSERT_FIELDS])
            values = [getattr(product, f) for f in PRODUCT_INSERT_FIELDS] + [company_id, product_id]
            cur.execute(
                f"UPDATE {PRODUCTS_TABLE} SET {set_clause} WHERE is_del = 0 AND company_id = %s AND id = %s",
                values,
            )
            conn.commit()
            return cur.rowcount > 0
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════
# LEAD DISCOVERY — AI Search (Groq), server-side.
# Free — Groq has a generous free tier, unlike OpenAI which needs
# billing set up before any request succeeds. Called server-side (not
# from the browser) so the key never ships inside the frontend JS
# bundle, and so this is consistent with the OpenStreetMap source's
# server-side pattern.
#
# Honest limitation: this is the model's own general knowledge, not a
# live lookup — treat results as AI-inferred research starting points,
# not verified contacts. The frontend already disclaims this clearly.
# ═══════════════════════════════════════════════════════════════

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"


def generate_ai_prospects(product: dict) -> list[dict]:
    prompt = f"""You are a B2B sales research assistant. Based on the product details below, propose 8 to 10 realistic, high-potential prospect organizations that would be strong buyers. Use your general knowledge of businesses/organizations in the given industry and location — this is a best-effort research starting point, not verified real-time data, so be reasonable rather than overconfident.

Product: {product.get("product_name", "")}
Description: {product.get("description", "N/A")}
Price: {product.get("price", "N/A")}
Industry/Category: {product.get("category", "N/A")}
Target Keywords: {product.get("target_keywords", "N/A")}
Target Location: {product.get("target_location", "N/A")}
Target Audience: {product.get("target_audience", "N/A")}

Return ONLY valid JSON, no commentary, in exactly this shape:
{{"prospects": [
  {{
    "company_name": "", "website": "", "decision_maker": "", "designation": "",
    "email": "", "phone": "", "linkedin": "", "location": "", "industry": "",
    "company_size": "", "estimated_scale": "", "technology_used": "",
    "pain_points": "", "lead_score": 0, "reason": ""
  }}
]}}
lead_score must be an integer from 0-99 reflecting fit quality.

CRITICAL — "website" and "linkedin" specifically: only fill these in if you
genuinely recognize this as a REAL, specific organization whose actual
website/LinkedIn URL you know with real confidence. Do NOT construct a
guessed domain by pattern-matching the company name (e.g. never turn
"Gokhale Education Society" into a made-up guess like "gesnashik.ac.in" —
that pattern-guessing is exactly the mistake to avoid, even though it looks
plausible). If you're inventing a plausible-sounding company (not a
specific real one you can identify), or you don't actually know its real
URL, leave "website" and "linkedin" as empty strings — an empty field is
correct and expected here, a wrong-but-plausible-looking URL is not. Leave
any other field empty too if you genuinely don't have a reasonable
estimate — don't invent fake specifics like exact emails/phones unless
publicly plausible for that organization type."""

    res = requests.post(
        GROQ_CHAT_URL,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {GROQ_API_KEY}",
        },
        json={
            "model": GROQ_MODEL,
            "temperature": 0.5,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=60,
    )
    if not res.ok:
        # Groq's error responses include a helpful "error.message" (e.g.
        # invalid key, rate limit, model access) — surface that instead
        # of just the bare HTTP status code.
        try:
            detail = res.json().get("error", {}).get("message", res.text[:300])
        except Exception:
            detail = res.text[:300]
        raise RuntimeError(f"Groq {res.status_code}: {detail}")
    content = res.json()["choices"][0]["message"]["content"].strip()
    parsed = json.loads(content)
    prospects = parsed.get("prospects", [])
    return [p for p in prospects if isinstance(p, dict) and p.get("company_name")]


# ═══════════════════════════════════════════════════════════════
# LEAD DISCOVERY — OpenStreetMap (Nominatim + Overpass), genuinely
# free and open-source: no API key, no billing account, no vendor
# lock-in. Given a product's Category and Target Location (both
# already captured on the Add Product form), this finds real
# businesses on the map that match. Discovered leads are returned
# for preview only — nothing is written to lead_generation until
# the user picks specific ones via the existing POST /leads.
#
# Honest limitation: OSM is crowd-sourced map data, not a business
# directory — so phone/website are present only when someone mapped
# them, and email is never present. Coverage is strong in dense
# metro areas and thinner in smaller towns. This is the real
# trade-off of a free/open data source, not a bug to "fix" later.
# ═══════════════════════════════════════════════════════════════

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
# Public Overpass instances get overloaded — trying a mirror if the first
# one fails/times out meaningfully improves real-world reliability.
OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

# Nominatim's usage policy requires a descriptive User-Agent identifying
# the calling app — requests without one get silently rate-limited/blocked.
OSM_USER_AGENT = os.environ.get(
    "OSM_USER_AGENT", "GrowthOS-AI-LeadGen/1.0 (+https://growthos.ai)"
)

# Maps each "Category / Industry" option on the Add Product form to the
# OSM tag(s) that identify matching real-world places. Kept as a plain
# dict (not a DB table) since it only changes when the form's own
# category list changes.
CATEGORY_TO_OSM_TAGS = {
    "Real Estate": [("office", "estate_agent")],
    "SaaS / Software": [("office", "it"), ("office", "company")],
    "E-commerce": [("shop", "yes")],
    "Education": [("amenity", "school"), ("amenity", "college"), ("amenity", "university")],
    "Healthcare": [("amenity", "hospital"), ("amenity", "clinic"), ("amenity", "doctors")],
    "Finance & Banking": [("amenity", "bank")],
    "Manufacturing": [("office", "company")],
    "Retail": [("shop", "yes")],
    "Hospitality & Travel": [("tourism", "hotel")],
    "Automotive": [("shop", "car")],
    "Legal Services": [("office", "lawyer")],
    "Marketing & Advertising": [("office", "advertising_agency")],
}
DEFAULT_OSM_TAGS = [("office", "company")]  # "Other (specify)" / unmapped categories

# Case/whitespace-insensitive lookup — a product's stored category value
# (e.g. from an older row, or typed slightly differently) shouldn't
# silently fall through to DEFAULT_OSM_TAGS just because of casing.
_CATEGORY_TO_OSM_TAGS_LOWER = {k.lower(): v for k, v in CATEGORY_TO_OSM_TAGS.items()}


def _tags_for_category(category: str) -> list:
    return _CATEGORY_TO_OSM_TAGS_LOWER.get((category or "").strip().lower(), DEFAULT_OSM_TAGS)


# Overpass times out on a huge area (e.g. all of India) combined with a
# common tag like shop=yes — capping any resolved box to this many degrees
# per side (~110km) keeps queries fast while still covering a whole metro
# region. City-level Nominatim results are already smaller than this and
# pass through untouched.
MAX_BBOX_SPAN_DEGREES = 1.0


def _cap_bbox_span(bbox: list, max_span: float = MAX_BBOX_SPAN_DEGREES) -> list:
    south, north, west, east = bbox
    if (north - south) <= max_span and (east - west) <= max_span:
        return bbox
    center_lat, center_lon = (north + south) / 2, (east + west) / 2
    half = max_span / 2
    return [center_lat - half, center_lat + half, center_lon - half, center_lon + half]


# Blank / "Pan India" / "International" / unresolvable location -> a
# single geometric center-of-India box often lands on a low-density rural
# patch with almost nothing mapped on OSM. Scanning several real metro
# areas instead gives "Pan India" an actual shot at finding real leads.
MAJOR_METRO_BBOXES = [
    [18.89, 19.27, 72.77, 73.03],   # Mumbai
    [28.40, 28.88, 76.84, 77.35],   # Delhi NCR
    [12.83, 13.14, 77.45, 77.75],   # Bangalore
    [17.25, 17.55, 78.30, 78.65],   # Hyderabad
    [12.90, 13.20, 80.15, 80.35],   # Chennai
    [18.45, 18.65, 73.75, 73.95],   # Pune
    [22.45, 22.65, 88.30, 88.45],   # Kolkata
    [22.95, 23.15, 72.50, 72.70],   # Ahmedabad
]


def _bboxes_for_location(location: str) -> list:
    """One resolvable place -> just that one (capped) box. Anything else
    (blank/"Pan India"/"International"/unresolvable) -> several major
    metro boxes searched together, since a real city almost always has
    far better OSM coverage than one arbitrary rural patch."""
    resolved = geocode_location(location)
    return [_cap_bbox_span(resolved)] if resolved else MAJOR_METRO_BBOXES


def geocode_location(location: str) -> Optional[list]:
    """Free-text location (e.g. "Pune, India") -> OSM bounding box
    [south, north, west, east], via Nominatim's free geocoder. Returns
    None for blank/"Pan India"/"International"/unresolvable input."""
    if not location or location.strip().lower() in {"pan india", "international", ""}:
        return None
    try:
        res = requests.get(
            NOMINATIM_URL,
            params={"q": location, "format": "json", "limit": 1},
            headers={"User-Agent": OSM_USER_AGENT},
            timeout=10,
        )
        results = res.json()
        if not results:
            return None
        bbox = results[0].get("boundingbox")  # [south, north, west, east] as strings
        return [float(x) for x in bbox] if bbox else None
    except Exception as e:
        logger.error(f"geocode_location error for '{location}': {e}")
        return None


def _escape_overpass_regex(term: str) -> str:
    """Keeps an AI-suggested or user-typed search term safe to drop into
    an Overpass QL regex literal — escapes regex metacharacters and any
    quote/backslash that could otherwise break out of the query string."""
    return re.escape(term.strip())[:80]


# A real business is essentially never literally NAMED "Private Schools"
# or "Coaching Institutes" — those are category descriptions, not names.
# So AI Search / Custom Search terms are matched against real OSM TAGS
# first (same vocabulary as CATEGORY_TO_OSM_TAGS), via whichever common
# noun appears in the term; only a term with no recognizable noun falls
# back to a literal (much lower-recall) name-text match.
KEYWORD_TO_OSM_TAG = {
    "school": ("amenity", "school"), "schools": ("amenity", "school"),
    "college": ("amenity", "college"), "colleges": ("amenity", "college"),
    "university": ("amenity", "university"), "universities": ("amenity", "university"),
    "institute": ("amenity", "college"), "institutes": ("amenity", "college"),
    "hospital": ("amenity", "hospital"), "hospitals": ("amenity", "hospital"),
    "clinic": ("amenity", "clinic"), "clinics": ("amenity", "clinic"),
    "doctor": ("amenity", "doctors"), "doctors": ("amenity", "doctors"),
    "pharmacy": ("amenity", "pharmacy"), "pharmacies": ("amenity", "pharmacy"),
    "bank": ("amenity", "bank"), "banks": ("amenity", "bank"),
    "hotel": ("tourism", "hotel"), "hotels": ("tourism", "hotel"),
    "resort": ("tourism", "hotel"), "resorts": ("tourism", "hotel"),
    "restaurant": ("amenity", "restaurant"), "restaurants": ("amenity", "restaurant"),
    "supermarket": ("shop", "supermarket"), "supermarkets": ("shop", "supermarket"),
    "mall": ("shop", "mall"), "malls": ("shop", "mall"),
    "shop": ("shop", "yes"), "shops": ("shop", "yes"),
    "store": ("shop", "yes"), "stores": ("shop", "yes"),
    "retailer": ("shop", "yes"), "retailers": ("shop", "yes"),
    "lawyer": ("office", "lawyer"), "lawyers": ("office", "lawyer"),
    "estate": ("office", "estate_agent"), "realty": ("office", "estate_agent"),
    "agency": ("office", "advertising_agency"), "agencies": ("office", "advertising_agency"),
    "company": ("office", "company"), "companies": ("office", "company"),
    "startup": ("office", "company"), "startups": ("office", "company"),
    "healthcare": ("amenity", "hospital"),
    "platform": ("office", "it"), "platforms": ("office", "it"),
    "software": ("office", "it"), "tech": ("office", "it"),
    "ecommerce": ("shop", "yes"),
}


def _keyword_search_filters(keywords: list, south, north, west, east) -> str:
    """Splits AI/custom search phrases into words, converts any word with
    a known OSM-tag synonym into a real tag filter, and only uses a
    literal name-regex match for the terms that had no such synonym."""
    tag_filters = set()
    name_only_terms = []

    for phrase in keywords[:6]:
        words = re.findall(r"[a-zA-Z]+", phrase.lower())
        matched_tag = next((KEYWORD_TO_OSM_TAG[w] for w in words if w in KEYWORD_TO_OSM_TAG), None)
        if matched_tag:
            tag_filters.add(matched_tag)
        else:
            name_only_terms.append(phrase)

    filters = "".join(
        f'node["{k}"="{v}"]({south},{west},{north},{east});' for k, v in tag_filters
    )
    filters += "".join(
        f'node["name"~"{_escape_overpass_regex(term)}",i]({south},{west},{north},{east});'
        for term in name_only_terms
    )
    return filters


def discover_osm_leads(
    category: str, location: str, limit: int = 20, keywords: Optional[list] = None
) -> list[dict]:
    """Queries the free Overpass API for real businesses either:
      - matching one of `keywords` (AI Search / Custom Search) — each
        term is converted to a real OSM tag where a known synonym exists
        (e.g. "Private Schools" -> amenity=school), falling back to a
        literal name-text match only when no synonym is recognized, or
      - matching `category`'s fixed OSM tag(s) (OpenStreetMap source —
        the original behaviour).
    Returns normalized, NOT-yet-saved lead dicts for the frontend to preview.
    """
    bboxes = _bboxes_for_location(location)
    cleaned_keywords = [k.strip() for k in (keywords or []) if k and k.strip()]

    def _filters_for(bbox) -> str:
        south, north, west, east = bbox
        if cleaned_keywords:
            return _keyword_search_filters(cleaned_keywords, south, north, west, east)
        tags = _tags_for_category(category)
        return "".join(f'node["{k}"="{v}"]({south},{west},{north},{east});' for k, v in tags)

    tag_filters = "".join(_filters_for(b) for b in bboxes)
    # Multiple metro areas in one query (the "Pan India" case) genuinely
    # have more real places to find, so allow a larger result cap.
    effective_limit = limit if len(bboxes) == 1 else max(limit, 8 * len(bboxes))

    query = f"""
    [out:json][timeout:25];
    (
      {tag_filters}
    );
    out center {effective_limit};
    """

    elements = []
    last_error = None
    for mirror in OVERPASS_URLS:
        try:
            res = requests.post(mirror, data={"data": query}, timeout=30)
            res.raise_for_status()
            elements = res.json().get("elements", [])
            last_error = None
            break  # got a response — no need to try the next mirror
        except Exception as e:
            last_error = e
            logger.error(f"discover_osm_leads Overpass error via {mirror}: {e}")
            continue

    if last_error is not None:
        return []

    logger.info(
        f"discover_osm_leads: bboxes={bboxes} keywords={cleaned_keywords or None} "
        f"category={category!r} -> {len(elements)} raw OSM elements"
    )

    leads = []
    for el in elements[:effective_limit]:
        t = el.get("tags", {})
        name = t.get("name")
        if not name:
            continue  # unnamed map nodes aren't usable as a lead

        address_parts = [
            t.get("addr:housenumber", ""),
            t.get("addr:street", ""),
            t.get("addr:city", ""),
            t.get("addr:state", ""),
        ]
        leads.append({
            "osm_id": el.get("id"),
            "user_name": name,
            "user_address": ", ".join(p for p in address_parts if p) or location,
            "user_email": "",  # OSM never carries email addresses
            "user_mobile_number": t.get("contact:phone", t.get("phone", "")),
            "web_url": t.get("contact:website", t.get("website", "")),
            "country": t.get("addr:country", ""),
            "gmb_status": "Uncategorized",
            "lead_source": "OpenStreetMap",
        })

    return leads


# ═══════════════════════════════════════════════════════════════
# COMMUNICATION HUB — isfathena.conversations / .messages
# Phase 1: logs real OUTBOUND sends only (Email/SMS/WhatsApp sent
# via the Reachable Channels card). Inbound replies aren't wired
# up yet — that needs a public webhook per channel (see notes
# given alongside this feature).
# ═══════════════════════════════════════════════════════════════

def get_or_create_conversation(lead_id: int, channel: str) -> int:
    """One conversation per (lead, channel) pair — reused across sends."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM conversations WHERE lead_id = %s AND channel = %s LIMIT 1",
                [lead_id, channel],
            )
            row = cur.fetchone()
            if row:
                return row["id"]
            cur.execute(
                "INSERT INTO conversations (lead_id, channel) VALUES (%s, %s)",
                [lead_id, channel],
            )
            conn.commit()
            return cur.lastrowid
    finally:
        conn.close()


def log_message(lead_id: int, channel: str, body: str, direction: str = "sent"):
    """Best-effort — a failure here should never block the actual send."""
    try:
        conversation_id = get_or_create_conversation(lead_id, channel)
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO messages (conversation_id, direction, body) VALUES (%s, %s, %s)",
                    [conversation_id, direction, body],
                )
                cur.execute(
                    "UPDATE conversations SET last_message_at = NOW() WHERE id = %s",
                    [conversation_id],
                )
                conn.commit()
        finally:
            conn.close()
    except Exception as e:
        logger.warning(f"log_message failed (send itself still succeeded): {e}")


def fetch_conversations() -> list[dict]:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                    c.id, c.lead_id, c.channel, c.last_message_at,
                    l.user_name AS lead_name, l.user_email AS lead_email,
                    l.user_mobile_number AS lead_mobile_number,
                    (SELECT body FROM messages m WHERE m.conversation_id = c.id
                     ORDER BY m.created_at DESC LIMIT 1) AS last_message_body
                FROM conversations c
                JOIN {DB_TABLE} l ON l.id = c.lead_id
                ORDER BY c.last_message_at DESC
                """
            )
            rows = cur.fetchall()
            for r in rows:
                if r.get("last_message_at") is not None:
                    r["last_message_at"] = str(r["last_message_at"])
                r["last_message_body"] = r.get("last_message_body") or ""
            return rows
    finally:
        conn.close()


def fetch_messages(conversation_id: int) -> list[dict]:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, conversation_id, direction, body, created_at FROM messages WHERE conversation_id = %s ORDER BY created_at ASC",
                [conversation_id],
            )
            rows = cur.fetchall()
            for r in rows:
                if r.get("created_at") is not None:
                    r["created_at"] = str(r["created_at"])
            return rows
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════
# CAMPAIGN AUTOMATIONS — isfathena.campaign_automations table
# ═══════════════════════════════════════════════════════════════

AUTOMATIONS_TABLE = "campaign_automations"
AUTOMATION_COLUMNS = [
    "id", "workflow_name", "channel", "status", "enrolled", "completed", "conversion_rate", "budget",
]


def fetch_local_automations() -> list[dict]:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cols = ", ".join(AUTOMATION_COLUMNS)
            cur.execute(f"SELECT {cols} FROM {AUTOMATIONS_TABLE} WHERE is_del = 0 ORDER BY id DESC")
            return cur.fetchall()
    finally:
        conn.close()


def insert_local_automation(automation: Automation) -> int:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            fields = [c for c in AUTOMATION_COLUMNS if c != "id"]
            all_cols = fields + ["account_id", "is_del"]
            placeholders = ", ".join(["%s"] * len(all_cols))
            cols = ", ".join(all_cols)
            values = [getattr(automation, f) for f in fields] + [0, 0]
            cur.execute(f"INSERT INTO {AUTOMATIONS_TABLE} ({cols}) VALUES ({placeholders})", values)
            conn.commit()
            return cur.lastrowid
    finally:
        conn.close()


def update_automation_stats(automation_id: int, stats: "UpdateAutomationStatsRequest") -> bool:
    """Manually updates an automation's status/enrolled/completed/conversion —
    there's no execution engine feeding these automatically yet, so the
    person enters real numbers themselves (e.g. from the WhatsApp/Email
    provider's own dashboard)."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE {AUTOMATIONS_TABLE} SET status = %s, enrolled = %s, completed = %s, conversion_rate = %s, budget = %s WHERE id = %s",
                [stats.status, stats.enrolled, stats.completed, stats.conversion_rate, stats.budget, automation_id],
            )
            conn.commit()
            return cur.rowcount > 0
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════
# SALES PIPELINE DEALS — isfathena.deals table
# ═══════════════════════════════════════════════════════════════

DEALS_TABLE = "deals"
DEAL_SELECT_COLUMNS = [
    "id", "contact_name", "account_name", "deal_value", "stage",
    "assigned_to", "closing_date", "is_won", "won_at", "created_at",
]
# created_at is server-managed (DB default) — never part of an INSERT.
DEAL_INSERT_FIELDS = [
    "contact_name", "account_name", "deal_value", "stage", "assigned_to", "closing_date", "is_won",
]


def fetch_local_deals() -> list[dict]:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cols = ", ".join(DEAL_SELECT_COLUMNS)
            cur.execute(f"SELECT {cols} FROM {DEALS_TABLE} WHERE is_del = 0 ORDER BY id DESC")
            rows = cur.fetchall()
            for r in rows:
                # pymysql returns DATETIME/DATE columns as Python datetime/date
                # objects, which aren't directly JSON-serializable — convert
                # both to plain strings before returning.
                if r.get("created_at") is not None:
                    r["created_at"] = str(r["created_at"])
                if r.get("closing_date") is not None:
                    r["closing_date"] = str(r["closing_date"])
                if r.get("won_at") is not None:
                    r["won_at"] = str(r["won_at"])
            return rows
    finally:
        conn.close()


def insert_local_deal(deal: Deal) -> int:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            all_cols = DEAL_INSERT_FIELDS + ["account_id", "is_del", "won_at"]
            placeholders = ", ".join(["%s"] * len(all_cols))
            cols = ", ".join(all_cols)
            # closing_date must be a real date or NULL — an empty string
            # from the form isn't valid for a DATE column.
            values = [getattr(deal, f) or None if f == "closing_date" else getattr(deal, f) for f in DEAL_INSERT_FIELDS]
            # A deal can be created directly in the "Closed Won" stage (the
            # create form's stage dropdown allows it) — set won_at right away
            # in that case, same as update_deal_stage does on a Kanban move.
            won_at = datetime.now() if deal.stage == "Closed Won" else None
            values += [0, 0, won_at]
            cur.execute(f"INSERT INTO {DEALS_TABLE} ({cols}) VALUES ({placeholders})", values)
            conn.commit()
            return cur.lastrowid
    finally:
        conn.close()


def update_deal_stage(deal_id: int, new_stage: str) -> bool:
    """Called when a card is dragged to a different column on the Kanban
    board. is_won is kept in sync automatically — moving INTO "Closed Won"
    sets it, moving OUT of it clears it. won_at works the same way: it's
    the real timestamp of when the deal became Closed Won (NOT the
    closing_date field, which is just the target/expected close date set
    manually on the form) — set the moment it's won, cleared if it's
    ever moved back out of Closed Won."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            is_won = 1 if new_stage == "Closed Won" else 0
            if new_stage == "Closed Won":
                cur.execute(
                    f"UPDATE {DEALS_TABLE} SET stage = %s, is_won = %s, won_at = NOW() WHERE id = %s",
                    [new_stage, is_won, deal_id],
                )
            else:
                cur.execute(
                    f"UPDATE {DEALS_TABLE} SET stage = %s, is_won = %s, won_at = NULL WHERE id = %s",
                    [new_stage, is_won, deal_id],
                )
            conn.commit()
            return cur.rowcount > 0
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════
# EASYLEARN SITE — cross-site lead fetch
# ═══════════════════════════════════════════════════════════════

def fetch_easylearn_leads() -> list[dict]:
    url = os.environ.get("EASYLEARN_LIST_PROSPECT_URL", "")
    if not url:
        return []
    try:
        resp = requests.post(url, timeout=10)
        resp.raise_for_status()
        payload = resp.json()
        raw = payload.get("data")
        if not raw or raw == "FALSE":
            return []
        rows = raw if isinstance(raw, list) else list(raw.values())
        normalized = []
        for r in rows:
            normalized.append({
                "id": r.get("id"),
                "country": r.get("country", ""),
                "user_name": r.get("user_name", ""),
                "user_address": r.get("user_address", ""),
                "gmb_status": r.get("gmb_status", ""),
                "web_url": r.get("web_url", ""),
                "user_mobile_number": r.get("user_mobile_number", ""),
                "user_email": r.get("user_email", ""),
                "assigned_prospect": r.get("assigned_prospect", ""),
                "current_status": r.get("current_status", ""),
                "prospect_comment": r.get("prospect_comment", ""),
                "lead_source": "",  # EasyLearn's table doesn't have this column
                "is_contacted": 0,  # EasyLearn's table doesn't track this either
                "source": "easylearn",
            })
        return normalized
    except Exception as e:
        logger.warning(f"EasyLearn fetch failed: {e}")
        return []


# ═══════════════════════════════════════════════════════════════
# SMTP — Customer 360 "Email" card
# ═══════════════════════════════════════════════════════════════

def send_smtp_email(to_email: str, to_name: str, subject: str, message: str):
    # "or" (not .get()'s default param) so a present-but-EMPTY env var still
    # falls back to the default — the diagnosed issue was SMTP_USERNAME and
    # SMTP_PASSWORD being set to "" somewhere (system env var or a stray
    # .env), which .get(key, default) does NOT fall back on since the key
    # technically exists.
    host     = os.environ.get("SMTP_HOST") or "smtp.gmail.com"
    port     = int(os.environ.get("SMTP_PORT") or "587")
    username = os.environ.get("SMTP_USERNAME") or "isfinformaticaanalytica@gmail.com"
    password = os.environ.get("SMTP_PASSWORD") or "sttiimwxsnriditb"
    from_name = os.environ.get("SMTP_FROM_NAME") or "GrowthOS AI Team"

    if not host or not username or not password:
        raise RuntimeError("SMTP not configured")

    msg = MIMEText(message, "plain")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{username}>"
    msg["To"] = f"{to_name} <{to_email}>"
    msg["Reply-To"] = username

    with smtplib.SMTP(host, port, timeout=15) as server:
        server.starttls()
        server.login(username, password)
        server.sendmail(username, [to_email], msg.as_string())


# ═══════════════════════════════════════════════════════════════
# FAST2SMS — Reachable Channels "SMS" card
# ═══════════════════════════════════════════════════════════════

FAST2SMS_ENDPOINT = "https://www.fast2sms.com/dev/bulkV2"


def send_fast2sms(to_number: str, message: str):
    api_key = os.environ.get("FAST2SMS_API_KEY", "")
    if not api_key:
        raise RuntimeError("Fast2SMS not configured")

    digits = "".join(ch for ch in to_number if ch.isdigit())[-10:]  # last 10 digits, Fast2SMS wants a bare Indian mobile number
    if len(digits) != 10:
        raise RuntimeError("Invalid mobile number")

    resp = requests.post(
        FAST2SMS_ENDPOINT,
        headers={"authorization": api_key},
        data={
            "route": "q",          # Quick SMS — no DLT template registration needed
            "message": message,
            "language": "english",
            "flash": 0,
            "numbers": digits,
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    if not data.get("return"):
        # Fast2SMS returns {"return": false, "message": [...]} on failure
        raise RuntimeError(str(data.get("message", "Fast2SMS send failed")))


# ═══════════════════════════════════════════════════════════════
# WHATSAPP CLOUD API (Meta) — Reachable Channels "WhatsApp" card
# ═══════════════════════════════════════════════════════════════

WHATSAPP_API_VERSION = "v22.0"

# Must match a template you've created & had approved in Meta Business
# Suite -> WhatsApp Manager -> Message Templates. It should have exactly
# one {{1}} variable (used for the lead's name). See main.py's top-of-file
# setup notes for the exact template body used elsewhere in this project.
WHATSAPP_TEMPLATE_NAME = os.environ.get("WHATSAPP_TEMPLATE_NAME", "growthos_intro")
WHATSAPP_TEMPLATE_LANG = os.environ.get("WHATSAPP_TEMPLATE_LANG", "en_US")


def send_whatsapp_template(to_number: str, name: str):
    token = os.environ.get("WHATSAPP_ACCESS_TOKEN", "")
    phone_number_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")
    if not token or not phone_number_id:
        raise RuntimeError("WhatsApp Cloud API not configured")

    # WhatsApp wants the full international number (country code + number,
    # no "+" or spaces). Same best-effort mapping used for the wa.me link.
    digits = "".join(ch for ch in to_number if ch.isdigit())

    url = f"https://graph.facebook.com/{WHATSAPP_API_VERSION}/{phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": digits,
        "type": "template",
        "template": {
            "name": WHATSAPP_TEMPLATE_NAME,
            "language": {"code": WHATSAPP_TEMPLATE_LANG},
            "components": [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": name}],
                }
            ],
        },
    }

    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=payload,
        timeout=15,
    )
    if resp.status_code >= 400:
        # Meta's error body has useful detail (e.g. template not approved,
        # number not verified in test mode) — surface it to the logs.
        raise RuntimeError(f"WhatsApp API error {resp.status_code}: {resp.text[:300]}")


# ═══════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@app.get("/leads", response_model=LeadsResponse)
async def get_local_leads(
    product_id: Optional[int] = None, company: dict = Depends(get_current_company)
):
    try:
        rows = fetch_local_leads(company["id"], product_id)
        return LeadsResponse(success=True, data=rows)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"/leads error: {e}")
        raise HTTPException(500, "Could not load leads")


@app.get("/leads/easylearn", response_model=LeadsResponse)
async def get_easylearn_leads():
    rows = fetch_easylearn_leads()
    return LeadsResponse(success=True, data=rows)


@app.get("/leads/all", response_model=LeadsResponse)
async def get_all_leads(
    product_id: Optional[int] = None, company: dict = Depends(get_current_company)
):
    """Campaign Builder / Customer 360 should call THIS endpoint —
    merges lead_generation (scoped to the logged-in company, and to
    product_id when given) with the EasyLearn site's leads into one
    list, each row tagged with its `source`. (EasyLearn's own leads are
    a separate, shared external source by design — not company-scoped,
    same as /leads/easylearn.)"""
    local = []
    try:
        local = fetch_local_leads(company["id"], product_id)
    except HTTPException:
        pass  # local DB down shouldn't block EasyLearn leads from showing
    external = fetch_easylearn_leads()
    return LeadsResponse(success=True, data=local + external)


@app.post("/leads", response_model=LeadsResponse)
async def create_lead(lead: Lead, company: dict = Depends(get_current_company)):
    try:
        new_id = insert_local_lead(lead, company["id"])
        lead.id = new_id
        lead.company_id = company["id"]
        # Mirror insert_local_lead's own scoring choice, so the score in
        # this response matches what's actually stored in the DB.
        if lead.lead_source == "AI Search" and lead.ai_score is not None:
            lead.ai_score = max(0, min(99, int(lead.ai_score)))
        else:
            lead.ai_score = compute_ai_score(lead)
        return LeadsResponse(success=True, data=[lead], message=f"Lead #{new_id} created")
    except Exception as e:
        logger.error(f"/leads POST error: {e}")
        raise HTTPException(500, "Could not save lead")


@app.patch("/leads/{lead_id}", response_model=LeadsResponse)
async def edit_lead(lead_id: int, lead: Lead, company: dict = Depends(get_current_company)):
    try:
        updated = update_local_lead(lead_id, lead, company["id"])
        if not updated:
            raise HTTPException(404, "Lead not found")
        lead.id = lead_id
        return LeadsResponse(success=True, data=[lead], message=f"Lead #{lead_id} updated")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"/leads/{{lead_id}} PATCH error: {e}")
        raise HTTPException(500, "Could not update lead")


@app.post("/send-email", response_model=EmailResponse)
async def send_email(req: EmailRequest):
    try:
        send_smtp_email(req.to_email, req.to_name, req.subject, req.message)
        if req.lead_id:
            log_message(req.lead_id, "email", req.message, "sent")
        return EmailResponse(success=True)
    except Exception as e:
        logger.error(f"/send-email error: {e}")
        # Kept deliberately generic — matches the frontend's single
        # error message for any SMTP/config/network failure.
        raise HTTPException(500, detail="Provider information is not correct.")


@app.post("/send-sms", response_model=SMSResponse)
async def send_sms(req: SMSRequest):
    try:
        send_fast2sms(req.to_number, req.message)
        if req.lead_id:
            log_message(req.lead_id, "sms", req.message, "sent")
        return SMSResponse(success=True)
    except Exception as e:
        logger.error(f"/send-sms error: {e}")
        raise HTTPException(500, detail="Provider information is not correct.")


@app.post("/send-whatsapp", response_model=WhatsAppResponse)
async def send_whatsapp(req: WhatsAppRequest):
    try:
        send_whatsapp_template(req.to_number, req.name)
        if req.lead_id:
            log_message(req.lead_id, "whatsapp", req.message_for_log or f"[Template sent to {req.name}]", "sent")
        return WhatsAppResponse(success=True)
    except Exception as e:
        logger.error(f"/send-whatsapp error: {e}")
        raise HTTPException(500, detail="Provider information is not correct.")


@app.post("/leads/assign", response_model=AssignResponse)
async def assign_leads(req: AssignRequest, company: dict = Depends(get_current_company)):
    """Bulk-assign — Lead Management's "Assign" button on the multi-select
    bar calls this once with all selected lead ids, instead of one request
    per row. Scoped to the logged-in company's own leads only."""
    try:
        updated = assign_local_leads(req.lead_ids, req.assigned_prospect, company["id"])
        return AssignResponse(success=True, updated=updated)
    except Exception as e:
        logger.error(f"/leads/assign error: {e}")
        raise HTTPException(500, "Could not update leads")


@app.post("/leads/{lead_id}/mark-contacted", response_model=MarkContactedResponse)
async def mark_contacted(lead_id: int, company: dict = Depends(get_current_company)):
    """Called by the Reachable Channels card right after a successful
    Email/SMS/WhatsApp send, or a Call attempt — flips this lead's status
    from "Due" to "Contacted" in Lead Management. Scoped to the logged-in
    company's own leads only."""
    try:
        mark_lead_contacted(lead_id, company["id"])
        return MarkContactedResponse(success=True)
    except Exception as e:
        logger.error(f"/leads/{{lead_id}}/mark-contacted error: {e}")
        raise HTTPException(500, "Could not update lead")


@app.get("/automations", response_model=AutomationsResponse)
async def get_automations():
    try:
        rows = fetch_local_automations()
        return AutomationsResponse(success=True, data=rows)
    except Exception as e:
        logger.error(f"/automations GET error: {e}")
        raise HTTPException(500, "Could not load automations")


@app.post("/automations", response_model=AutomationsResponse)
async def create_automation(automation: Automation):
    try:
        new_id = insert_local_automation(automation)
        return AutomationsResponse(success=True, data=[automation], message=f"Automation #{new_id} created")
    except Exception as e:
        logger.error(f"/automations POST error: {e}")
        raise HTTPException(500, "Could not save automation")


@app.patch("/automations/{automation_id}/stats", response_model=UpdateAutomationStatsResponse)
async def update_automation(automation_id: int, stats: UpdateAutomationStatsRequest):
    try:
        update_automation_stats(automation_id, stats)
        return UpdateAutomationStatsResponse(success=True)
    except Exception as e:
        logger.error(f"/automations/{{automation_id}}/stats error: {e}")
        raise HTTPException(500, "Could not update automation")


@app.get("/deals", response_model=DealsResponse)
async def get_deals():
    try:
        rows = fetch_local_deals()
        return DealsResponse(success=True, data=rows)
    except Exception as e:
        logger.error(f"/deals GET error: {e}")
        raise HTTPException(500, "Could not load deals")


@app.post("/deals", response_model=DealsResponse)
async def create_deal(deal: Deal):
    try:
        new_id = insert_local_deal(deal)
        return DealsResponse(success=True, data=[deal], message=f"Deal #{new_id} created")
    except Exception as e:
        logger.error(f"/deals POST error: {e}")
        raise HTTPException(500, "Could not save deal")


@app.patch("/deals/{deal_id}/stage", response_model=UpdateDealStageResponse)
async def move_deal_stage(deal_id: int, req: UpdateDealStageRequest):
    """Called when a Kanban card is dragged into a different column."""
    try:
        update_deal_stage(deal_id, req.stage)
        return UpdateDealStageResponse(success=True)
    except Exception as e:
        logger.error(f"/deals/{{deal_id}}/stage error: {e}")
        raise HTTPException(500, "Could not move deal")


@app.get("/conversations", response_model=ConversationsResponse)
async def get_conversations():
    try:
        rows = fetch_conversations()
        return ConversationsResponse(success=True, data=rows)
    except Exception as e:
        logger.error(f"/conversations error: {e}")
        raise HTTPException(500, "Could not load conversations")


@app.get("/conversations/{conversation_id}/messages", response_model=MessagesResponse)
async def get_conversation_messages(conversation_id: int):
    try:
        rows = fetch_messages(conversation_id)
        return MessagesResponse(success=True, data=rows)
    except Exception as e:
        logger.error(f"/conversations/{{conversation_id}}/messages error: {e}")
        raise HTTPException(500, "Could not load messages")


@app.get("/company-registrations/check-email", response_model=EmailCheckResponse)
async def check_email(email: EmailStr):
    """Step 2's live 'Email already in use!' check — call this on blur
    or with a short debounce as the user types."""
    return EmailCheckResponse(exists=email_exists(email))


@app.post("/upload/company-logo", response_model=LogoUploadResponse)
async def upload_company_logo(file: UploadFile = File(...)):
    """Step 1's 'Choose File' control calls this first; the returned
    company_logo_url is then included in the final POST /company-registrations
    submit at the end of step 3."""
    allowed_ext = {".png", ".jpg", ".jpeg", ".svg", ".webp"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(400, "Logo must be a PNG, JPG, SVG, or WEBP image")

    filename = f"{uuid.uuid4().hex}{ext}"
    dest_path = os.path.join(UPLOAD_DIR, filename)
    try:
        with open(dest_path, "wb") as out:
            shutil.copyfileobj(file.file, out)
    finally:
        file.file.close()

    return LogoUploadResponse(success=True, company_logo_url=f"/uploads/{filename}")


@app.get("/dropdown-options/{field}", response_model=DropdownOptionsResponse)
async def get_dropdown_options(field: str):
    if field not in DROPDOWN_ALLOWED_FIELDS:
        raise HTTPException(404, "Unknown dropdown field")
    try:
        return DropdownOptionsResponse(success=True, data=fetch_custom_dropdown_options(field))
    except Exception as e:
        logger.error(f"/dropdown-options/{field} GET error: {e}")
        raise HTTPException(500, "Could not load options")


@app.post("/dropdown-options/{field}", response_model=DropdownOptionsResponse)
async def add_dropdown_option(field: str, req: AddDropdownOptionRequest):
    if field not in DROPDOWN_ALLOWED_FIELDS:
        raise HTTPException(404, "Unknown dropdown field")
    value = req.value.strip()
    if not value:
        raise HTTPException(400, "Value cannot be empty")
    try:
        options = add_custom_dropdown_option(field, value)
        return DropdownOptionsResponse(success=True, data=options, message="Option saved")
    except Exception as e:
        logger.error(f"/dropdown-options/{field} POST error: {e}")
        raise HTTPException(500, "Could not save option")


@app.post("/company-registrations", response_model=RegistrationResponse)
async def create_company_registration(reg: CompanyRegistrationCreate):
    if reg.password != reg.confirm_password:
        raise HTTPException(400, "Passwords do not match")
    if email_exists(reg.email):
        raise HTTPException(409, "Email already in use")

    try:
        new_id = insert_company_registration(reg)
        company = get_company_by_id(new_id)
        return RegistrationResponse(
            success=True,
            data=CompanyRegistration(**company),
            message="Company registered successfully",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"/company-registrations POST error: {e}")
        raise HTTPException(500, "Could not complete registration")


@app.post("/auth/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    company = get_company_by_email(req.email)
    if not company or not verify_password(req.password, company["password_hash"]):
        # Deliberately identical message for "no such email" and "wrong
        # password" — don't let the response reveal which emails are registered.
        raise HTTPException(401, "Invalid email or password")

    token = create_jwt_token(company["id"], company["email"])
    company.pop("password_hash", None)
    return LoginResponse(success=True, token=token, company=CompanyRegistration(**company))


@app.get("/auth/me", response_model=CompanyRegistration)
async def get_me(company: dict = Depends(get_current_company)):
    """Frontend calls this on load with the stored JWT to restore the
    logged-in session (e.g. to re-populate a profile page)."""
    return CompanyRegistration(**company)


@app.get("/products", response_model=ProductsResponse)
async def get_products(company: dict = Depends(get_current_company)):
    try:
        rows = fetch_products(company["id"])
        return ProductsResponse(success=True, data=rows)
    except Exception as e:
        logger.error(f"/products GET error: {e}")
        raise HTTPException(500, "Could not load products")


@app.post("/products", response_model=ProductsResponse)
async def create_product(product: Product, company: dict = Depends(get_current_company)):
    try:
        new_id = insert_product(product, company["id"])
        return ProductsResponse(success=True, data=[product], message=f"Product #{new_id} created")
    except Exception as e:
        logger.error(f"/products POST error: {e}")
        raise HTTPException(500, "Could not save product")


@app.patch("/products/{product_id}", response_model=ProductsResponse)
async def edit_product(product_id: int, product: Product, company: dict = Depends(get_current_company)):
    existing = fetch_product_by_id(product_id, company["id"])
    if not existing:
        raise HTTPException(404, "Product not found")
    try:
        update_product(product_id, product, company["id"])
        updated = fetch_product_by_id(product_id, company["id"])
        return ProductsResponse(success=True, data=[updated], message=f"Product #{product_id} updated")
    except Exception as e:
        logger.error(f"/products/{product_id} PATCH error: {e}")
        raise HTTPException(500, "Could not update product")


@app.get("/leads/discover", response_model=DiscoverLeadsResponse)
async def discover_leads(
    product_id: int,
    keywords: Optional[str] = None,
    company: dict = Depends(get_current_company),
):
    """Real, free lead discovery via OpenStreetMap — no API key, no paid
    service. Finds businesses matching the given product's Category near
    its Target Location, OR — if `keywords` is passed (comma-separated,
    from AI Search / Custom Search) — businesses whose OSM name matches
    any of those terms instead. See discover_osm_leads() for the honest
    limitations of this being crowd-sourced, free map data."""
    product = fetch_product_by_id(product_id, company["id"])
    if not product:
        raise HTTPException(404, "Product not found")
    try:
        keyword_list = [k for k in keywords.split(",")] if keywords else None
        leads = discover_osm_leads(
            product["category"], product["target_location"], keywords=keyword_list
        )
        return DiscoverLeadsResponse(success=True, data=leads, product_name=product["product_name"])
    except Exception as e:
        logger.error(f"/leads/discover error: {e}")
        raise HTTPException(500, "Could not discover leads")


@app.get("/leads/ai-prospects", response_model=AiProspectsResponse)
async def ai_prospects(product_id: int, company: dict = Depends(get_current_company)):
    """AI-inferred prospect research via Groq (free) — called server-side
    for consistency with the other lead sources, and so the key never
    ships inside the frontend JS bundle. Returns a clean 'not configured'
    message instead of a 500 if GROQ_API_KEY isn't set."""
    if not GROQ_API_KEY:
        return AiProspectsResponse(
            success=False,
            message="AI Search isn't configured — set GROQ_API_KEY in the backend's environment.",
        )
    product = fetch_product_by_id(product_id, company["id"])
    if not product:
        raise HTTPException(404, "Product not found")
    try:
        prospects = generate_ai_prospects(product)
        return AiProspectsResponse(success=True, data=prospects)
    except Exception as e:
        logger.error(f"/leads/ai-prospects error: {e}")
        # Surfaced directly in the response (visible in the Network tab)
        # so the real cause (bad key, rate limit, etc.) is visible
        # without needing backend terminal access.
        return AiProspectsResponse(success=False, message=f"Couldn't reach AI Search: {e}")


VERIFY_URL_HEADERS = {
    # Many sites/WAFs (esp. institutional/government ones) outright reject
    # requests' default User-Agent ("python-requests/x.x") as bot traffic —
    # a real browser UA avoids that false negative.
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


@app.get("/verify-url", response_model=VerifyUrlResponse)
async def verify_url(url: str):
    """AI Search prospects' websites are AI-inferred, not real-time
    verified — this does a real, live check right before the link is
    allowed to open, so a made-up domain doesn't just show a broken tab.

    "Reachable" = the server responded at all, with ANY HTTP status —
    even 403/401/500 proves the domain exists and is live; it just means
    that specific request was blocked (very common on WAF/Cloudflare-
    protected sites, which block automated clients regardless of
    User-Agent). Only a connection-level failure (DNS lookup fails,
    connection refused/reset, TLS handshake fails, timeout) means the
    domain is genuinely unreachable — that's the real signal for an
    AI-hallucinated domain that doesn't actually exist."""
    candidate = url.strip()
    if not candidate:
        return VerifyUrlResponse(reachable=False, checked_url=url)
    if not candidate.startswith(("http://", "https://")):
        candidate = f"https://{candidate}"

    try:
        requests.head(candidate, timeout=8, allow_redirects=True, headers=VERIFY_URL_HEADERS)
        return VerifyUrlResponse(reachable=True, checked_url=candidate)
    except requests.RequestException:
        pass

    try:
        requests.get(candidate, timeout=8, allow_redirects=True, stream=True, headers=VERIFY_URL_HEADERS)
        return VerifyUrlResponse(reachable=True, checked_url=candidate)
    except requests.RequestException:
        return VerifyUrlResponse(reachable=False, checked_url=candidate)


@app.get("/health")
async def health():
    # Use the SAME defaults as get_db_connection() / send_smtp_email() so
    # this reflects what those functions will actually connect with —
    # not just whether an OS-level env var happens to be set.
    db_host = os.environ.get("DB_HOST") or "localhost"
    smtp_host = os.environ.get("SMTP_HOST") or "smtp.gmail.com"
    smtp_username = os.environ.get("SMTP_USERNAME") or "isfinformaticaanalytica@gmail.com"

    return {
        "status": "ok",
        "service": "growthos_backend",
        "db_configured": bool(db_host),
        # Genuinely optional — Lead Management currently calls /leads (local-only),
        # not /leads/all, so this being unset doesn't block anything right now.
        "easylearn_configured": bool(os.environ.get("EASYLEARN_LIST_PROSPECT_URL")),
        "smtp_configured": bool(smtp_host and smtp_username),
        "sms_configured": bool(os.environ.get("FAST2SMS_API_KEY")),
        "whatsapp_configured": bool(os.environ.get("WHATSAPP_ACCESS_TOKEN") and os.environ.get("WHATSAPP_PHONE_NUMBER_ID")),
    }