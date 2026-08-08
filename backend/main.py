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
  FRONTEND_BASE_URL             — where invite emails point (Team & Users), e.g. https://isfathena.com
                                   defaults to http://localhost:5173 for local dev
"""

import os
import re
import json
import hashlib
import secrets
from dotenv import load_dotenv

load_dotenv()  # reads .env in the same folder as main.py, if present
import logging
import smtplib
from datetime import datetime
from email.mime.text import MIMEText
from typing import Optional, List

import shutil
import uuid
from datetime import timedelta

import bcrypt
import jwt
import requests
import pymysql
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, HTMLResponse
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
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Where invite emails point — the Accept Invite page is now served
# directly by THIS backend (GET /accept-invite, HTML — see near the
# team-members section below) instead of a separate React route, so
# the link uses BACKEND_BASE_URL, not FRONTEND_BASE_URL. Set this to
# wherever main.py itself is publicly reachable (e.g. https://api.yourdomain.com)
# once deployed — defaults to localhost for local dev.
BACKEND_BASE_URL = (os.environ.get("BACKEND_BASE_URL") or "http://localhost:8000").rstrip("/")
# Still used for the "Go to Login" link shown after a successful accept,
# and by the AcceptInviteResponse.company on the old JSON-only flow.
FRONTEND_BASE_URL = (os.environ.get("FRONTEND_BASE_URL") or "http://localhost:5173").rstrip("/")


# The frontend's fetch() calls uniformly check `resp.success` / `resp.message`
# on every response (see authHeaders()/fetch() usage in Superadmin.jsx). By
# default FastAPI's HTTPException serializes to {"detail": "..."} instead, so
# every `res.ok === false` branch in the frontend silently loses the real
# error text and falls back to a generic "<Action> failed (<status>)" message
# (e.g. "Import failed (400)") even when the backend raised a specific,
# useful HTTPException detail. Normalize all HTTPException responses here so
# the actual reason always reaches the UI.
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "message": exc.detail},
        headers=getattr(exc, "headers", None),
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
    # Business Workspace > Business Info tab — same row as the rest of
    # the company profile now, see the note above CompanyRegistrationCreate.
    business_model: str = ""
    deal_size: str = ""
    sales_cycle: str = ""
    pricing_model: str = ""
    services: list[str] = []
    stages: list[str] = []


class RegistrationResponse(BaseModel):
    success: bool
    data: Optional[CompanyRegistration] = None
    message: Optional[str] = None


class CompaniesListResponse(BaseModel):
    """Used by the SuperAdmin panel's Companies module — every company
    on the platform, not just the logged-in one."""
    success: bool
    data: List[CompanyRegistration] = []
    message: Optional[str] = None


# ═══════════════════════════════════════════════════════════════
# PROSPECT COMPANIES — isfathena.Prospect_Companies table
# Companies WE are pitching GrowthOS AI to (SuperAdmin panel's
# "Prospect Companies" module — not to be confused with the leads a
# customer generates for their own product on the Lead Generation page).
#
#   CREATE TABLE Prospect_Companies (
#     id INT AUTO_INCREMENT PRIMARY KEY,
#     company_name VARCHAR(200) NOT NULL,
#     contact_person VARCHAR(150) DEFAULT '',
#     email VARCHAR(150) DEFAULT '',
#     phone VARCHAR(30) DEFAULT '',
#     website VARCHAR(200) DEFAULT '',
#     industry VARCHAR(100) DEFAULT '',
#     status VARCHAR(30) DEFAULT 'New',
#     notes TEXT,
#     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
#   );
# ═══════════════════════════════════════════════════════════════

class ProspectCompany(BaseModel):
    id: Optional[int] = None
    company_name: str
    contact_person: str = ""
    email: str = ""
    phone: str = ""
    website: str = ""
    industry: str = ""
    city: str = ""
    status: str = "New"
    notes: str = ""
    created_at: Optional[str] = None


class ProspectCompanyCreate(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=200)
    contact_person: str = ""
    email: str = ""
    phone: str = ""
    website: str = ""
    industry: str = ""
    city: str = ""
    status: str = "New"
    notes: str = ""


class ProspectCompaniesResponse(BaseModel):
    success: bool
    data: List[ProspectCompany] = []
    message: Optional[str] = None


class ProspectBulkDeleteRequest(BaseModel):
    ids: List[int]


class ProspectStatusUpdateRequest(BaseModel):
    status: str


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


class Goal(BaseModel):
    """Business Workspace > Business Goals tab. One row per goal a
    company is tracking (e.g. 'Generate 500 Leads', 'Increase Sales' to
    ₹50,00,000) — scoped to that company via company_id, same isolation
    pattern as Product. `status` is always recomputed server-side from
    progress_percent (see compute_goal_status) — whatever the client
    sends is ignored, so the badge can never drift out of sync with the
    progress bar."""
    id: Optional[int] = None
    company_id: Optional[int] = None  # set server-side from the logged-in company, never trusted from the client
    goal_name: str = Field(..., min_length=1, max_length=200)
    target_value: float = Field(0, ge=0)
    target_unit: str = Field("", max_length=30)  # e.g. "Leads", "Clients", "%", "₹"
    progress_percent: float = Field(0, ge=0, le=100)
    status: str = "Not Started"  # recomputed server-side, see compute_goal_status()
    created_at: Optional[str] = None


class GoalsResponse(BaseModel):
    success: bool
    data: list[Goal] = []
    message: Optional[str] = None


class KnowledgeDocument(BaseModel):
    """Business Workspace > AI Knowledge Base tab. One row per uploaded
    file (PDF/DOCX/PPT/TXT) a company has fed to train its AI — scoped
    to that company via company_id, same isolation pattern as Product."""
    id: Optional[int] = None
    company_id: Optional[int] = None  # set server-side from the logged-in company, never trusted from the client
    file_name: str
    file_size: int = 0
    file_url: str = ""
    uploaded_at: Optional[str] = None


class KnowledgeDocumentsResponse(BaseModel):
    success: bool
    data: list[KnowledgeDocument] = []
    message: Optional[str] = None


class TeamMember(BaseModel):
    """Business Workspace > Team & Users tab. One row per teammate a
    company has invited — scoped to that company via company_id, same
    isolation pattern as Product above (a company can only ever see/edit
    its own team, never another company's)."""
    id: Optional[int] = None
    company_id: Optional[int] = None  # set server-side from the logged-in company, never trusted from the client
    name: str = Field(..., min_length=1, max_length=150)
    email: str = Field(..., min_length=3, max_length=150)
    department: str = ""
    role: str = ""
    # "Invited" (server-forced on creation, regardless of what the client
    # sends) until they open their invite link and set a password, at
    # which point /team-invite/{token}/accept flips this to "Active".
    # "Inactive" is still available from the Edit modal to revoke access
    # without deleting the row.
    status: str = "Invited"
    created_at: Optional[str] = None
    # Only populated in the POST /team-members response, right after an
    # invite is created — a fallback the admin can copy/share by hand if
    # the invite email doesn't land (e.g. SMTP misconfigured). Never
    # returned by GET /team-members.
    invite_link: Optional[str] = None


class TeamMembersResponse(BaseModel):
    success: bool
    data: list[TeamMember] = []
    message: Optional[str] = None


class AcceptInviteRequest(BaseModel):
    password: str = Field(..., min_length=8, max_length=128)


class InviteDetailsResponse(BaseModel):
    """What the Accept Invite page reads on load to prefill/greet the
    invitee, before they've set a password or logged in at all."""
    success: bool
    name: Optional[str] = None
    email: Optional[str] = None
    company_name: Optional[str] = None
    message: Optional[str] = None


class AcceptInviteResponse(BaseModel):
    success: bool
    token: Optional[str] = None
    company: Optional[CompanyRegistration] = None
    member: Optional[TeamMember] = None
    message: Optional[str] = None


class BusinessInfo(BaseModel):
    """Business Workspace > Business Info tab. Products Offered is NOT
    part of this — that card reads straight from each company's own
    /products (company_products table) instead of duplicating it here.

    Subscription Plan is ALSO deliberately not part of this — billing
    isn't wired up yet, so there's nothing real to save. Once payments
    exist, the active plan should come from that system (e.g. a
    subscriptions table keyed off the payment provider), not from a
    value the user picks in a dropdown here. The Subscription Plans
    dropdown on the frontend is display-only for now."""
    business_model: str = ""
    deal_size: str = ""
    sales_cycle: str = ""
    pricing_model: str = ""
    services: list[str] = []
    stages: list[str] = []


class BusinessInfoResponse(BaseModel):
    success: bool
    data: Optional[BusinessInfo] = None
    message: Optional[str] = None


class TargetAudience(BaseModel):
    """Business Workspace > Target Audience tab. Defines the company's
    ideal customer profile, used for lead generation/discovery.

    "customer_count" is deliberately the generic name — it's the field
    the reference design calls "Student Count" for an edtech company,
    but the underlying data (a size-of-customer-org range) is the same
    for any vertical, so the frontend picks the label, not the schema."""
    country: str = ""
    state: list[str] = []
    cities: list[str] = []
    industry: str = ""
    company_size: str = ""
    customer_count: str = ""
    decision_makers: list[str] = []
    designations: list[str] = []
    pain_points: list[str] = []
    budget_range: str = ""
    keywords: list[str] = []


class TargetAudienceResponse(BaseModel):
    success: bool
    data: Optional[TargetAudience] = None
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
    # Only set when the person who logged in is a team member (not the
    # company owner) — lets the frontend show "logged in as {member.name}"
    # and know this session belongs to an invited teammate.
    member: Optional[TeamMember] = None
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
#     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
#     -- Business Workspace > Business Info tab (added below the original
#     -- registration columns — one company, one row, no separate table).
#     -- NOTE: no subscription_plan column on purpose — billing isn't
#     -- wired up yet, so there's nothing real to persist. Add that
#     -- column later once payments exist and the active plan should
#     -- come from that system, not a value typed here.
#     business_model VARCHAR(50) DEFAULT '',
#     deal_size VARCHAR(50) DEFAULT '',
#     sales_cycle VARCHAR(20) DEFAULT '',
#     pricing_model VARCHAR(50) DEFAULT '',
#     services TEXT,
#     stages TEXT,
#     -- Business Workspace > Target Audience tab — same row, same
#     -- pattern as Business Info above. "target_customer_count" is the
#     -- generic column name (e.g. "500 - 5000") — label it per-industry
#     -- on the frontend (e.g. "Student Count" for an edtech company)
#     -- rather than baking a vertical-specific name into the schema.
#     target_country VARCHAR(100) DEFAULT '',
#     target_state TEXT, -- JSON list, multi-select (was VARCHAR(100) single value)
#     target_cities TEXT,
#     target_industry VARCHAR(100) DEFAULT '',
#     target_company_size VARCHAR(50) DEFAULT '',
#     target_customer_count VARCHAR(50) DEFAULT '',
#     target_decision_makers TEXT,
#     target_designations TEXT,
#     target_pain_points TEXT,
#     target_budget_range VARCHAR(50) DEFAULT '',
#     target_keywords TEXT
#   );
#
# ⚠️ If company_registrations already exists without these columns,
# run this once instead of recreating the table:
#
#   ALTER TABLE company_registrations
#     ADD COLUMN business_model VARCHAR(50) DEFAULT '',
#     ADD COLUMN deal_size VARCHAR(50) DEFAULT '',
#     ADD COLUMN sales_cycle VARCHAR(20) DEFAULT '',
#     ADD COLUMN pricing_model VARCHAR(50) DEFAULT '',
#     ADD COLUMN services TEXT,
#     ADD COLUMN stages TEXT,
#     ADD COLUMN target_country VARCHAR(100) DEFAULT '',
#     ADD COLUMN target_state TEXT,
#     ADD COLUMN target_cities TEXT,
#     ADD COLUMN target_industry VARCHAR(100) DEFAULT '',
#     ADD COLUMN target_company_size VARCHAR(50) DEFAULT '',
#     ADD COLUMN target_customer_count VARCHAR(50) DEFAULT '',
#     ADD COLUMN target_decision_makers TEXT,
#     ADD COLUMN target_designations TEXT,
#     ADD COLUMN target_pain_points TEXT,
#     ADD COLUMN target_budget_range VARCHAR(50) DEFAULT '',
#     ADD COLUMN target_keywords TEXT;
#
# ⚠️ If you already ran the earlier ALTER for business_model/deal_size/
# sales_cycle/pricing_model/services/stages, just run the target_*
# ADD COLUMN lines above — ALTER TABLE fails on a column that already
# exists, so don't re-run the first six.
#
# ⚠️ MIGRATION: State became multi-select (Target Audience tab now lets a
# company pick more than one state, cascaded from Country). If your DB
# already has target_state as VARCHAR(100) from before this change, convert
# the existing single value into a one-item JSON list and widen the column:
#
#   UPDATE company_registrations
#     SET target_state = JSON_ARRAY(target_state)
#     WHERE target_state IS NOT NULL AND target_state <> '';
#   UPDATE company_registrations
#     SET target_state = '[]'
#     WHERE target_state IS NULL OR target_state = '';
#   ALTER TABLE company_registrations MODIFY target_state TEXT;
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
    # Business Workspace > Business Info tab — same row, no separate table.
    # subscription_plan is intentionally NOT here — see the note above
    # the CREATE TABLE comment; it isn't persisted until billing exists.
    "business_model", "deal_size", "sales_cycle", "pricing_model",
    "services", "stages",
    # Business Workspace > Target Audience tab — same row, same pattern.
    "target_country", "target_state", "target_cities", "target_industry",
    "target_company_size", "target_customer_count", "target_decision_makers",
    "target_designations", "target_pain_points", "target_budget_range",
    "target_keywords",
]

# Business-info fields aren't collected on the registration form, so they're
# excluded from the INSERT column list below — new companies just get the
# column defaults ('' / NULL) until they save something via /business-info.
BUSINESS_INFO_SCALAR_FIELDS = ["business_model", "deal_size", "sales_cycle", "pricing_model"]
BUSINESS_INFO_JSON_FIELDS = ["services", "stages"]
BUSINESS_INFO_FIELDS = BUSINESS_INFO_SCALAR_FIELDS + BUSINESS_INFO_JSON_FIELDS

# Target-audience fields, same story — nothing to collect at registration
# time, so they're excluded from the INSERT column list too and only ever
# get written once a company saves the Target Audience tab.
TARGET_AUDIENCE_SCALAR_FIELDS = [
    "target_country", "target_industry", "target_company_size",
    "target_customer_count", "target_budget_range",
]
TARGET_AUDIENCE_JSON_FIELDS = [
    "target_state", "target_cities", "target_decision_makers", "target_designations",
    "target_pain_points", "target_keywords",
]
TARGET_AUDIENCE_FIELDS = TARGET_AUDIENCE_SCALAR_FIELDS + TARGET_AUDIENCE_JSON_FIELDS


def _row_to_company(row: dict) -> dict:
    """DATE/TIMESTAMP columns come back as date/datetime objects from
    pymysql — stringify them so the Pydantic response model (which
    types these as str) doesn't choke. services/stages and the
    target_* list fields are stored as JSON text and come back to the
    frontend as real lists."""
    if row.get("date_of_incorporation") is not None:
        row["date_of_incorporation"] = str(row["date_of_incorporation"])
    if row.get("created_at") is not None:
        row["created_at"] = str(row["created_at"])
    for f in BUSINESS_INFO_JSON_FIELDS + TARGET_AUDIENCE_JSON_FIELDS:
        if f in row:
            row[f] = json.loads(row[f]) if row.get(f) else []
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


def create_member_jwt_token(company_id: int, email: str, member_id: int, member_name: str, role: str) -> str:
    """Team-member session token. `sub` is still the EMPLOYER's company_id
    (not the member's own id) so every existing endpoint that resolves
    Depends(get_current_company) keeps working completely unmodified —
    a team member's session reads/writes the same company-scoped data
    the owner's does. The extra claims below are informational only
    (e.g. for the frontend to show "Logged in as {member_name}") — no
    endpoint in this file currently restricts what a team member can do
    versus the owner; that's real role-based permissions and would be a
    separate addition on top of this login/invite mechanism.
    """
    payload = {
        "sub": str(company_id),
        "email": email,
        "member_id": member_id,
        "member_name": member_name,
        "role": role,
        "is_team_member": True,
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
            fields = [
                c for c in COMPANY_COLUMNS
                if c not in ("id", "created_at")
                and c not in BUSINESS_INFO_FIELDS
                and c not in TARGET_AUDIENCE_FIELDS
            ]
            all_cols = fields + ["password_hash"]
            placeholders = ", ".join(["%s"] * len(all_cols))
            cols = ", ".join(all_cols)
            values = [getattr(reg, f) for f in fields] + [hash_password(reg.password)]
            cur.execute(f"INSERT INTO {COMPANY_TABLE} ({cols}) VALUES ({placeholders})", values)
            conn.commit()
            return cur.lastrowid
    finally:
        conn.close()


def fetch_all_companies() -> list:
    """Every company on the platform, newest first — used by the
    SuperAdmin panel's Companies module."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cols = ", ".join(COMPANY_COLUMNS)
            cur.execute(f"SELECT {cols} FROM {COMPANY_TABLE} ORDER BY created_at DESC")
            rows = cur.fetchall()
            return [_row_to_company(row) for row in rows]
    finally:
        conn.close()


# ─────────────────────────────────────────────────────────────────
# PROSPECT COMPANIES — table access + bulk import parsing
# ─────────────────────────────────────────────────────────────────

PROSPECT_TABLE = "Prospect_Companies"
PROSPECT_COLUMNS = ["id", "company_name", "contact_person", "email", "phone", "website", "industry", "city", "status", "notes", "created_at"]

# Must match PROSPECT_STATUS_OPTIONS in Superadmin.jsx exactly.
PROSPECT_STATUS_OPTIONS = ["New", "Contacted", "Interested", "Converted", "Not Interested"]


def fetch_prospect_companies() -> list:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cols = ", ".join(PROSPECT_COLUMNS)
            cur.execute(f"SELECT {cols} FROM {PROSPECT_TABLE} ORDER BY created_at DESC")
            rows = cur.fetchall()
            for row in rows:
                if row.get("created_at") is not None:
                    row["created_at"] = str(row["created_at"])
            return rows
    finally:
        conn.close()


def insert_prospect_company(p: ProspectCompanyCreate) -> int:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            fields = ["company_name", "contact_person", "email", "phone", "website", "industry", "city", "status", "notes"]
            placeholders = ", ".join(["%s"] * len(fields))
            cols = ", ".join(fields)
            values = [getattr(p, f) for f in fields]
            cur.execute(f"INSERT INTO {PROSPECT_TABLE} ({cols}) VALUES ({placeholders})", values)
            conn.commit()
            return cur.lastrowid
    finally:
        conn.close()


def bulk_insert_prospect_companies(rows: list) -> int:
    """rows: list of dicts already normalized to company_name/contact_person/
    email/phone/website/industry/notes. Skips rows with no company_name.
    Returns the number of rows actually inserted."""
    usable = [r for r in rows if (r.get("company_name") or "").strip()]
    if not usable:
        return 0
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            fields = ["company_name", "contact_person", "email", "phone", "website", "industry", "city", "status", "notes"]
            placeholders = ", ".join(["%s"] * len(fields))
            cols = ", ".join(fields)
            values = [
                [
                    r.get("company_name", "").strip(),
                    r.get("contact_person", "").strip(),
                    r.get("email", "").strip(),
                    r.get("phone", "").strip(),
                    r.get("website", "").strip(),
                    r.get("industry", "").strip(),
                    r.get("city", "").strip(),
                    "New",
                    r.get("notes", "").strip(),
                ]
                for r in usable
            ]
            cur.executemany(f"INSERT INTO {PROSPECT_TABLE} ({cols}) VALUES ({placeholders})", values)
            conn.commit()
            return cur.rowcount
    finally:
        conn.close()


def delete_prospect_company(prospect_id: int) -> int:
    """Deletes a single prospect company by id. Returns the number of rows
    actually deleted (0 means no row had that id)."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"DELETE FROM {PROSPECT_TABLE} WHERE id = %s", [prospect_id])
            conn.commit()
            return cur.rowcount
    finally:
        conn.close()


def update_prospect_status(prospect_id: int, status: str) -> int:
    """Flips a prospect company's status (e.g. "New" -> "Contacted") after
    a successful Email/SMS/WhatsApp send or a Call attempt from the
    Prospect Companies table's "Contact Now" action. Returns the number of
    rows actually updated."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE {PROSPECT_TABLE} SET status = %s WHERE id = %s", [status, prospect_id])
            conn.commit()
            return cur.rowcount
    finally:
        conn.close()


def update_prospect_company(prospect_id: int, p: ProspectCompanyCreate) -> int:
    """Prospect Companies table's Edit action (pencil icon) — full-row
    update. Returns the number of rows actually updated (0 = no row with
    that id, same convention as the delete helpers)."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            fields = ["company_name", "contact_person", "email", "phone", "website", "industry", "city", "status", "notes"]
            set_clause = ", ".join([f"{f} = %s" for f in fields])
            values = [getattr(p, f) for f in fields] + [prospect_id]
            cur.execute(f"UPDATE {PROSPECT_TABLE} SET {set_clause} WHERE id = %s", values)
            conn.commit()
            return cur.rowcount
    finally:
        conn.close()


def delete_prospect_companies_bulk(ids: list) -> int:
    """Deletes many prospect companies by id in one query. Returns the
    number of rows actually deleted."""
    ids = [i for i in ids if i is not None]
    if not ids:
        return 0
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            placeholders = ", ".join(["%s"] * len(ids))
            cur.execute(f"DELETE FROM {PROSPECT_TABLE} WHERE id IN ({placeholders})", ids)
            conn.commit()
            return cur.rowcount
    finally:
        conn.close()


# Header text -> canonical field name. Import files can use any of these
# (case-insensitive, spaces/underscores interchangeable).
_PROSPECT_HEADER_ALIASES = {
    "company_name": ["company", "companyname", "company name", "organisation", "organization", "business", "business name"],
    "contact_person": ["contact", "contactperson", "contact person", "contact persone", "name", "member name", "ceo name", "founder name", "owner name", "director name", "proprietor name", "poc", "point of contact"],
    "email": ["email", "emailaddress", "email address", "e-mail"],
    "phone": ["phone", "phonenumber", "phone number", "phone no", "contact number", "contact no", "mobile", "mobile number", "mobile no", "cell", "cell number"],
    "website": ["website", "site", "url", "web"],
    "industry": ["industry", "sector", "category"],
    "city": ["city", "location", "place", "town"],
    "notes": ["notes", "remarks", "comment", "comments", "description"],
}


def _canonical_header(raw: str) -> Optional[str]:
    # Normalize away punctuation (colons, asterisks, parens, dashes, etc.)
    # so headers like "Company Name:", "Company Name*", or "Company Name
    # (required)" still match — not just an exact "company name".
    cleaned = re.sub(r"[^a-z0-9\s]", " ", (raw or "").strip().lower())
    key = re.sub(r"\s+", " ", cleaned).strip()
    for canonical, aliases in _PROSPECT_HEADER_ALIASES.items():
        if key in aliases:
            return canonical
    return None


def _best_header_row(rows: list, max_scan: int = 5):
    """Some exported files have a title/blank row above the real header
    row (e.g. row 1 = "Prospect List — Q3", row 2 = actual columns).
    Scan the first few rows and pick whichever one maps the most cells
    to a recognized field, instead of blindly assuming row 0 is it.
    Returns (row_index, header_map, matched_headers, all_seen_headers)."""
    best_idx, best_map, best_score = 0, {}, -1
    all_seen = []
    for idx, row in enumerate(rows[:max_scan]):
        header_map = {i: _canonical_header(str(h) if h is not None else "") for i, h in enumerate(row)}
        seen = [str(h) for h in row if h is not None and str(h).strip()]
        if seen:
            all_seen.append(seen)
        score = sum(1 for v in header_map.values() if v)
        if score > best_score:
            best_idx, best_map, best_score = idx, header_map, score
    matched = sorted(set(v for v in best_map.values() if v))
    return best_idx, best_map, matched, all_seen


def _parse_csv_import(raw_bytes: bytes) -> list:
    import csv
    import io

    text = raw_bytes.decode("utf-8-sig", errors="ignore")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        return []
    header_idx, header_map, matched, all_seen = _best_header_row(rows)
    if not matched:
        _raise_no_headers_error(all_seen)
    out = []
    for raw_row in rows[header_idx + 1:]:
        record = {}
        for i, cell in enumerate(raw_row):
            field = header_map.get(i)
            if field:
                record[field] = cell
        if record:
            out.append(record)
    return out


def _raise_no_headers_error(all_seen: list):
    """Surface what the parser actually saw, instead of a bare
    "no usable rows" — this is the detail that reaches the frontend now
    that HTTPException responses are normalized (see http_exception_handler)."""
    recognized = sorted(set(a for aliases in _PROSPECT_HEADER_ALIASES.values() for a in aliases))
    seen_preview = "; ".join(", ".join(row) for row in all_seen[:3]) or "(file appears empty)"
    raise HTTPException(
        400,
        "Could not find any recognizable columns in that file. "
        f"Rows found: {seen_preview}. "
        f"Expected a header like: Company Name, Contact Person, Email, Phone, Website, Industry, Notes "
        f"(recognized variants: {', '.join(recognized)}).",
    )


def _parse_excel_import(raw_bytes: bytes) -> list:
    try:
        import openpyxl
    except ImportError:
        raise HTTPException(500, "Excel import needs the 'openpyxl' package — run: pip install openpyxl")
    import io

    wb = openpyxl.load_workbook(io.BytesIO(raw_bytes), read_only=True, data_only=True)
    sheet = wb.active
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return []
    header_idx, header_map, matched, all_seen = _best_header_row(rows)
    if not matched:
        _raise_no_headers_error(all_seen)
    out = []
    for raw_row in rows[header_idx + 1:]:
        record = {}
        for i, cell in enumerate(raw_row):
            field = header_map.get(i)
            if field and cell is not None:
                record[field] = str(cell)
        if record:
            out.append(record)
    return out


def _parse_pdf_import(raw_bytes: bytes) -> list:
    """Best-effort: PDFs rarely have clean tabular structure, so this
    tries pdfplumber's table detection first and falls back to treating
    each line as a single company name if no table is found."""
    try:
        import pdfplumber
    except ImportError:
        raise HTTPException(500, "PDF import needs the 'pdfplumber' package — run: pip install pdfplumber")
    import io

    out = []
    with pdfplumber.open(io.BytesIO(raw_bytes)) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            if tables:
                for table in tables:
                    if not table or len(table) < 2:
                        continue
                    header_map = {i: _canonical_header(h or "") for i, h in enumerate(table[0])}
                    if not any(header_map.values()):
                        continue
                    for raw_row in table[1:]:
                        record = {}
                        for i, cell in enumerate(raw_row):
                            field = header_map.get(i)
                            if field and cell:
                                record[field] = cell
                        if record:
                            out.append(record)
            else:
                text = page.extract_text() or ""
                for line in text.splitlines():
                    line = line.strip()
                    if line:
                        out.append({"company_name": line, "notes": "Imported from PDF — please review/complete details"})
    return out


def parse_prospect_import_file(filename: str, raw_bytes: bytes) -> list:
    ext = os.path.splitext(filename or "")[1].lower()
    if ext == ".csv":
        return _parse_csv_import(raw_bytes)
    if ext in (".xlsx", ".xls"):
        return _parse_excel_import(raw_bytes)
    if ext == ".pdf":
        return _parse_pdf_import(raw_bytes)
    raise HTTPException(400, "Unsupported file type — upload a .csv, .xlsx, .xls, or .pdf file")


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
# "subscription_plan" reuses this same shared/global options table so the
# Business Workspace > Business Info > Subscription Plans dropdown lists
# the platform's actual named plans instead of a hardcoded
# "1 Plan / 2 Plans / ..." list. Seed it once with your real plan names:
#   INSERT INTO custom_dropdown_options (field_name, value) VALUES
#     ('subscription_plan', 'Starter'),
#     ('subscription_plan', 'Growth'),
#     ('subscription_plan', 'Pro');
#
# The target_* fields below back the Target Audience tab's "Other" option
# on Country/State/Industry/Company Size/Customer Count. Same table, same
# add-once-reuse-forever behavior: the first company to type a custom
# value there makes it a normal dropdown option for every company after
# that (shared globally, same as industry_sector/company_type).
DROPDOWN_ALLOWED_FIELDS = {
    "industry_sector", "company_type", "subscription_plan",
    "target_country", "target_state", "target_industry",
    "target_company_size", "target_customer_count",
}


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


def soft_delete_product(product_id: int, company_id: int) -> bool:
    """Same company-scoping as update_product — flips is_del = 1 instead
    of actually deleting the row, matching the soft-delete convention
    already used for leads. Returns False if the product doesn't exist
    or isn't this company's."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE {PRODUCTS_TABLE} SET is_del = 1 WHERE is_del = 0 AND company_id = %s AND id = %s",
                [company_id, product_id],
            )
            conn.commit()
            return cur.rowcount > 0
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════
# BUSINESS GOALS — Business Workspace > Business Goals tab, scoped
# per logged-in company (company_business_goals), same isolation
# pattern as PRODUCTS above — a company only ever sees/edits its own
# goals.
#
# Run this once against the DB:
#
#   CREATE TABLE company_business_goals (
#     id INT AUTO_INCREMENT PRIMARY KEY,
#     company_id INT NOT NULL,
#     goal_name VARCHAR(200) NOT NULL,
#     target_value DECIMAL(14,2) DEFAULT 0,
#     target_unit VARCHAR(30) DEFAULT '',
#     progress_percent DECIMAL(5,2) DEFAULT 0,
#     status VARCHAR(20) DEFAULT 'Not Started',
#     is_del TINYINT DEFAULT 0,
#     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
#     INDEX idx_company (company_id)
#   );
# ═══════════════════════════════════════════════════════════════

GOALS_TABLE = "company_business_goals"
GOAL_SELECT_COLUMNS = [
    "id", "company_id", "goal_name", "target_value", "target_unit",
    "progress_percent", "status", "created_at",
]
GOAL_INSERT_FIELDS = ["goal_name", "target_value", "target_unit", "progress_percent", "status"]


def compute_goal_status(progress_percent: float) -> str:
    """Single source of truth for the status badge — always derived from
    progress so it can never disagree with the progress bar. 0% ->
    'Not Started', 100% -> 'Completed', anything in between -> 'In
    Progress'."""
    if progress_percent >= 100:
        return "Completed"
    if progress_percent <= 0:
        return "Not Started"
    return "In Progress"


def fetch_goals(company_id: int) -> list[dict]:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cols = ", ".join(GOAL_SELECT_COLUMNS)
            cur.execute(
                f"SELECT {cols} FROM {GOALS_TABLE} WHERE is_del = 0 AND company_id = %s ORDER BY id DESC",
                [company_id],
            )
            rows = cur.fetchall()
            for r in rows:
                if r.get("created_at") is not None:
                    r["created_at"] = str(r["created_at"])
            return rows
    finally:
        conn.close()


def insert_goal(goal: Goal, company_id: int) -> int:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            status = compute_goal_status(goal.progress_percent)
            all_cols = GOAL_INSERT_FIELDS + ["company_id", "is_del"]
            placeholders = ", ".join(["%s"] * len(all_cols))
            cols = ", ".join(all_cols)
            values = [goal.goal_name, goal.target_value, goal.target_unit, goal.progress_percent, status, company_id, 0]
            cur.execute(f"INSERT INTO {GOALS_TABLE} ({cols}) VALUES ({placeholders})", values)
            conn.commit()
            return cur.lastrowid
    finally:
        conn.close()


def fetch_goal_by_id(goal_id: int, company_id: int) -> Optional[dict]:
    """Scoped the same way fetch_goals() is — a company can only ever
    look up its OWN goal, never another company's, regardless of what
    goal_id the client sends."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cols = ", ".join(GOAL_SELECT_COLUMNS)
            cur.execute(
                f"SELECT {cols} FROM {GOALS_TABLE} WHERE is_del = 0 AND company_id = %s AND id = %s",
                [company_id, goal_id],
            )
            row = cur.fetchone()
            if row and row.get("created_at") is not None:
                row["created_at"] = str(row["created_at"])
            return row
    finally:
        conn.close()


def update_goal(goal_id: int, goal: Goal, company_id: int) -> bool:
    """Scoped the same way fetch_goal_by_id() is — WHERE company_id = %s
    means a company can only ever update its OWN goal, never another
    company's, regardless of what goal_id the client sends."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            status = compute_goal_status(goal.progress_percent)
            set_clause = ", ".join([f"{f} = %s" for f in GOAL_INSERT_FIELDS])
            values = [goal.goal_name, goal.target_value, goal.target_unit, goal.progress_percent, status, company_id, goal_id]
            cur.execute(
                f"UPDATE {GOALS_TABLE} SET {set_clause} WHERE is_del = 0 AND company_id = %s AND id = %s",
                values,
            )
            conn.commit()
            return cur.rowcount > 0
    finally:
        conn.close()


def update_goal_progress(goal_id: int, progress_percent: float, company_id: int) -> bool:
    """Lightweight path for just dragging/typing a new progress value —
    doesn't require resending the whole goal payload. Same company
    scoping as update_goal()."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            status = compute_goal_status(progress_percent)
            cur.execute(
                f"UPDATE {GOALS_TABLE} SET progress_percent = %s, status = %s "
                f"WHERE is_del = 0 AND company_id = %s AND id = %s",
                [progress_percent, status, company_id, goal_id],
            )
            conn.commit()
            return cur.rowcount > 0
    finally:
        conn.close()


def soft_delete_goal(goal_id: int, company_id: int) -> bool:
    """Same company-scoping as update_goal — flips is_del = 1 instead of
    actually deleting the row. Returns False if the goal doesn't exist
    or isn't this company's."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE {GOALS_TABLE} SET is_del = 1 WHERE is_del = 0 AND company_id = %s AND id = %s",
                [company_id, goal_id],
            )
            conn.commit()
            return cur.rowcount > 0
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════
# AI KNOWLEDGE BASE — Business Workspace > AI Knowledge Base tab,
# scoped per logged-in company (company_documents), same
# isolation pattern as PRODUCTS above. Files themselves are saved to
# UPLOAD_DIR/knowledge (served back at /uploads/knowledge/<filename>,
# same static mount as company logos) — only the resulting URL/name/
# size go in the DB row, so swapping local disk for S3/Spaces later
# only touches the two helpers below, not the table shape.
#
#   CREATE TABLE company_documents (
#     id INT AUTO_INCREMENT PRIMARY KEY,
#     company_id INT NOT NULL,
#     file_name VARCHAR(255) NOT NULL,
#     file_size INT DEFAULT 0,
#     file_url VARCHAR(500) DEFAULT '',
#     uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
#     INDEX idx_company (company_id)
#   );
# ═══════════════════════════════════════════════════════════════

KNOWLEDGE_TABLE = "company_documents"
KNOWLEDGE_SELECT_COLUMNS = ["id", "company_id", "file_name", "file_size", "file_url", "uploaded_at"]
KNOWLEDGE_UPLOAD_DIR = os.path.join(UPLOAD_DIR, "knowledge")
os.makedirs(KNOWLEDGE_UPLOAD_DIR, exist_ok=True)
KNOWLEDGE_ALLOWED_EXT = {".pdf", ".doc", ".docx", ".ppt", ".pptx", ".txt"}
KNOWLEDGE_MAX_BYTES = 30 * 1024 * 1024  # 30MB, matches the frontend dropzone copy


def fetch_knowledge_documents(company_id: int) -> list[dict]:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cols = ", ".join(KNOWLEDGE_SELECT_COLUMNS)
            cur.execute(
                f"SELECT {cols} FROM {KNOWLEDGE_TABLE} WHERE company_id = %s ORDER BY id DESC",
                [company_id],
            )
            rows = cur.fetchall()
            for r in rows:
                if r.get("uploaded_at") is not None:
                    r["uploaded_at"] = str(r["uploaded_at"])
            return rows
    finally:
        conn.close()


def insert_knowledge_document(company_id: int, file_name: str, file_size: int, file_url: str) -> int:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO {KNOWLEDGE_TABLE} (company_id, file_name, file_size, file_url) "
                f"VALUES (%s, %s, %s, %s)",
                [company_id, file_name, file_size, file_url],
            )
            conn.commit()
            return cur.lastrowid
    finally:
        conn.close()


def fetch_knowledge_document_by_id(doc_id: int, company_id: int) -> Optional[dict]:
    """Scoped the same way fetch_product_by_id() is — a company can only
    ever look up its OWN document, never another company's."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cols = ", ".join(KNOWLEDGE_SELECT_COLUMNS)
            cur.execute(
                f"SELECT {cols} FROM {KNOWLEDGE_TABLE} WHERE company_id = %s AND id = %s",
                [company_id, doc_id],
            )
            row = cur.fetchone()
            if row and row.get("uploaded_at") is not None:
                row["uploaded_at"] = str(row["uploaded_at"])
            return row
    finally:
        conn.close()


def delete_knowledge_document(doc_id: int, company_id: int) -> bool:
    """Hard delete (no soft-delete flag on this table) — also removes the
    file from disk if it was stored locally under KNOWLEDGE_UPLOAD_DIR.
    Returns False if the document doesn't exist or isn't this company's."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"DELETE FROM {KNOWLEDGE_TABLE} WHERE company_id = %s AND id = %s",
                [company_id, doc_id],
            )
            conn.commit()
            return cur.rowcount > 0
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════
# TEAM & USERS — Business Workspace > Team & Users tab, scoped per
# logged-in company (company_team_members), same isolation pattern as
# PRODUCTS above — a company only ever sees/edits its own teammates.
#
# Real invite-acceptance flow: inviting someone no longer marks them
# Active immediately. POST /team-members creates the row as "Invited"
# with a random token + 7-day expiry, and emails them a link to
# {FRONTEND_BASE_URL}/accept-invite?token=... . Only after they open
# that link and set a password (POST /team-invite/{token}/accept) does
# the row flip to "Active" and become able to log in via /auth/login.
#
# Run this once against the DB (fresh installs — use the ALTER TABLE
# version below instead if company_team_members already exists):
#
#   CREATE TABLE company_team_members (
#     id INT AUTO_INCREMENT PRIMARY KEY,
#     company_id INT NOT NULL,
#     name VARCHAR(150) NOT NULL,
#     email VARCHAR(150) NOT NULL,
#     department VARCHAR(100) DEFAULT '',
#     role VARCHAR(100) DEFAULT '',
#     status VARCHAR(20) DEFAULT 'Invited',
#     password_hash VARCHAR(255) NULL,
#     invite_token VARCHAR(128) NULL,
#     invite_token_expires DATETIME NULL,
#     accepted_at DATETIME NULL,
#     is_del TINYINT DEFAULT 0,
#     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
#     INDEX idx_company (company_id),
#     INDEX idx_invite_token (invite_token)
#   );
#
# If the table already exists from before this invite flow was added,
# run this instead:
#
#   ALTER TABLE company_team_members
#     ADD COLUMN password_hash VARCHAR(255) NULL,
#     ADD COLUMN invite_token VARCHAR(128) NULL,
#     ADD COLUMN invite_token_expires DATETIME NULL,
#     ADD COLUMN accepted_at DATETIME NULL,
#     ADD INDEX idx_invite_token (invite_token);
#   -- any existing rows keep their current status (e.g. "Active") —
#   -- only newly-invited rows going forward start as "Invited".
# ═══════════════════════════════════════════════════════════════

TEAM_MEMBERS_TABLE = "company_team_members"
TEAM_MEMBER_SELECT_COLUMNS = ["id", "company_id", "name", "email", "department", "role", "status", "created_at"]
TEAM_MEMBER_INSERT_FIELDS = ["name", "email", "department", "role", "status"]
INVITE_TOKEN_VALID_DAYS = 7


def fetch_team_members(company_id: int) -> list[dict]:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cols = ", ".join(TEAM_MEMBER_SELECT_COLUMNS)
            cur.execute(
                f"SELECT {cols} FROM {TEAM_MEMBERS_TABLE} WHERE is_del = 0 AND company_id = %s ORDER BY id DESC",
                [company_id],
            )
            rows = cur.fetchall()
            for r in rows:
                if r.get("created_at") is not None:
                    r["created_at"] = str(r["created_at"])
            return rows
    finally:
        conn.close()


def insert_team_member(member: TeamMember, company_id: int) -> tuple[int, str, datetime]:
    """Always creates the row as status='Invited' with a fresh invite
    token, regardless of what member.status was on the incoming request
    — accepting the invite (not this call) is the only way a row becomes
    Active. Returns (new_id, token, expires_at) so the caller can build
    the invite link and email it."""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=INVITE_TOKEN_VALID_DAYS)
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                INSERT INTO {TEAM_MEMBERS_TABLE}
                    (company_id, name, email, department, role, status, invite_token, invite_token_expires, is_del)
                VALUES (%s, %s, %s, %s, %s, 'Invited', %s, %s, 0)
                """,
                [company_id, member.name, member.email, member.department, member.role, token, expires_at],
            )
            conn.commit()
            return cur.lastrowid, token, expires_at
    finally:
        conn.close()


def fetch_team_member_by_id(member_id: int, company_id: int) -> Optional[dict]:
    """Scoped the same way fetch_team_members() is — a company can only
    ever look up its OWN teammate, never another company's, regardless of
    what member_id the client sends."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cols = ", ".join(TEAM_MEMBER_SELECT_COLUMNS)
            cur.execute(
                f"SELECT {cols} FROM {TEAM_MEMBERS_TABLE} WHERE is_del = 0 AND company_id = %s AND id = %s",
                [company_id, member_id],
            )
            row = cur.fetchone()
            if row and row.get("created_at") is not None:
                row["created_at"] = str(row["created_at"])
            return row
    finally:
        conn.close()


def update_team_member(member_id: int, member: TeamMember, company_id: int) -> bool:
    """Scoped the same way fetch_team_member_by_id() is — WHERE company_id
    = %s means a company can only ever update its OWN teammate, never
    another company's, regardless of what member_id the client sends."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            set_clause = ", ".join([f"{f} = %s" for f in TEAM_MEMBER_INSERT_FIELDS])
            values = [getattr(member, f) for f in TEAM_MEMBER_INSERT_FIELDS] + [company_id, member_id]
            cur.execute(
                f"UPDATE {TEAM_MEMBERS_TABLE} SET {set_clause} WHERE is_del = 0 AND company_id = %s AND id = %s",
                values,
            )
            conn.commit()
            return cur.rowcount > 0
    finally:
        conn.close()


def soft_delete_team_member(member_id: int, company_id: int) -> bool:
    """Same company-scoping as update_team_member — flips is_del = 1
    instead of actually deleting the row. Returns False if the teammate
    doesn't exist or isn't this company's."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE {TEAM_MEMBERS_TABLE} SET is_del = 1 WHERE is_del = 0 AND company_id = %s AND id = %s",
                [company_id, member_id],
            )
            conn.commit()
            return cur.rowcount > 0
    finally:
        conn.close()


def fetch_team_member_by_token(token: str) -> Optional[dict]:
    """Public lookup for the Accept Invite page — deliberately NOT scoped
    by company_id since the invitee isn't logged in yet; the random
    token itself (32 bytes of secrets.token_urlsafe) is what makes this
    safe to look up without any other auth."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT id, company_id, name, email, department, role, status,
                       invite_token_expires, accepted_at
                FROM {TEAM_MEMBERS_TABLE}
                WHERE is_del = 0 AND invite_token = %s
                """,
                [token],
            )
            return cur.fetchone()
    finally:
        conn.close()


def accept_team_member_invite(member_id: int, password_hash: str) -> Optional[dict]:
    """Flips an Invited row to Active, sets their password, and clears
    the token so it can't be reused. Caller (the endpoint) is
    responsible for validating expiry/status BEFORE calling this, using
    the same member_id it got back from fetch_team_member_by_token()."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE {TEAM_MEMBERS_TABLE}
                SET password_hash = %s, status = 'Active', accepted_at = %s,
                    invite_token = NULL, invite_token_expires = NULL
                WHERE is_del = 0 AND id = %s
                """,
                [password_hash, datetime.utcnow(), member_id],
            )
            conn.commit()
            if cur.rowcount == 0:
                return None
            cols = ", ".join(TEAM_MEMBER_SELECT_COLUMNS)
            cur.execute(f"SELECT {cols} FROM {TEAM_MEMBERS_TABLE} WHERE id = %s", [member_id])
            row = cur.fetchone()
            if row and row.get("created_at") is not None:
                row["created_at"] = str(row["created_at"])
            return row
    finally:
        conn.close()


def get_team_member_for_login(email: str) -> Optional[dict]:
    """Team-member counterpart to get_company_by_email() — only matches
    rows that have actually accepted their invite (status='Active' AND a
    password has been set). NOTE: matches by email alone across ALL
    companies, so if two different companies happen to invite the exact
    same email address, this returns whichever row comes first — fine
    for now, but worth tightening (e.g. requiring a company slug at
    login) if that scenario becomes real."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT id, company_id, name, email, department, role, status, password_hash
                FROM {TEAM_MEMBERS_TABLE}
                WHERE is_del = 0 AND email = %s AND status = 'Active' AND password_hash IS NOT NULL
                LIMIT 1
                """,
                [email],
            )
            return cur.fetchone()
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════
# BUSINESS INFO — Business Workspace > Business Info tab. Lives on the
# SAME company_registrations row (see the ALTER TABLE note near the
# top of the company-registration section) instead of a separate
# table — there's exactly one business profile per company anyway, so
# this avoids a redundant 1:1 join. Products Offered deliberately has
# no columns here — it's read live from PRODUCTS_TABLE
# (company_products) via fetch_products(), the same as the Home page.
# ═══════════════════════════════════════════════════════════════


def company_to_business_info(company: dict) -> "BusinessInfo":
    return BusinessInfo(
        business_model=company.get("business_model") or "",
        deal_size=company.get("deal_size") or "",
        sales_cycle=company.get("sales_cycle") or "",
        pricing_model=company.get("pricing_model") or "",
        services=company.get("services") or [],
        stages=company.get("stages") or [],
    )


def update_company_business_info(company_id: int, info: "BusinessInfo") -> None:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            set_clause = ", ".join([f"{f} = %s" for f in BUSINESS_INFO_SCALAR_FIELDS] + ["services = %s", "stages = %s"])
            values = [getattr(info, f) for f in BUSINESS_INFO_SCALAR_FIELDS] + [
                json.dumps(info.services),
                json.dumps(info.stages),
                company_id,
            ]
            cur.execute(f"UPDATE {COMPANY_TABLE} SET {set_clause} WHERE id = %s", values)
            conn.commit()
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════
# TARGET AUDIENCE — Business Workspace > Target Audience tab. Same
# company_registrations row as Business Info above, same reasoning:
# one target-customer profile per company, so no separate table.
# ═══════════════════════════════════════════════════════════════


def company_to_target_audience(company: dict) -> "TargetAudience":
    """Country/State/City/Industry fall back to the company's own
    registration data (address_country/address_state/address_city/
    industry_sector) whenever the target_* column is still empty — most
    companies start by targeting customers near themselves, in their own
    industry, so this saves them re-typing what we already have on file.
    Saving the Target Audience tab (even to a different value) always
    writes the target_* column directly, so an explicit choice sticks;
    only the untouched/blank state falls back to the registration data."""
    return TargetAudience(
        country=company.get("target_country") or company.get("address_country") or "",
        state=company.get("target_state") or ([company["address_state"]] if company.get("address_state") else []),
        cities=company.get("target_cities") or ([company["address_city"]] if company.get("address_city") else []),
        industry=company.get("target_industry") or company.get("industry_sector") or "",
        company_size=company.get("target_company_size") or "",
        customer_count=company.get("target_customer_count") or "",
        decision_makers=company.get("target_decision_makers") or [],
        designations=company.get("target_designations") or [],
        pain_points=company.get("target_pain_points") or [],
        budget_range=company.get("target_budget_range") or "",
        keywords=company.get("target_keywords") or [],
    )


def update_company_target_audience(company_id: int, info: "TargetAudience") -> None:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            set_clause = ", ".join([f"{f} = %s" for f in TARGET_AUDIENCE_SCALAR_FIELDS + TARGET_AUDIENCE_JSON_FIELDS])
            values = (
                [getattr(info, f.replace("target_", "")) for f in TARGET_AUDIENCE_SCALAR_FIELDS]
                + [json.dumps(getattr(info, f.replace("target_", ""))) for f in TARGET_AUDIENCE_JSON_FIELDS]
                + [company_id]
            )
            cur.execute(f"UPDATE {COMPANY_TABLE} SET {set_clause} WHERE id = %s", values)
            conn.commit()
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════
# SAVED AI THEMES — Media/Feature Card AI Theme Generator "Save Theme"
# button. Scoped per logged-in company, same pattern as PRODUCTS above:
# one company's saved themes are never visible to, or affected by,
# another company's login. Duplicate saves (same theme content, saved
# twice by the same company) are detected server-side via theme_hash
# and rejected with already_saved=True instead of inserting a copy.
#
# Run this once against the DB:
#
#   CREATE TABLE saved_ai_themes (
#     id INT AUTO_INCREMENT PRIMARY KEY,
#     company_id INT NOT NULL,
#     theme_name VARCHAR(150) DEFAULT '',
#     prompt VARCHAR(500) DEFAULT '',
#     theme_json TEXT NOT NULL,
#     theme_hash CHAR(64) NOT NULL,
#     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
#     UNIQUE KEY uniq_company_theme (company_id, theme_hash)
#   );
#
# The UNIQUE KEY is what actually enforces "no duplicate for this
# company" at the DB level (belt-and-braces alongside the app-level
# check below) — and, because company_id is part of that key, it never
# stops two DIFFERENT companies from independently saving the same-
# looking theme.
# ═══════════════════════════════════════════════════════════════

SAVED_THEMES_TABLE = "saved_ai_themes"


class SaveThemeRequest(BaseModel):
    theme: dict = Field(..., description="ThemeJSON produced by the AI Theme Generator")
    prompt: str = Field(default="", max_length=500)


class SavedTheme(BaseModel):
    id: int
    theme_name: str = ""
    prompt: str = ""
    theme: dict
    created_at: Optional[str] = None


class SavedThemesResponse(BaseModel):
    success: bool
    data: list[SavedTheme] = []
    message: Optional[str] = None


class SaveThemeResponse(BaseModel):
    success: bool
    already_saved: bool = False
    data: Optional[SavedTheme] = None
    message: Optional[str] = None


def _theme_hash(theme: dict) -> str:
    """Deterministic fingerprint of a theme's *content* — independent of
    key order, and ignoring client-only fields (`id`, `prompt`, `savedAt`)
    that aren't really part of the "look" — so the SAME theme submitted
    twice hashes identically regardless of how the frontend built the
    object, while two genuinely different themes never collide."""
    content = {k: v for k, v in theme.items() if k not in ("id", "prompt", "savedAt")}
    normalized = json.dumps(content, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _row_to_saved_theme(row: dict) -> dict:
    return {
        "id": row["id"],
        "theme_name": row.get("theme_name") or "",
        "prompt": row.get("prompt") or "",
        "theme": json.loads(row["theme_json"]),
        "created_at": str(row["created_at"]) if row.get("created_at") is not None else None,
    }


def fetch_saved_themes(company_id: int) -> list[dict]:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT id, theme_name, prompt, theme_json, created_at FROM {SAVED_THEMES_TABLE} "
                f"WHERE company_id = %s ORDER BY id DESC",
                [company_id],
            )
            return [_row_to_saved_theme(r) for r in cur.fetchall()]
    finally:
        conn.close()


def find_saved_theme_by_hash(company_id: int, theme_hash: str) -> Optional[dict]:
    """Scoped to company_id — one company saving a theme never blocks,
    or gets confused with, another company saving the identical-looking
    theme independently."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT id, theme_name, prompt, theme_json, created_at FROM {SAVED_THEMES_TABLE} "
                f"WHERE company_id = %s AND theme_hash = %s LIMIT 1",
                [company_id, theme_hash],
            )
            row = cur.fetchone()
            return _row_to_saved_theme(row) if row else None
    finally:
        conn.close()


def insert_saved_theme(company_id: int, theme: dict, prompt: str, theme_hash: str) -> dict:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO {SAVED_THEMES_TABLE} "
                f"(company_id, theme_name, prompt, theme_json, theme_hash) VALUES (%s, %s, %s, %s, %s)",
                [company_id, theme.get("themeName", ""), prompt, json.dumps(theme), theme_hash],
            )
            conn.commit()
            new_id = cur.lastrowid
            cur.execute(
                f"SELECT id, theme_name, prompt, theme_json, created_at FROM {SAVED_THEMES_TABLE} WHERE id = %s",
                [new_id],
            )
            return _row_to_saved_theme(cur.fetchone())
    finally:
        conn.close()


def delete_saved_theme(theme_id: int, company_id: int) -> bool:
    """Scoped to company_id — a company can never delete another
    company's saved theme, even by guessing an id."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"DELETE FROM {SAVED_THEMES_TABLE} WHERE id = %s AND company_id = %s",
                [theme_id, company_id],
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


@app.get("/admin/companies", response_model=CompaniesListResponse)
async def get_all_companies():
    """SuperAdmin panel's Companies module — every company registered
    on the platform. NOTE: unauthenticated for now, same as the rest of
    this quick admin panel; put this behind real admin auth before
    exposing it outside your own machine."""
    try:
        rows = fetch_all_companies()
        return CompaniesListResponse(success=True, data=[CompanyRegistration(**r) for r in rows])
    except Exception as e:
        logger.error(f"/admin/companies GET error: {e}")
        raise HTTPException(500, "Could not load companies")


@app.get("/admin/lead-companies", response_model=ProspectCompaniesResponse)
async def get_prospect_companies():
    """SuperAdmin panel's Prospect Companies module — companies WE are
    pitching GrowthOS AI to."""
    try:
        rows = fetch_prospect_companies()
        return ProspectCompaniesResponse(success=True, data=[ProspectCompany(**r) for r in rows])
    except Exception as e:
        logger.error(f"/admin/lead-companies GET error: {e}")
        raise HTTPException(500, f"Could not load prospect companies — {e}")


@app.post("/admin/lead-companies", response_model=ProspectCompaniesResponse)
async def create_prospect_company(p: ProspectCompanyCreate):
    try:
        new_id = insert_prospect_company(p)
        return ProspectCompaniesResponse(success=True, data=[ProspectCompany(id=new_id, **p.dict())], message="Prospect company added")
    except Exception as e:
        logger.error(f"/admin/lead-companies POST error: {e}")
        raise HTTPException(500, f"Could not save prospect company — {e}")


@app.post("/admin/lead-companies/import", response_model=ProspectCompaniesResponse)
async def import_prospect_companies(file: UploadFile = File(...)):
    """Add Prospect Company's "Import" button — accepts a .csv, .xlsx,
    .xls, or .pdf file, parses it into rows, and bulk-inserts anything
    with a recognizable company name."""
    raw_bytes = await file.read()
    try:
        parsed_rows = parse_prospect_import_file(file.filename, raw_bytes)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"/admin/lead-companies/import parse error: {e}")
        raise HTTPException(400, "Could not read that file — check the format and try again")

    if not parsed_rows:
        raise HTTPException(400, "No usable rows found in that file")

    try:
        inserted = bulk_insert_prospect_companies(parsed_rows)
        rows = fetch_prospect_companies()
        return ProspectCompaniesResponse(
            success=True,
            data=[ProspectCompany(**r) for r in rows],
            message=f"Imported {inserted} of {len(parsed_rows)} rows",
        )
    except Exception as e:
        logger.error(f"/admin/lead-companies/import insert error: {e}")
        raise HTTPException(500, f"Could not save the imported rows — {e}")


@app.post("/admin/lead-companies/bulk-delete", response_model=ProspectCompaniesResponse)
async def bulk_delete_prospect_companies(body: ProspectBulkDeleteRequest):
    """Prospect Companies table's multi-select "Delete selected" action.
    Also used for single-row deletes from the frontend (a one-item list)."""
    if not body.ids:
        raise HTTPException(400, "No prospect companies selected to delete")
    try:
        deleted = delete_prospect_companies_bulk(body.ids)
        rows = fetch_prospect_companies()
        return ProspectCompaniesResponse(
            success=True,
            data=[ProspectCompany(**r) for r in rows],
            message=f"Deleted {deleted} prospect compan{'y' if deleted == 1 else 'ies'}",
        )
    except Exception as e:
        logger.error(f"/admin/lead-companies/bulk-delete error: {e}")
        raise HTTPException(500, f"Could not delete the selected prospect companies — {e}")


@app.delete("/admin/lead-companies/{prospect_id}", response_model=ProspectCompaniesResponse)
async def delete_single_prospect_company(prospect_id: int):
    """Prospect Companies table's per-row delete button."""
    try:
        deleted = delete_prospect_company(prospect_id)
        if not deleted:
            raise HTTPException(404, "Prospect company not found")
        rows = fetch_prospect_companies()
        return ProspectCompaniesResponse(success=True, data=[ProspectCompany(**r) for r in rows], message="Prospect company deleted")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"/admin/lead-companies/{prospect_id} DELETE error: {e}")
        raise HTTPException(500, f"Could not delete prospect company — {e}")


@app.patch("/admin/lead-companies/{prospect_id}/status", response_model=ProspectCompaniesResponse)
async def update_prospect_company_status(prospect_id: int, body: ProspectStatusUpdateRequest):
    """Prospect Companies table's "Contact Now" action calls this right
    after a successful Email/SMS/WhatsApp send (or a Call attempt), the
    same way Lead Management's mark-contacted flips a lead's status."""
    if body.status not in PROSPECT_STATUS_OPTIONS:
        raise HTTPException(400, f"Status must be one of: {', '.join(PROSPECT_STATUS_OPTIONS)}")
    try:
        updated = update_prospect_status(prospect_id, body.status)
        if not updated:
            raise HTTPException(404, "Prospect company not found")
        rows = fetch_prospect_companies()
        return ProspectCompaniesResponse(success=True, data=[ProspectCompany(**r) for r in rows], message=f"Marked as {body.status}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"/admin/lead-companies/{prospect_id}/status PATCH error: {e}")
        raise HTTPException(500, f"Could not update status — {e}")


@app.put("/admin/lead-companies/{prospect_id}", response_model=ProspectCompaniesResponse)
async def edit_prospect_company(prospect_id: int, body: ProspectCompanyCreate):
    """Prospect Companies table's Edit action (pencil icon in Actions
    column) — full-row update from the edit modal."""
    try:
        updated = update_prospect_company(prospect_id, body)
        if not updated:
            raise HTTPException(404, "Prospect company not found")
        rows = fetch_prospect_companies()
        return ProspectCompaniesResponse(success=True, data=[ProspectCompany(**r) for r in rows], message="Prospect company updated")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"/admin/lead-companies/{prospect_id} PUT error: {e}")
        raise HTTPException(500, f"Could not update prospect company — {e}")


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


@app.get("/admin/companies/{company_id}/products", response_model=ProductsResponse)
async def get_company_products(company_id: int):
    """SuperAdmin panel's Customer 360 "Active Products" card — the real
    isfathena.company_products rows for ONE specific company, looked up by
    id instead of by the caller's own JWT (which is what /products uses).
    Reuses fetch_products() as-is since it already scopes by company_id;
    this just lets an admin pass someone else's id in.

    SECURITY: same as every other /admin/* route in this file — no auth
    guard yet. Put this behind real superadmin auth (Depends(require_superadmin))
    before this is reachable from outside your own machine.
    """
    company = get_company_by_id(company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    try:
        rows = fetch_products(company_id)
        return ProductsResponse(success=True, data=rows)
    except Exception as e:
        logger.error(f"/admin/companies/{company_id}/products GET error: {e}")
        raise HTTPException(500, "Could not load products for this company")


@app.post("/admin/companies/{company_id}/impersonate", response_model=LoginResponse)
async def impersonate_company(company_id: int):
    """SuperAdmin panel's "open this company's Home page" action. Mints the
    exact same kind of JWT /auth/login issues, so Home.jsx and everything
    downstream of it (auth/me, /products, etc.) work completely unmodified —
    the frontend just stores this token as if the company had logged in.

    SECURITY: this endpoint currently has NO auth guard of its own, matching
    every other /admin/* route in this file. That means anyone who can reach
    this API can obtain a live session for ANY company with no credentials.
    Before shipping this to production, put real superadmin authentication in
    front of the whole /admin/* prefix (this route included) — e.g. a
    Depends(require_superadmin) dependency checked against an admin session,
    not just the absence of an error here.
    """
    company = get_company_by_id(company_id)
    if not company:
        raise HTTPException(404, "Company not found")

    token = create_jwt_token(company["id"], company["email"])
    company_copy = dict(company)
    company_copy.pop("password_hash", None)
    return LoginResponse(success=True, token=token, company=CompanyRegistration(**company_copy))


@app.post("/auth/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    company = get_company_by_email(req.email)
    if company and verify_password(req.password, company["password_hash"]):
        token = create_jwt_token(company["id"], company["email"])
        company.pop("password_hash", None)
        return LoginResponse(success=True, token=token, company=CompanyRegistration(**company))

    # Not a company-owner account (or wrong password for one) — check
    # whether this is an invited teammate who has already accepted their
    # invite and set a password.
    member = get_team_member_for_login(req.email)
    if member and verify_password(req.password, member["password_hash"] or ""):
        employer = get_company_by_id(member["company_id"])
        if not employer:
            raise HTTPException(401, "Invalid email or password")
        token = create_member_jwt_token(
            company_id=employer["id"],
            email=member["email"],
            member_id=member["id"],
            member_name=member["name"],
            role=member["role"],
        )
        employer.pop("password_hash", None)
        member_copy = dict(member)
        member_copy.pop("password_hash", None)
        return LoginResponse(
            success=True,
            token=token,
            company=CompanyRegistration(**employer),
            member=TeamMember(**member_copy),
        )

    # Deliberately identical message for every failure case above — don't
    # let the response reveal which emails are registered either way.
    raise HTTPException(401, "Invalid email or password")


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


@app.delete("/products/{product_id}", response_model=ProductsResponse)
async def delete_product(product_id: int, company: dict = Depends(get_current_company)):
    existing = fetch_product_by_id(product_id, company["id"])
    if not existing:
        raise HTTPException(404, "Product not found")
    try:
        soft_delete_product(product_id, company["id"])
        return ProductsResponse(success=True, data=[], message=f"Product #{product_id} deleted")
    except Exception as e:
        logger.error(f"/products/{product_id} DELETE error: {e}")
        raise HTTPException(500, "Could not delete product")


@app.get("/business-goals", response_model=GoalsResponse)
async def get_goals(company: dict = Depends(get_current_company)):
    try:
        rows = fetch_goals(company["id"])
        return GoalsResponse(success=True, data=rows)
    except Exception as e:
        logger.error(f"/business-goals GET error: {e}")
        raise HTTPException(500, "Could not load business goals")


@app.post("/business-goals", response_model=GoalsResponse)
async def create_goal(goal: Goal, company: dict = Depends(get_current_company)):
    try:
        new_id = insert_goal(goal, company["id"])
        created = fetch_goal_by_id(new_id, company["id"])
        return GoalsResponse(success=True, data=[created], message=f"Goal #{new_id} created")
    except Exception as e:
        logger.error(f"/business-goals POST error: {e}")
        raise HTTPException(500, "Could not save goal")


@app.patch("/business-goals/{goal_id}", response_model=GoalsResponse)
async def edit_goal(goal_id: int, goal: Goal, company: dict = Depends(get_current_company)):
    existing = fetch_goal_by_id(goal_id, company["id"])
    if not existing:
        raise HTTPException(404, "Goal not found")
    try:
        update_goal(goal_id, goal, company["id"])
        updated = fetch_goal_by_id(goal_id, company["id"])
        return GoalsResponse(success=True, data=[updated], message=f"Goal #{goal_id} updated")
    except Exception as e:
        logger.error(f"/business-goals/{goal_id} PATCH error: {e}")
        raise HTTPException(500, "Could not update goal")


@app.patch("/business-goals/{goal_id}/progress", response_model=GoalsResponse)
async def edit_goal_progress(goal_id: int, payload: dict, company: dict = Depends(get_current_company)):
    existing = fetch_goal_by_id(goal_id, company["id"])
    if not existing:
        raise HTTPException(404, "Goal not found")
    progress = payload.get("progress_percent")
    if progress is None or not (0 <= float(progress) <= 100):
        raise HTTPException(422, "progress_percent must be a number between 0 and 100")
    try:
        update_goal_progress(goal_id, float(progress), company["id"])
        updated = fetch_goal_by_id(goal_id, company["id"])
        return GoalsResponse(success=True, data=[updated], message=f"Goal #{goal_id} progress updated")
    except Exception as e:
        logger.error(f"/business-goals/{goal_id}/progress PATCH error: {e}")
        raise HTTPException(500, "Could not update goal progress")


@app.delete("/business-goals/{goal_id}", response_model=GoalsResponse)
async def delete_goal(goal_id: int, company: dict = Depends(get_current_company)):
    existing = fetch_goal_by_id(goal_id, company["id"])
    if not existing:
        raise HTTPException(404, "Goal not found")
    try:
        soft_delete_goal(goal_id, company["id"])
        return GoalsResponse(success=True, data=[], message=f"Goal #{goal_id} deleted")
    except Exception as e:
        logger.error(f"/business-goals/{goal_id} DELETE error: {e}")
        raise HTTPException(500, "Could not delete goal")


@app.get("/knowledge-documents", response_model=KnowledgeDocumentsResponse)
async def get_knowledge_documents(company: dict = Depends(get_current_company)):
    try:
        rows = fetch_knowledge_documents(company["id"])
        return KnowledgeDocumentsResponse(success=True, data=rows)
    except Exception as e:
        logger.error(f"/knowledge-documents GET error: {e}")
        raise HTTPException(500, "Could not load knowledge documents")


@app.post("/knowledge-documents", response_model=KnowledgeDocumentsResponse)
async def upload_knowledge_document(
    file: UploadFile = File(...), company: dict = Depends(get_current_company)
):
    """AI Knowledge Base tab's dropzone/Upload Files button — multipart
    upload, one file per request (the frontend loops for multi-file
    drops). Saves the file to disk under KNOWLEDGE_UPLOAD_DIR then
    records it in the DB, same two-step pattern as upload_company_logo."""
    orig_name = file.filename or "untitled"
    ext = os.path.splitext(orig_name)[1].lower()
    if ext not in KNOWLEDGE_ALLOWED_EXT:
        raise HTTPException(400, "Only PDF, DOC(X), PPT(X), or TXT files are supported")

    contents = await file.read()
    size = len(contents)
    if size > KNOWLEDGE_MAX_BYTES:
        raise HTTPException(400, f"\"{orig_name}\" is larger than 30MB")
    if size == 0:
        raise HTTPException(400, f"\"{orig_name}\" is empty")

    stored_name = f"{uuid.uuid4().hex}{ext}"
    dest_path = os.path.join(KNOWLEDGE_UPLOAD_DIR, stored_name)
    try:
        with open(dest_path, "wb") as out:
            out.write(contents)
    finally:
        await file.close()

    try:
        file_url = f"/uploads/knowledge/{stored_name}"
        new_id = insert_knowledge_document(company["id"], orig_name, size, file_url)
        created = fetch_knowledge_document_by_id(new_id, company["id"])
        return KnowledgeDocumentsResponse(success=True, data=[created], message=f"\"{orig_name}\" uploaded")
    except Exception as e:
        logger.error(f"/knowledge-documents POST error: {e}")
        # DB insert failed after the file was already written to disk —
        # clean it up so it doesn't sit there orphaned with no DB row.
        if os.path.exists(dest_path):
            os.remove(dest_path)
        raise HTTPException(500, "Could not save the uploaded file")


@app.delete("/knowledge-documents/{document_id}", response_model=KnowledgeDocumentsResponse)
async def remove_knowledge_document(document_id: int, company: dict = Depends(get_current_company)):
    existing = fetch_knowledge_document_by_id(document_id, company["id"])
    if not existing:
        raise HTTPException(404, "Document not found")
    try:
        delete_knowledge_document(document_id, company["id"])
        # Best-effort cleanup — a missing/foreign file_url shouldn't fail the request.
        file_url = existing.get("file_url") or ""
        if file_url.startswith("/uploads/knowledge/"):
            local_path = os.path.join(UPLOAD_DIR, "knowledge", os.path.basename(file_url))
            if os.path.exists(local_path):
                os.remove(local_path)
        return KnowledgeDocumentsResponse(success=True, data=[], message=f"Document #{document_id} deleted")
    except Exception as e:
        logger.error(f"/knowledge-documents/{document_id} DELETE error: {e}")
        raise HTTPException(500, "Could not delete document")


@app.get("/team-members", response_model=TeamMembersResponse)
async def get_team_members(company: dict = Depends(get_current_company)):
    try:
        rows = fetch_team_members(company["id"])
        return TeamMembersResponse(success=True, data=rows)
    except Exception as e:
        logger.error(f"/team-members GET error: {e}")
        raise HTTPException(500, "Could not load team members")


@app.post("/team-members", response_model=TeamMembersResponse)
async def invite_team_member(member: TeamMember, company: dict = Depends(get_current_company)):
    try:
        new_id, token, _expires = insert_team_member(member, company["id"])
    except Exception as e:
        logger.error(f"/team-members POST error: {e}")
        raise HTTPException(500, "Could not save team member")

    invite_link = f"{BACKEND_BASE_URL}/accept-invite?token={token}"
    company_name = company.get("company_name") or "your company"

    # Best-effort invite email — a failed send shouldn't undo the invite
    # itself (the row above is already saved); the invite_link is also
    # returned in the response below so the admin can copy/share it by
    # hand if delivery fails (e.g. SMTP misconfigured).
    email_sent = True
    try:
        send_smtp_email(
            to_email=member.email,
            to_name=member.name,
            subject=f"You've been invited to join {company_name} on GrowthOS",
            message=(
                f"Hi {member.name},\n\n"
                f"You've been invited to join {company_name}'s GrowthOS workspace as "
                f"{member.role or 'a team member'}{(' in ' + member.department) if member.department else ''}.\n\n"
                f"Set your password to accept the invite and log in:\n{invite_link}\n\n"
                f"This link expires in {INVITE_TOKEN_VALID_DAYS} days.\n\n"
                f"— GrowthOS AI Team"
            ),
        )
    except Exception as e:
        email_sent = False
        logger.warning(f"Invite email to {member.email} failed (member still saved): {e}")

    created = TeamMember(
        id=new_id,
        company_id=company["id"],
        name=member.name,
        email=member.email,
        department=member.department,
        role=member.role,
        status="Invited",
        invite_link=invite_link,
    )
    message = (
        f"Team member #{new_id} invited — invite email sent"
        if email_sent
        else f"Team member #{new_id} invited — invite email failed to send, share the link below manually"
    )
    return TeamMembersResponse(success=True, data=[created], message=message)


@app.post("/team-members/{member_id}/resend-invite", response_model=TeamMembersResponse)
async def resend_team_member_invite(member_id: int, company: dict = Depends(get_current_company)):
    """For an invite that expired or never arrived — only works while the
    member is still in "Invited" status; an already-Active teammate has
    nothing to resend."""
    existing = fetch_team_member_by_id(member_id, company["id"])
    if not existing:
        raise HTTPException(404, "Team member not found")
    if existing["status"] != "Invited":
        raise HTTPException(400, "This teammate has already accepted their invite")

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=INVITE_TOKEN_VALID_DAYS)
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE {TEAM_MEMBERS_TABLE} SET invite_token = %s, invite_token_expires = %s "
                f"WHERE is_del = 0 AND company_id = %s AND id = %s",
                [token, expires_at, company["id"], member_id],
            )
            conn.commit()
    finally:
        conn.close()

    invite_link = f"{BACKEND_BASE_URL}/accept-invite?token={token}"
    company_name = company.get("company_name") or "your company"
    email_sent = True
    try:
        send_smtp_email(
            to_email=existing["email"],
            to_name=existing["name"],
            subject=f"Reminder: your invite to {company_name} on GrowthOS",
            message=(
                f"Hi {existing['name']},\n\n"
                f"Here's a fresh link to set your password and join {company_name}'s GrowthOS workspace:\n"
                f"{invite_link}\n\n"
                f"This link expires in {INVITE_TOKEN_VALID_DAYS} days.\n\n"
                f"— GrowthOS AI Team"
            ),
        )
    except Exception as e:
        email_sent = False
        logger.warning(f"Resend invite email to {existing['email']} failed: {e}")

    updated = TeamMember(**{**existing, "invite_link": invite_link})
    message = "Invite resent — email sent" if email_sent else "Invite resent — email failed to send, share the link below manually"
    return TeamMembersResponse(success=True, data=[updated], message=message)


@app.patch("/team-members/{member_id}", response_model=TeamMembersResponse)
async def edit_team_member(member_id: int, member: TeamMember, company: dict = Depends(get_current_company)):
    existing = fetch_team_member_by_id(member_id, company["id"])
    if not existing:
        raise HTTPException(404, "Team member not found")
    try:
        update_team_member(member_id, member, company["id"])
        updated = fetch_team_member_by_id(member_id, company["id"])
        return TeamMembersResponse(success=True, data=[updated], message=f"Team member #{member_id} updated")
    except Exception as e:
        logger.error(f"/team-members/{member_id} PATCH error: {e}")
        raise HTTPException(500, "Could not update team member")


@app.delete("/team-members/{member_id}", response_model=TeamMembersResponse)
async def remove_team_member(member_id: int, company: dict = Depends(get_current_company)):
    existing = fetch_team_member_by_id(member_id, company["id"])
    if not existing:
        raise HTTPException(404, "Team member not found")
    try:
        soft_delete_team_member(member_id, company["id"])
        return TeamMembersResponse(success=True, data=[], message=f"Team member #{member_id} removed")
    except Exception as e:
        logger.error(f"/team-members/{member_id} DELETE error: {e}")
        raise HTTPException(500, "Could not remove team member")


# ═══════════════════════════════════════════════════════════════
# ACCEPT INVITE — self-contained HTML page served directly by THIS
# backend (no separate React route/deploy needed). Replaces
# AcceptInvite.jsx + the "/accept-invite" route in App.jsx — those can
# be deleted from the frontend once this is live, though leaving them
# in place is harmless (the invite email now links to BACKEND_BASE_URL
# instead, so nothing routes to the old frontend page anymore).
#
# The page itself is plain HTML/CSS/vanilla JS (no build step) that
# calls the SAME two JSON endpoints below via relative fetch() —
# GET /team-invite/{token} and POST /team-invite/{token}/accept —
# since it's served by this backend, those calls are always same-origin
# regardless of where the React app itself is hosted.
#
# After a successful accept this backend already has a valid JWT for
# the new teammate, but localStorage is scoped per-origin — if the
# React app lives on a different domain than this API, JS here can't
# reliably hand it that token. Rather than assume same-origin, the
# page just shows a success screen with a "Go to Login" link to
# {FRONTEND_BASE_URL}/login — the account is already Active with a
# password set at that point, so a normal login works immediately.
# ═══════════════════════════════════════════════════════════════

ACCEPT_INVITE_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Accept Invite — GrowthOS AI</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; background: #000; color: #d1d5db;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex; align-items: center; justify-content: center; padding: 16px;
  }
  .wrap { width: 100%; max-width: 420px; }
  .brand { text-align: center; margin-bottom: 24px; }
  .brand h1 { font-size: 26px; font-weight: 800; color: #fff; margin: 0; line-height: 1; }
  .brand h1 span { color: #f97316; }
  .brand p { font-size: 12px; color: #6b7280; margin: 6px 0 0; letter-spacing: 0.02em; }
  .card {
    background: #0d0d0d; border: 1px solid rgba(249,115,22,0.2);
    border-radius: 14px; padding: 24px;
  }
  .center { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; padding: 24px 0; }
  .spinner {
    width: 22px; height: 22px; border: 2px solid rgba(249,115,22,0.25);
    border-top-color: #f97316; border-radius: 50%; animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .muted { font-size: 13px; color: #6b7280; margin: 0; }
  .title { color: #fff; font-weight: 600; margin: 0; }
  .link { color: #fb923c; font-size: 13px; text-decoration: underline; }
  .row { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
  .avatar {
    width: 40px; height: 40px; border-radius: 10px; background: rgba(249,115,22,0.15);
    color: #f97316; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 700;
  }
  .row p.name { color: #fff; font-weight: 600; margin: 0; line-height: 1; }
  .row p.sub { font-size: 12px; color: #6b7280; margin: 6px 0 0; }
  .row p.sub b { color: #d1d5db; font-weight: 400; }
  label { font-size: 12px; color: #6b7280; display: block; margin-bottom: 5px; }
  .field { margin-bottom: 12px; position: relative; }
  input[type="password"], input[type="text"] {
    width: 100%; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px; padding: 10px 40px 10px 12px; font-size: 14px; color: #e5e7eb; outline: none;
  }
  input:focus { border-color: rgba(249,115,22,0.4); }
  .toggle-eye {
    position: absolute; right: 10px; top: 30px; background: none; border: none;
    color: #6b7280; font-size: 11px; cursor: pointer; padding: 4px;
  }
  .toggle-eye:hover { color: #d1d5db; }
  .error { font-size: 12px; color: #f87171; margin: 6px 0 0; }
  .submit {
    width: 100%; background: #f97316; border: none; color: #fff; font-weight: 600;
    font-size: 14px; padding: 11px; border-radius: 8px; cursor: pointer; margin-top: 6px; transition: background 0.15s;
  }
  .submit:hover:not(:disabled) { background: #ea580c; }
  .submit:disabled { opacity: 0.5; cursor: not-allowed; }
  .icon-ok { color: #22c55e; }
  .icon-bad { color: #f87171; }
</style>
</head>
<body>
<div class="wrap">
  <div class="brand">
    <h1>GrowthOS <span>AI</span></h1>
    <p>Autonomous Revenue Platform</p>
  </div>
  <div class="card" id="card">
    <div class="center">
      <div class="spinner"></div>
      <p class="muted">Checking your invite…</p>
    </div>
  </div>
</div>

<script>
(function () {
  var params = new URLSearchParams(window.location.search);
  var token = params.get("token");
  var card = document.getElementById("card");
  var FRONTEND_LOGIN_URL = "__FRONTEND_LOGIN_URL__";

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : s;
    return d.innerHTML;
  }

  function renderInvalid(message) {
    card.innerHTML =
      '<div class="center">' +
      '<div class="icon-bad" style="font-size:28px;">&#10060;</div>' +
      '<p class="title">This invite can\\'t be used</p>' +
      '<p class="muted">' + escapeHtml(message) + '</p>' +
      '<a class="link" href="' + FRONTEND_LOGIN_URL + '">Go to login</a>' +
      '</div>';
  }

  function renderAccepted() {
    card.innerHTML =
      '<div class="center">' +
      '<div class="icon-ok" style="font-size:28px;">&#9989;</div>' +
      '<p class="title">You\\'re all set!</p>' +
      '<p class="muted">Your password is saved — you can log in now.</p>' +
      '<a class="link" href="' + FRONTEND_LOGIN_URL + '">Go to login</a>' +
      '</div>';
  }

  function renderForm(invite) {
    card.innerHTML =
      '<div class="row">' +
      '<div class="avatar">' + escapeHtml((invite.name || "?").charAt(0).toUpperCase()) + '</div>' +
      '<div>' +
      '<p class="name">Hi ' + escapeHtml(invite.name) + '</p>' +
      '<p class="sub">You\\'ve been invited to join <b>' + escapeHtml(invite.company_name || "your team") + '</b> on GrowthOS AI as <b>' + escapeHtml(invite.email) + '</b></p>' +
      '</div>' +
      '</div>' +
      '<form id="form">' +
      '<div class="field">' +
      '<label>Set a password</label>' +
      '<input type="password" id="password" placeholder="At least 8 characters" autocomplete="new-password" />' +
      '<button type="button" class="toggle-eye" data-for="password">Show</button>' +
      '</div>' +
      '<div class="field">' +
      '<label>Confirm password</label>' +
      '<input type="password" id="confirm" placeholder="Re-enter your password" autocomplete="new-password" />' +
      '<button type="button" class="toggle-eye" data-for="confirm">Show</button>' +
      '</div>' +
      '<p class="error" id="err" style="display:none;"></p>' +
      '<button type="submit" class="submit" id="submitBtn">Accept Invite & Log In</button>' +
      '</form>';

    var pw = document.getElementById("password");
    var cf = document.getElementById("confirm");
    var err = document.getElementById("err");
    var btn = document.getElementById("submitBtn");

    document.querySelectorAll(".toggle-eye").forEach(function (b) {
      b.addEventListener("click", function () {
        var input = document.getElementById(b.getAttribute("data-for"));
        var showing = input.type === "text";
        input.type = showing ? "password" : "text";
        b.textContent = showing ? "Show" : "Hide";
      });
    });

    document.getElementById("form").addEventListener("submit", function (e) {
      e.preventDefault();
      err.style.display = "none";
      if (pw.value.length < 8) {
        err.textContent = "Password must be at least 8 characters";
        err.style.display = "block";
        return;
      }
      if (pw.value !== cf.value) {
        err.textContent = "Passwords don't match";
        err.style.display = "block";
        return;
      }
      btn.disabled = true;
      btn.textContent = "Setting up your account…";
      fetch("/team-invite/" + encodeURIComponent(token) + "/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw.value }),
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok || !res.j.success) {
            throw new Error(res.j.message || res.j.detail || "Could not accept this invite");
          }
          renderAccepted();
        })
        .catch(function (e2) {
          err.textContent = e2.message || "Could not accept this invite";
          err.style.display = "block";
          btn.disabled = false;
          btn.textContent = "Accept Invite & Log In";
        });
    });
  }

  if (!token) {
    renderInvalid("This invite link is missing its token.");
    return;
  }

  fetch("/team-invite/" + encodeURIComponent(token))
    .then(function (r) { return r.json(); })
    .then(function (json) {
      if (json.success) {
        renderForm(json);
      } else {
        renderInvalid(json.message || "This invite link is invalid.");
      }
    })
    .catch(function () {
      renderInvalid("Could not reach the server. Please try again.");
    });
})();
</script>
</body>
</html>"""


@app.get("/accept-invite", response_class=HTMLResponse)
async def accept_invite_page(token: str = None):
    """Serves the page itself — all the actual invite validation/accept
    logic still goes through the JSON endpoints below via the page's own
    fetch() calls, this route just returns the HTML shell. `token` isn't
    used server-side here (the page's JS reads it straight from
    window.location.search) — it's only declared so it shows up in
    /docs and so a missing token doesn't 422 the request."""
    html = ACCEPT_INVITE_HTML.replace("__FRONTEND_LOGIN_URL__", f"{FRONTEND_BASE_URL}/login")
    return HTMLResponse(content=html)


@app.get("/team-invite/{token}", response_model=InviteDetailsResponse)
async def get_invite_details(token: str):
    """Public — no login exists yet for the person opening this link.
    The Accept Invite page calls this on load to greet them by name and
    show which company invited them, before asking for a password."""
    member = fetch_team_member_by_token(token)
    if not member:
        return InviteDetailsResponse(success=False, message="This invite link is invalid.")
    if member["status"] != "Invited" or member.get("accepted_at"):
        return InviteDetailsResponse(success=False, message="This invite has already been accepted — please log in instead.")
    if member["invite_token_expires"] and member["invite_token_expires"] < datetime.utcnow():
        return InviteDetailsResponse(success=False, message="This invite link has expired. Ask your admin to resend it.")

    company = get_company_by_id(member["company_id"])
    return InviteDetailsResponse(
        success=True,
        name=member["name"],
        email=member["email"],
        company_name=(company or {}).get("company_name"),
    )


@app.post("/team-invite/{token}/accept", response_model=AcceptInviteResponse)
async def accept_invite(token: str, req: AcceptInviteRequest):
    """Public — sets the invitee's password and activates their account,
    then logs them straight in (same JWT shape /auth/login issues, via
    create_member_jwt_token) so the frontend can redirect them right into
    the dashboard without a separate login step."""
    member = fetch_team_member_by_token(token)
    if not member:
        raise HTTPException(404, "This invite link is invalid.")
    if member["status"] != "Invited" or member.get("accepted_at"):
        raise HTTPException(400, "This invite has already been accepted — please log in instead.")
    if member["invite_token_expires"] and member["invite_token_expires"] < datetime.utcnow():
        raise HTTPException(410, "This invite link has expired. Ask your admin to resend it.")

    updated = accept_team_member_invite(member["id"], hash_password(req.password))
    if not updated:
        raise HTTPException(500, "Could not accept invite")

    company = get_company_by_id(member["company_id"])
    if not company:
        raise HTTPException(404, "Company not found for this invite")

    jwt_token = create_member_jwt_token(
        company_id=company["id"],
        email=updated["email"],
        member_id=updated["id"],
        member_name=updated["name"],
        role=updated["role"],
    )
    company_copy = dict(company)
    company_copy.pop("password_hash", None)
    return AcceptInviteResponse(
        success=True,
        token=jwt_token,
        company=CompanyRegistration(**company_copy),
        member=TeamMember(**updated),
        message="Welcome! Your account is set up.",
    )


@app.get("/business-info", response_model=BusinessInfoResponse)
async def get_business_info(company: dict = Depends(get_current_company)):
    """Reads straight off the already-fetched company row (get_current_company
    already pulled it via get_company_by_id) — no extra query needed."""
    return BusinessInfoResponse(success=True, data=company_to_business_info(company))


@app.put("/business-info", response_model=BusinessInfoResponse)
async def save_business_info(info: BusinessInfo, company: dict = Depends(get_current_company)):
    try:
        update_company_business_info(company["id"], info)
        return BusinessInfoResponse(success=True, data=info, message="Business info saved")
    except Exception as e:
        logger.error(f"/business-info PUT error: {e}")
        raise HTTPException(500, "Could not save business info")


@app.get("/target-audience", response_model=TargetAudienceResponse)
async def get_target_audience(company: dict = Depends(get_current_company)):
    """Reads straight off the already-fetched company row, same as
    /business-info — no extra query needed."""
    return TargetAudienceResponse(success=True, data=company_to_target_audience(company))


@app.put("/target-audience", response_model=TargetAudienceResponse)
async def save_target_audience(info: TargetAudience, company: dict = Depends(get_current_company)):
    try:
        update_company_target_audience(company["id"], info)
        return TargetAudienceResponse(success=True, data=info, message="Target audience saved")
    except Exception as e:
        logger.error(f"/target-audience PUT error: {e}")
        raise HTTPException(500, "Could not save target audience")


@app.get("/saved-themes", response_model=SavedThemesResponse)
async def list_saved_themes(company: dict = Depends(get_current_company)):
    """Only ever returns THIS company's saved themes — scoped by the
    company_id resolved from the JWT, the same way /products is."""
    try:
        rows = fetch_saved_themes(company["id"])
        return SavedThemesResponse(success=True, data=rows)
    except Exception as e:
        logger.error(f"/saved-themes GET error: {e}")
        raise HTTPException(500, "Could not load saved themes")


@app.post("/saved-themes", response_model=SaveThemeResponse)
async def save_theme(req: SaveThemeRequest, company: dict = Depends(get_current_company)):
    """Saves an AI-generated theme for the logged-in company only. If
    this exact theme (by content, not by prompt wording) is already
    saved for this company, nothing new is inserted — the response just
    reports already_saved=True with message="Already saved", so the
    frontend shows that instead of a silent duplicate row."""
    theme_hash = _theme_hash(req.theme)
    try:
        existing = find_saved_theme_by_hash(company["id"], theme_hash)
        if existing:
            return SaveThemeResponse(
                success=True, already_saved=True, data=SavedTheme(**existing), message="Already saved"
            )
        saved = insert_saved_theme(company["id"], req.theme, req.prompt, theme_hash)
        return SaveThemeResponse(success=True, already_saved=False, data=SavedTheme(**saved), message="Theme saved")
    except pymysql.err.IntegrityError:
        # Belt-and-braces: two near-simultaneous saves of the same theme
        # racing past the SELECT above both try to INSERT — the table's
        # UNIQUE KEY (company_id, theme_hash) rejects the second one.
        # Treat that exactly like finding it up front.
        existing = find_saved_theme_by_hash(company["id"], theme_hash)
        return SaveThemeResponse(
            success=True, already_saved=True, data=SavedTheme(**existing) if existing else None, message="Already saved"
        )
    except Exception as e:
        logger.error(f"/saved-themes POST error: {e}")
        raise HTTPException(500, "Could not save theme")


@app.delete("/saved-themes/{theme_id}", response_model=SaveThemeResponse)
async def remove_saved_theme(theme_id: int, company: dict = Depends(get_current_company)):
    deleted = delete_saved_theme(theme_id, company["id"])
    if not deleted:
        raise HTTPException(404, "Saved theme not found")
    return SaveThemeResponse(success=True, message="Theme removed")


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