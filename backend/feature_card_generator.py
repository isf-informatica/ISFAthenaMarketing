"""
feature_card_generator.py
--------------------------
Standalone FastAPI app — Feature Card generation only. Runs on its own
as a backend for your React project (independent from the eBook
generator's main.py; nothing here imports from that file).

FLOW:
  1. Form data (logo, product info, contact, features, tagline) in →
  2. Build an HTML card →
  3. Render it with headless Chromium (Playwright) → PNG screenshot,
     or PDF via the browser's native "print to PDF"
  4. Save to a local "generated_files" folder, served by this same
     app via StaticFiles → return a download_url that points back at
     this server (no AWS/S3, no external service at all)

Rendering uses Playwright + Chromium instead of WeasyPrint. WeasyPrint
needs the GTK3 native libraries (Pango/Cairo/GObject) installed
separately on the OS — this is a common source of "cannot load
library 'libgobject-2.0-0'" errors on Windows. Playwright ships its
own bundled Chromium, so there is nothing extra to install at the OS
level on any platform.

Endpoints:
  POST /generate-feature-card
  POST /api/generate-theme          — AI Theme Generator (see below)
  POST /generate-flyer           — Flyer Generation module (see below)
  POST /api/generate-flyer-content — AI Content Generator for flyers
  POST /api/generate-flyer-image  — AI Image Generator for flyers (see below)
  GET  /health

-------------------------------------------------------------------------
FLYER GENERATION MODULE
-------------------------------------------------------------------------
Everything under the "FLYER GENERATION MODULE" banner further down
this file is an extension added for the Media section's "Flyer
Generation" card. It works exactly like the Feature Card module above,
just for a full multi-section, multi-page, print-ready A4 flyer
instead of a single graphic:

  1. Form data (brand, product, problem/solution, features, benefits,
     why-choose-us, differentiators, screenshots, pricing,
     testimonials, contact, CTA, and an optional target page_count)
     arrives as one structured JSON payload (FlyerRequest) →
  2. build_flyer_html() lays it out into real HTML pages — the
     layout preset (One Page Flyer / Bi-Fold / Tri-Fold / Product
     Catalogue / Company Profile) decides page size/orientation, and
     page_count (if given) overrides how densely sections are grouped
     so the finished PDF lands on exactly that many pages — see
     _distribute_pages() — with CSS page-break rules, headers/footers
     on every page, and A4-safe margins →
  3. render_document_pdf() prints that HTML to a real paginated PDF
     with headless Chromium (same Playwright engine as the feature
     card, just page.pdf(format="A4") instead of a fixed-size
     screenshot) →
  4. Saved locally (same helper/folder as the feature card) → a
     download_url pointing back at this server comes back, and the
     frontend downloads it — the same "click Download PDF, wait, get
     a file" experience as the Feature Card module, just with no AWS
     involved.

  Images: every image slot (logo, cover hero image, per-feature
  icons, screenshots) accepts either a user-uploaded base64 image OR
  an AI-generated one from /api/generate-flyer-image — the user
  always has both options side by side for each slot; nothing is
  AI-only. Slots left empty just render without an image (a plain
  colored dot instead of an icon, a flat color/gradient cover instead
  of a hero photo, etc.), so the flyer never looks broken either way.

  The AI Theme Generator (/api/generate-theme above) is reused as-is
  for flyers — it already only ever returns pure visual styling
  (ThemeJSON), never content, so there is nothing flyer-specific to
  add there.

  /api/generate-flyer-content is the AI feature for text: given
  just a company name, product name, industry, and (optionally) a
  website, it drafts every text section of the flyer (company
  overview, product description, problem, solution, features,
  benefits, why choose us, differentiators, CTA) with real, specific,
  non-generic copy — the user doesn't have to write everything from a
  blank form, and can edit anything it drafts before downloading.
  Same two-path pattern as the theme generator: a real Anthropic call
  if ANTHROPIC_API_KEY is set, else a heuristic template fallback —
  either way the endpoint always returns usable content.

  /api/generate-flyer-image is the AI feature for images: given a
  short prompt and a purpose ("icon" | "hero" | "screenshot"), it
  returns one AI-generated image (via OpenAI's image API) sized right
  for that slot. Optional — if OPENAI_API_KEY isn't set, the endpoint
  says so plainly and the user just uploads their own image instead,
  same as they always could.

Env vars (no AWS needed — files are stored and served locally):
  OUTPUT_DIR   (optional) — folder generated cards/flyers are saved
               to, served back at /files/... Defaults to
               "generated_files" (created automatically next to this
               file if it doesn't exist).
  BASE_URL     (optional) — the public base URL of THIS server, used
               to build the download_url returned to the frontend.
               Defaults to "http://localhost:5000". Set this to your
               real domain once this is deployed somewhere other than
               localhost (e.g. https://api.yourdomain.com).

  ANTHROPIC_API_KEY   (optional) — enables real AI theme + flyer
                      content generation. Without it, those endpoints
                      still work, using built-in heuristic templates
                      instead (see _heuristic_theme / _heuristic_flyer_content).

  OPENAI_API_KEY      (optional) — enables real AI image generation
                      for /api/generate-flyer-image (feature icons,
                      cover hero image, screenshots). Without it, that
                      endpoint returns a clear "not configured"
                      message and the user just uploads images by
                      hand into the same slots instead.

Install:
  pip install fastapi uvicorn pydantic playwright
  playwright install chromium
  pip install anthropic   # optional, only for real AI text generation
  pip install openai      # optional, only for real AI image generation

Run:
  uvicorn feature_card_generator:app --reload --port 5000
  (or simply: python feature_card_generator.py)

Then point your React app at http://localhost:5000/generate-feature-card
and http://localhost:5000/api/generate-theme — CORS below already
allows the common React/Vite dev server ports.
"""

import os
import re
import sys
import json
import time
import uuid
import shutil
import logging
import asyncio
import tempfile

from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Optional — only used by /api/generate-theme, and only if an
# ANTHROPIC_API_KEY is set. Without it (or without `pip install
# anthropic`), theme generation falls back to the built-in
# keyword-matched preset library, so the endpoint always works.
try:
    import anthropic
except ImportError:
    anthropic = None

# Optional — only used by /api/generate-flyer-image, and only if an
# OPENAI_API_KEY is set. Without it (or without `pip install openai`),
# image slots (feature icons, cover hero image, screenshots) simply
# stay empty/fall back to their plain CSS look — the user can still
# upload their own image into any of those same slots either way.
try:
    from openai import AsyncOpenAI
except ImportError:
    AsyncOpenAI = None

# Windows-only fix: Playwright's async API launches Chromium as a
# subprocess, but Windows' default "Selector" event loop can't create
# subprocesses (that's the "NotImplementedError" you'd otherwise get
# from base_events.py -> _make_subprocess_transport). The "Proactor"
# event loop can. This must be set here, at import time, before
# uvicorn spins up its own event loop.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

logger = logging.getLogger(__name__)
router = APIRouter(redirect_slashes=False)

ALLOWED_CARD_FORMATS = {"png", "pdf"}

# ─── Local file storage (replaces the old S3 upload) ──────────────
# Generated cards/flyers are saved here and served back at
# /files/<subfolder>/<filename> by the StaticFiles mount near the
# bottom of this file. No AWS credentials, no external service.
OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "generated_files")
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(os.path.join(OUTPUT_DIR, "featureCards"), exist_ok=True)
os.makedirs(os.path.join(OUTPUT_DIR, "flyers"), exist_ok=True)

# The public base URL of THIS server — used to build download_url.
# Override with the real domain once deployed anywhere but localhost.
BASE_URL = os.environ.get("BASE_URL", "http://localhost:5000").rstrip("/")


# ═══════════════════════════════════════════════════════════════
# REQUEST / RESPONSE MODELS
# ═══════════════════════════════════════════════════════════════

class FeatureItem(BaseModel):
    title:       str = Field(default="", max_length=80)
    description: str = Field(default="", max_length=160)


class FeatureCardRequest(BaseModel):
    product_name:     str = Field(..., min_length=1, max_length=80)
    tagline:          str = Field(default="", max_length=120)
    mobile_number:    str = Field(..., min_length=1, max_length=30)
    email:            str = Field(..., min_length=3, max_length=120)
    website:          str = Field(default="", max_length=150)
    address:          str = Field(default="", max_length=200)
    bottom_statement: str = Field(default="", max_length=160)
    features:         list[FeatureItem] = Field(default_factory=list, max_length=8)
    # Data URL ("data:image/png;base64,...") or raw base64 — optional.
    logo_base64:      str = Field(default="")
    format:           str = Field(default="png", description="'png' or 'pdf'")


class FeatureCardResponse(BaseModel):
    success:      bool
    download_url: str | None = None
    s3_key:       str | None = None
    job_id:       str | None = None
    format:       str | None = None
    message:      str | None = None


# ---- AI Theme Generator ----
# Structured "theme JSON" contract — the frontend's DynamicThemeCard
# renders exactly these fields. The AI (or the fallback heuristic) is
# only ever allowed to produce THIS shape: pure visual/style config,
# never business content (name, contacts, features, closing statement
# never pass through here at all — see GenerateThemeRequest.data below).
class ThemeJSON(BaseModel):
    themeName:      str = "Custom Theme"
    background:     str = "linear-gradient(135deg, #111111 0%, #1a1a1a 100%)"
    accent:         str = "#f97316"
    text:           str = "#ffffff"
    cardStyle:      str = "solid"    # "solid" | "glass" | "minimal"
    borderRadius:   int = 20
    shadow:         str = "soft"     # "none" | "soft" | "medium" | "hard"
    font:           str = "Inter, sans-serif"
    layout:         str = "split"    # "split" | "stack"
    featureLayout:  str = "grid"     # "grid" | "list"
    iconStyle:      str = "circle"   # "circle" | "outline" | "square"


class GenerateThemeRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=500)
    # Accepted for context only (e.g. a future AI call could reference
    # the product name to pick an on-brand palette) — never modified,
    # never included in the response. See generate_theme() below.
    data:   dict = Field(default_factory=dict)


class GenerateThemeResponse(BaseModel):
    success: bool
    theme:   ThemeJSON
    source:  str  # "ai" | "heuristic" — which path produced it


# ═══════════════════════════════════════════════════════════════
# SMALL HELPERS
# ═══════════════════════════════════════════════════════════════

def _esc(t: str) -> str:
    """Minimal HTML-escape for text dropped into the template."""
    return (
        str(t)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _feature_card_logo_tag(logo_base64: str) -> str:
    """logo_base64 can be a data URL ("data:image/png;base64,...") or a
    raw base64 string — normalise either into an <img> tag. Empty string
    if no logo was provided."""
    if not logo_base64:
        return ""
    src = logo_base64 if logo_base64.startswith("data:") else f"data:image/png;base64,{logo_base64}"
    return f'<img src="{src}" class="fc-logo-img"/>'


# ═══════════════════════════════════════════════════════════════
# HTML TEMPLATE
# ═══════════════════════════════════════════════════════════════

FEATURE_CARD_ACCENT = "#f97316"  # orange-500 — matches the dashboard theme
FEATURE_CARD_W = 1600
FEATURE_CARD_H = 900


def build_feature_card_html(data: dict) -> str:
    product_name     = data.get("product_name", "")
    tagline          = data.get("tagline", "")
    mobile_number    = data.get("mobile_number", "")
    email            = data.get("email", "")
    website          = data.get("website", "")
    address          = data.get("address", "")
    bottom_statement = data.get("bottom_statement", "")
    features         = data.get("features") or []
    logo_tag         = _feature_card_logo_tag(data.get("logo_base64", ""))
    acc              = FEATURE_CARD_ACCENT

    contact_icons = {"Phone": "&#9742;", "Email": "&#9993;", "Web": "&#127760;", "Address": "&#128205;"}
    contact_rows = ""
    for label, value in (("Phone", mobile_number), ("Email", email), ("Web", website), ("Address", address)):
        if value:
            contact_rows += (
                f'<div class="fc-contact-row">'
                f'<span class="fc-contact-icon">{contact_icons[label]}</span>'
                f'<span class="fc-contact-value">{_esc(value)}</span>'
                f'</div>'
            )

    feature_cells = ""
    for f in features:
        title = (f.get("title") or "").strip()
        desc  = (f.get("description") or "").strip()
        if not title:
            continue
        desc_html = f'<div class="fc-feature-desc">{_esc(desc)}</div>' if desc else ""
        feature_cells += (f'<div class="fc-feature"><div class="fc-feature-icon">&#9733;</div>'
                           f'<div><div class="fc-feature-title">{_esc(title)}</div>{desc_html}</div></div>')

    dividers_html = (
        '<div class="fc-grid-divider-v"></div>'
        '<div class="fc-grid-divider-h"></div>'
        '<div class="fc-grid-dot"></div>'
    ) if len([f for f in features if (f.get("title") or "").strip()]) == 4 else ""

    tagline_html = f'<div class="fc-tagline">{_esc(tagline)}</div>' if tagline else ""
    banner_html  = f'<div class="fc-banner">{_esc(bottom_statement)}</div>' if bottom_statement else ""

    css = f"""*,*::before,*::after{{box-sizing:border-box;margin:0;padding:0}}
@page{{size:{FEATURE_CARD_W}px {FEATURE_CARD_H}px;margin:0}}
body{{font-family:'Segoe UI',Arial,sans-serif;width:{FEATURE_CARD_W}px;height:{FEATURE_CARD_H}px;overflow:hidden}}
.fc{{width:{FEATURE_CARD_W}px;height:{FEATURE_CARD_H}px;display:flex;background:#ffffff}}
.fc-left{{width:640px;padding:70px 60px;display:flex;flex-direction:column;justify-content:flex-start;gap:28px}}
.fc-logo-img{{max-width:160px;max-height:160px;object-fit:contain;margin-bottom:8px}}
.fc-name{{font-size:44px;font-weight:900;color:#111827;line-height:1.1}}
.fc-tagline{{font-size:16px;color:{acc};font-weight:600;margin-top:6px}}
.fc-contacts{{display:flex;flex-direction:column;gap:18px;margin-top:20px}}
.fc-contact-row{{display:flex;align-items:center;gap:14px}}
.fc-contact-icon{{width:30px;height:30px;min-width:30px;border-radius:50%;background:{acc};color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px}}
.fc-contact-value{{font-size:16px;color:#1f2937;font-weight:600}}
.fc-right{{flex:1;background:linear-gradient(135deg,#111111 0%,#1a1a1a 100%);position:relative;padding:60px 56px;color:#fff;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden}}
.fc-right::before{{content:'';position:absolute;top:-100px;right:-100px;width:320px;height:320px;border-radius:50%;background:{acc}22}}
.fc-headline{{font-size:22px;font-weight:800;letter-spacing:2px;text-transform:uppercase;position:relative;z-index:1}}
.fc-rule{{height:3px;width:80px;background:{acc};border-radius:3px;margin:16px 0 30px;position:relative;z-index:1}}
.fc-grid{{display:grid;grid-template-columns:1fr 1fr;gap:32px;position:relative;z-index:1}}
.fc-grid-divider-v{{position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(255,255,255,0.12);z-index:0}}
.fc-grid-divider-h{{position:absolute;top:50%;left:0;right:0;height:1px;background:rgba(255,255,255,0.12);z-index:0}}
.fc-grid-dot{{position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:{acc};z-index:2}}
.fc-feature{{display:flex;gap:16px;align-items:flex-start;position:relative;z-index:1}}
.fc-feature-icon{{width:44px;height:44px;border-radius:50%;background:{acc}22;border:2px solid {acc};color:{acc};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}}
.fc-feature-title{{font-size:19px;font-weight:700;color:#fff;line-height:1.3}}
.fc-feature-desc{{font-size:13px;color:#9ca3af;margin-top:4px;line-height:1.5;max-width:230px}}
.fc-banner{{margin-top:30px;background:#fff;color:#111827;border-radius:14px;padding:18px 26px;font-size:16px;font-weight:700;text-align:center;position:relative;z-index:1}}"""

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>{_esc(product_name)}</title>
<style>{css}</style></head>
<body><div class="fc">
  <div class="fc-left">
    {logo_tag}
    <div><div class="fc-name">{_esc(product_name)}</div>{tagline_html}</div>
    <div class="fc-contacts">{contact_rows}</div>
  </div>
  <div class="fc-right">
    <div><div class="fc-headline">{_esc(tagline) if tagline else "Why Choose Us"}</div><div class="fc-rule"></div>
    <div class="fc-grid" style="position:relative">{dividers_html}{feature_cells}</div></div>
    {banner_html}
  </div>
</div></body></html>"""


# ═══════════════════════════════════════════════════════════════
# RENDERING — Playwright (headless Chromium)
# ═══════════════════════════════════════════════════════════════

def _render_card_sync(html: str, fmt: str, out_path: str) -> None:
    """Runs in a worker thread (see render_card below) — NOT the asyncio
    event loop. sync_playwright manages its own browser subprocess via
    plain blocking subprocess.Popen, which works on Windows regardless
    of which asyncio event loop policy is active — unlike async_playwright,
    which needs the loop itself to support asyncio.create_subprocess_exec
    (Windows' default SelectorEventLoop doesn't, hence the
    NotImplementedError this replaces)."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        try:
            browser = p.chromium.launch()
        except Exception as e:
            raise RuntimeError(
                f"Couldn't launch Chromium ({e}). Run: playwright install chromium"
            )
        try:
            page = browser.new_page(
                viewport={"width": FEATURE_CARD_W, "height": FEATURE_CARD_H}
            )
            page.set_content(html, wait_until="networkidle")

            if fmt == "pdf":
                page.pdf(
                    path=out_path,
                    width=f"{FEATURE_CARD_W}px",
                    height=f"{FEATURE_CARD_H}px",
                    print_background=True,
                    margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
                )
            else:
                page.screenshot(path=out_path, type="png")
        finally:
            browser.close()


async def render_card(html: str, fmt: str, out_path: str) -> None:
    """Renders the card HTML with headless Chromium and writes either a
    PNG screenshot (fmt="png") or a PDF (fmt="pdf") to out_path.
    Bundled Chromium — no GTK/Pango/Cairo or other OS packages needed."""
    try:
        import playwright.sync_api  # noqa: F401 — import check only
    except ImportError:
        raise RuntimeError(
            "Playwright not installed. Run: pip install playwright && playwright install chromium"
        )

    # Runs the actual (blocking, sync) Playwright call in a worker thread,
    # off the asyncio event loop entirely — see _render_card_sync's
    # docstring for why that matters on Windows.
    await asyncio.to_thread(_render_card_sync, html, fmt, out_path)

    if not os.path.exists(out_path) or os.path.getsize(out_path) < 100:
        raise RuntimeError(f"Chromium produced an empty {fmt.upper()}")

    logger.info(f"{fmt.upper()} via Playwright: {os.path.getsize(out_path) // 1024} KB → {out_path}")


def _render_document_pdf_sync(html: str, out_path: str, landscape: bool, wait_for_fit: bool = False) -> None:
    """Runs in a worker thread — see _render_card_sync's docstring.

    wait_for_fit=True is used for the One Page Flyer: its HTML embeds
    an inline <script> (_ONEPAGE_FIT_SCRIPT) that measures the real
    rendered content in this same Chromium page and picks the smallest
    fixed size tier that avoids overflow, then sets
    documentElement[data-op-fit="done"]. We wait for that flag before
    calling page.pdf() so the PDF captures the already-fitted layout
    instead of racing it."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        try:
            browser = p.chromium.launch()
        except Exception as e:
            raise RuntimeError(f"Couldn't launch Chromium ({e}). Run: playwright install chromium")
        try:
            page = browser.new_page()
            page.set_content(html, wait_until="networkidle")
            if wait_for_fit:
                try:
                    page.wait_for_function("document.documentElement.getAttribute('data-op-fit') === 'done'", timeout=5000)
                except Exception as e:
                    logger.warning(f"One Page Flyer auto-fit didn't confirm in time, printing as-is: {e}")
            page.pdf(
                path=out_path,
                format="A4",
                landscape=landscape,
                print_background=True,
                # Margins are also set per-page via @page CSS in
                # build_flyer_html — these are a safe fallback so the
                # PDF is never edge-to-edge even if that rule is missed.
                margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
                display_header_footer=False,
            )
        finally:
            browser.close()


async def render_document_pdf(html: str, out_path: str, landscape: bool = False, wait_for_fit: bool = False) -> None:
    """Generic multi-page, print-ready A4 PDF renderer — used by the
    Flyer Generation module. Unlike render_card() above (which
    screenshots/prints a single fixed-size graphic), this prints real
    paginated A4 output: page breaks, margins, and repeating
    headers/footers all come from the HTML/CSS itself (see
    build_flyer_html), Chromium just paginates it faithfully.

    wait_for_fit=True is passed for layout="onePage" — see
    _render_document_pdf_sync's docstring."""
    try:
        import playwright.sync_api  # noqa: F401 — import check only
    except ImportError:
        raise RuntimeError(
            "Playwright not installed. Run: pip install playwright && playwright install chromium"
        )

    await asyncio.to_thread(_render_document_pdf_sync, html, out_path, landscape, wait_for_fit)

    if not os.path.exists(out_path) or os.path.getsize(out_path) < 100:
        raise RuntimeError("Chromium produced an empty PDF")

    logger.info(f"Flyer PDF via Playwright: {os.path.getsize(out_path) // 1024} KB → {out_path}")


# ═══════════════════════════════════════════════════════════════
# LOCAL FILE STORAGE (replaces the old S3 upload)
# ═══════════════════════════════════════════════════════════════

def save_local_file(local_path: str, file_key: str, content_type: str = "application/pdf") -> str:
    """Moves the rendered file from its temp location into OUTPUT_DIR
    under `file_key` (e.g. "featureCards/my-product-ab12cd34.png"),
    and returns a URL the frontend can download it from directly —
    served by the StaticFiles mount at /files below. content_type is
    accepted for signature-compatibility with the old upload helper's
    call sites but isn't needed: StaticFiles infers it from the file
    extension when serving."""
    dest_path = os.path.join(OUTPUT_DIR, file_key)
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    shutil.move(local_path, dest_path)
    logger.info(f"Saved locally: {dest_path}")
    from urllib.parse import quote
    encoded_key = quote(file_key, safe="/")
    return f"{BASE_URL}/files/{encoded_key}"


# ═══════════════════════════════════════════════════════════════
# AI THEME GENERATOR
# ═══════════════════════════════════════════════════════════════
# Two paths, always returning the same ThemeJSON shape:
#   1. Real AI (Anthropic) — used when ANTHROPIC_API_KEY is set and the
#      `anthropic` package is installed. Understands free-form prompts.
#   2. Heuristic fallback — a small keyword-matched preset library.
#      Zero dependencies, always available, so the endpoint never just
#      errors out with nothing to show. Also what backs the AI path if
#      the model call fails or returns something that doesn't validate.

_DEFAULT_THEME = dict(
    themeName="Custom Theme",
    background="linear-gradient(135deg, #111111 0%, #1a1a1a 100%)",
    accent="#f97316",
    text="#ffffff",
    cardStyle="solid",
    borderRadius=20,
    shadow="soft",
    font="Inter, sans-serif",
    layout="split",
    featureLayout="grid",
    iconStyle="circle",
)

# (keywords to match in the lowercased prompt, theme fields to merge over the default)
_THEME_PRESETS: list[tuple[list[str], dict]] = [
    (["apple", "premium", "elegant"], dict(
        themeName="Apple Style", background="#ffffff", accent="#3B82F6", text="#111111",
        cardStyle="glass", borderRadius=28, shadow="soft", font="'SF Pro Display', Inter, sans-serif",
        layout="split", featureLayout="grid", iconStyle="outline")),
    (["glass", "glassmorphism", "frosted"], dict(
        themeName="Glassmorphism", background="linear-gradient(135deg, rgba(59,130,246,0.25), rgba(139,92,246,0.25))",
        accent="#60a5fa", text="#ffffff", cardStyle="glass", borderRadius=24, shadow="soft",
        font="Inter, sans-serif", layout="split", featureLayout="grid", iconStyle="circle")),
    (["luxury", "gold", "black gold"], dict(
        themeName="Luxury Black Gold", background="linear-gradient(160deg, #0a0a0a 0%, #1a1a0a 100%)",
        accent="#d4af37", text="#f5e6b8", cardStyle="solid", borderRadius=8, shadow="hard",
        font="'Playfair Display', Georgia, serif", layout="split", featureLayout="list", iconStyle="square")),
    (["corporate", "blue", "professional", "business"], dict(
        themeName="Corporate Blue", background="linear-gradient(155deg, #1e3a8a 0%, #1e40af 100%)",
        accent="#60a5fa", text="#ffffff", cardStyle="solid", borderRadius=12, shadow="medium",
        font="'Segoe UI', Arial, sans-serif", layout="split", featureLayout="grid", iconStyle="square")),
    (["minimal", "white", "clean", "simple"], dict(
        themeName="Minimal White", background="#fafafa", accent="#111111", text="#111111",
        cardStyle="minimal", borderRadius=16, shadow="none", font="Inter, sans-serif",
        layout="split", featureLayout="list", iconStyle="outline")),
    (["cyberpunk", "neon"], dict(
        themeName="Cyberpunk", background="linear-gradient(135deg, #0d0221 0%, #1a0533 100%)",
        accent="#00f0ff", text="#ff2079", cardStyle="solid", borderRadius=4, shadow="hard",
        font="'Courier New', monospace", layout="split", featureLayout="grid", iconStyle="square")),
    (["futuristic", "ai", "tech"], dict(
        themeName="Futuristic AI", background="radial-gradient(circle at 20% 20%, #0f172a 0%, #020617 100%)",
        accent="#22d3ee", text="#e2e8f0", cardStyle="glass", borderRadius=20, shadow="soft",
        font="'Orbitron', Inter, sans-serif", layout="split", featureLayout="grid", iconStyle="outline")),
    (["startup", "saas", "vibrant"], dict(
        themeName="Startup SaaS", background="linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)",
        accent="#facc15", text="#ffffff", cardStyle="solid", borderRadius=24, shadow="medium",
        font="Inter, sans-serif", layout="split", featureLayout="grid", iconStyle="circle")),
    (["material"], dict(
        themeName="Material Design", background="#ffffff", accent="#6200ee", text="#1c1b1f",
        cardStyle="minimal", borderRadius=12, shadow="medium", font="Roboto, sans-serif",
        layout="split", featureLayout="list", iconStyle="circle")),
    (["bento"], dict(
        themeName="Modern Bento", background="#f4f4f5", accent="#f97316", text="#18181b",
        cardStyle="minimal", borderRadius=28, shadow="soft", font="Inter, sans-serif",
        layout="stack", featureLayout="grid", iconStyle="square")),
]


def _heuristic_theme(prompt: str) -> dict:
    p = prompt.lower()
    for keywords, theme in _THEME_PRESETS:
        if any(k in p for k in keywords):
            return {**_DEFAULT_THEME, **theme}
    return dict(_DEFAULT_THEME)


_THEME_SYSTEM_PROMPT = """You are a design system that outputs ONLY a JSON object describing a visual theme for a "feature card" graphic. You never see or influence the business content (name, contacts, feature text) — only styling.

Return strictly valid JSON matching this shape, no prose, no markdown fences, no extra keys:
{
  "themeName": string,
  "background": string (CSS color or gradient, used behind the feature panel),
  "accent": string (hex color, used for icons/dividers/highlights),
  "text": string (hex color, used for text on the feature panel),
  "cardStyle": "solid" | "glass" | "minimal",
  "borderRadius": number (px, 0-40),
  "shadow": "none" | "soft" | "medium" | "hard",
  "font": string (CSS font-family stack),
  "layout": "split" | "stack",
  "featureLayout": "grid" | "list",
  "iconStyle": "circle" | "outline" | "square"
}"""


async def _ai_theme(prompt: str) -> dict | None:
    """Returns a theme dict from Anthropic, or None to fall back to the
    heuristic generator — no key configured, package missing, the model
    call failing, or the response not being valid JSON are all treated
    the same way: fall back, don't error the request out."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key or anthropic is None:
        return None
    try:
        client = anthropic.AsyncAnthropic(api_key=api_key)
        resp = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=400,
            system=_THEME_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": f'Design prompt: "{prompt}"'}],
        )
        raw = "".join(block.text for block in resp.content if getattr(block, "type", "") == "text").strip()
        raw = raw.strip("`")
        if raw[:4].lower() == "json":
            raw = raw[4:].strip()
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            return None
        return {**_DEFAULT_THEME, **parsed}
    except Exception as e:
        logger.warning(f"AI theme generation failed, falling back to heuristic: {e}")
        return None


# ═══════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@router.post("/generate-feature-card", response_model=FeatureCardResponse)
async def generate_feature_card(req: FeatureCardRequest):
    fmt = (req.format or "png").strip().lower()
    if fmt not in ALLOWED_CARD_FORMATS:
        raise HTTPException(422, f"format must be one of {sorted(ALLOWED_CARD_FORMATS)}")

    job_id = str(uuid.uuid4())[:8]
    slug   = re.sub(r"[^a-z0-9]+", "-", req.product_name.lower())[:40].strip("-") or "feature-card"

    logger.info(f"[{job_id}] feature-card product='{req.product_name}' format={fmt}")

    data      = req.model_dump()
    tmp_dir   = tempfile.gettempdir()  # cross-platform — plain "/tmp/..." isn't reliable on Windows
    out_path  = os.path.join(tmp_dir, f"{slug}-{job_id}.{fmt}")

    try:
        html = build_feature_card_html(data)
        await render_card(html, fmt, out_path)
    except Exception as e:
        logger.error(f"[{job_id}] Feature card render error: {e}")
        raise HTTPException(500, f"Feature card generation failed: {e}")

    download_url = None
    s3_key       = None
    try:
        content_type = "application/pdf" if fmt == "pdf" else "image/png"
        s3_key       = f"featureCards/{slug}-{job_id}.{fmt}"
        download_url = save_local_file(out_path, s3_key, content_type=content_type)
    except Exception as e:
        logger.error(f"[{job_id}] Feature card save error: {e}")
        raise HTTPException(502, f"Feature card export failed: {e}")
    finally:
        if os.path.exists(out_path):
            os.remove(out_path)

    logger.info(f"[{job_id}] Feature card done!")
    return FeatureCardResponse(
        success      = True,
        download_url = download_url,
        s3_key       = s3_key,
        job_id       = job_id,
        format       = fmt,
        message      = f"Feature card generated for '{req.product_name}' ({fmt.upper()})",
    )


@router.get("/health")
async def health():
    return {
        "status":      "ok",
        "service":     "feature_card_generator",
        "storage":     "local",
        "output_dir":  os.path.abspath(OUTPUT_DIR),
        "base_url":    BASE_URL,
    }


@router.post("/api/generate-theme", response_model=GenerateThemeResponse)
async def generate_theme(req: GenerateThemeRequest):
    """Turns a natural-language design prompt into a ThemeJSON object.
    Never touches req.data (the business content) — it's accepted only
    as optional future context and is never read back into the theme
    or the response."""
    prompt = req.prompt.strip()
    if not prompt:
        raise HTTPException(422, "prompt must not be empty")

    ai_result = await _ai_theme(prompt)
    if ai_result is not None:
        try:
            theme = ThemeJSON(**ai_result)
            logger.info(f"AI theme generated for prompt: '{prompt[:60]}'")
            return GenerateThemeResponse(success=True, theme=theme, source="ai")
        except Exception as e:
            logger.warning(f"AI theme JSON failed validation, falling back to heuristic: {e}")

    theme = ThemeJSON(**_heuristic_theme(prompt))
    logger.info(f"Heuristic theme '{theme.themeName}' generated for prompt: '{prompt[:60]}'")
    return GenerateThemeResponse(success=True, theme=theme, source="heuristic")


# ═══════════════════════════════════════════════════════════════
# FLYER GENERATION MODULE
# ═══════════════════════════════════════════════════════════════
# See the module docstring at the top of this file for the full flow.
# Everything below is self-contained — it shares only the small
# helpers above it (_esc, save_local_file) and the ThemeJSON /
# generate_theme() AI Theme Generator, which is generic enough to be
# reused unchanged for flyers.

ALLOWED_FLYER_LAYOUTS = {"onePage", "biFold", "triFold", "catalogue", "companyProfile"}


# ---- Request / response models -----------------------------------

class FlyerFeatureItem(BaseModel):
    title:       str = Field(default="", max_length=90)
    description: str = Field(default="", max_length=240)
    # Optional per-item icon — data URL or raw base64. If left blank,
    # /api/generate-flyer-image can fill it in (AI), or the
    # renderer falls back to a plain colored dot bullet (see
    # _sec_item_grid) so the section always looks intentional either way.
    icon_base64: str = Field(default="")


class FlyerScreenshot(BaseModel):
    # Data URL ("data:image/png;base64,...") or raw base64.
    image_base64: str = Field(default="")
    caption:       str = Field(default="", max_length=120)


class FlyerPricingPlan(BaseModel):
    name:     str = Field(default="", max_length=60)
    price:    str = Field(default="", max_length=40)
    period:   str = Field(default="", max_length=30)
    features: list[str] = Field(default_factory=list, max_length=10)
    highlighted: bool = False


class FlyerTestimonial(BaseModel):
    quote:  str = Field(default="", max_length=400)
    author: str = Field(default="", max_length=80)
    role:   str = Field(default="", max_length=100)


class FlyerRequest(BaseModel):
    layout: str = Field(default="onePage", description="onePage | biFold | triFold | catalogue | companyProfile")
    # Visual template for the generated content — separate from `theme`
    # (which is just colors/font). "classic" (default) is the original
    # section-by-section design; "modern" is the icon-badge design with
    # a hero-style cover. Applies to every layout, including onePage —
    # its dedicated auto-fit engine reuses the same op-* classes/tiers
    # either way, just with different icon-badge styling inside them.
    template: str = Field(default="classic", description="classic | modern")
    theme:  dict = Field(default_factory=dict, description="ThemeJSON-shaped visual theme — same contract as the Feature Card AI Theme Generator")

    # How many pages the finished PDF should have. None = auto (each
    # layout's built-in default density). When set, content is spread
    # or condensed across exactly this many pages regardless of
    # layout — see _distribute_pages() / _build_flyer_layout().
    # Ignored entirely for layout="onePage": that layout always
    # generates exactly one page via its own dedicated engine (see
    # _build_onepage_flyer) — pick any other layout for a real
    # multi-page document.
    page_count: int | None = Field(default=None, ge=1, le=24)

    # Brand Information
    logo_base64:   str = Field(default="")
    # Optional cover/hero image — data URL or raw base64. Uploaded by
    # the user, or generated via /api/generate-flyer-image. Falls
    # back to a plain color/gradient cover (current look) if omitted.
    hero_image_base64: str = Field(default="")
    company_name:  str = Field(default="", max_length=100)
    brand_tagline: str = Field(default="", max_length=140)

    # Product Information
    product_name:  str = Field(default="", max_length=100)
    product_category: str = Field(default="", max_length=80)
    product_overview: str = Field(default="", max_length=1200)

    # Problem Statement / Solution
    problem_statement: str = Field(default="", max_length=1200)
    solution_statement: str = Field(default="", max_length=1200)

    # Feature List / Benefits / Why Choose Us
    features:      list[FlyerFeatureItem] = Field(default_factory=list, max_length=24)
    benefits:      list[FlyerFeatureItem] = Field(default_factory=list, max_length=24)
    why_choose_us: list[FlyerFeatureItem] = Field(default_factory=list, max_length=24)

    # Short one-line differentiators — the "what sets us apart" list,
    # e.g. the EasyLearn sample's numbered "Features that distinguish
    # X from others" list. Optional; renders as a clean checklist page
    # when present (see _sec_differentiators).
    differentiators: list[str] = Field(default_factory=list, max_length=30)

    # Screenshots
    screenshots: list[FlyerScreenshot] = Field(default_factory=list, max_length=12)

    # Pricing (optional)
    pricing_enabled: bool = False
    pricing_plans:   list[FlyerPricingPlan] = Field(default_factory=list, max_length=6)

    # Testimonials
    testimonials: list[FlyerTestimonial] = Field(default_factory=list, max_length=8)

    # Contact Details
    phone:   str = Field(default="", max_length=30)
    email:   str = Field(default="", max_length=120)
    website: str = Field(default="", max_length=150)
    address: str = Field(default="", max_length=220)

    # Call To Action
    cta_heading: str = Field(default="", max_length=120)
    cta_subtext: str = Field(default="", max_length=240)
    cta_button:  str = Field(default="Get Started", max_length=40)


class FlyerResponse(BaseModel):
    success:      bool
    download_url: str | None = None
    s3_key:       str | None = None
    job_id:       str | None = None
    message:      str | None = None


class FlyerContentRequest(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=100)
    product_name: str = Field(..., min_length=1, max_length=100)
    industry:     str = Field(default="", max_length=80)
    website:      str = Field(default="", max_length=150)
    # Optional — same page_count the flyer itself will be generated
    # with. Scales how many features/benefits/differentiators get
    # drafted so the content actually fills that many pages instead of
    # leaving them sparse or padding them with filler.
    page_count:   int | None = Field(default=None, ge=1, le=24)


class FlyerContentResponse(BaseModel):
    success: bool
    content: dict
    source:  str  # "ai" | "heuristic"


class FlyerImageRequest(BaseModel):
    prompt:  str = Field(..., min_length=1, max_length=500, description="What the image should depict, e.g. 'flat icon of a shield with a checkmark, admission security'")
    purpose: str = Field(default="icon", description="'icon' (small square feature icon) | 'hero' (wide cover/background image) | 'screenshot' (product visual)")


class FlyerImageResponse(BaseModel):
    success:      bool
    image_base64: str | None = None   # data URL, ready to drop straight into icon_base64 / hero_image_base64 / screenshots[].image_base64
    message:      str | None = None


# ---- Small helpers --------------------------------------------------

def _flyer_image_tag(image_base64: str, css_class: str) -> str:
    if not image_base64:
        return ""
    src = image_base64 if image_base64.startswith("data:") else f"data:image/png;base64,{image_base64}"
    return f'<img src="{src}" class="{css_class}"/>'


def _flyer_theme_colors(theme: dict) -> dict:
    """Pulls just the colors/typography the flyer template needs out
    of a ThemeJSON dict, with the same defaults as the Feature Card's
    DynamicThemeCard so an unthemed flyer still looks intentional."""
    return {
        "accent": theme.get("accent") or "#f97316",
        "text_on_dark": theme.get("text") or "#ffffff",
        "background": theme.get("background") or "linear-gradient(135deg, #111111 0%, #1a1a1a 100%)",
        "font": theme.get("font") or "'Segoe UI', Arial, sans-serif",
        "radius": theme.get("borderRadius", 14),
    }


# ---- Section renderers (shared across every layout) -----------------
# Each layout preset assembles these same section blocks in a different
# order/grouping — this is what keeps the flyer content identical no
# matter which layout is picked, and avoids duplicating the section
# markup per layout.

def _sec_cover(data: dict, colors: dict) -> str:
    logo_tag = _flyer_image_tag(data.get("logo_base64", ""), "br-logo")
    hero = data.get("hero_image_base64", "")
    hero_style = ""
    if hero:
        src = hero if hero.startswith("data:") else f"data:image/png;base64,{hero}"
        hero_style = f";background-image:linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.45)),url('{src}');background-size:cover;background-position:center"
    if data.get("template") == "modern":
        return _sec_cover_modern(data, colors)
    return f"""<section class="br-page br-cover" style="background:{colors['background']}{hero_style}">
  <div class="br-cover-inner">
    {logo_tag}
    <div class="br-eyebrow">{_esc(data.get('product_category','') or 'Product Flyer')}</div>
    <div class="br-cover-title">{_esc(data.get('company_name','Your Company'))}</div>
    <div class="br-cover-sub">{_esc(data.get('brand_tagline',''))}</div>
    <div class="br-cover-product">{_esc(data.get('product_name',''))}</div>
  </div>
</section>"""


def _sec_cover_modern(data: dict, colors: dict) -> str:
    """Modern template cover — dark hero banner, logo/company/tagline in
    a top bar, big product name, overview paragraph underneath."""
    logo_tag = _flyer_image_tag(data.get("logo_base64", ""), "brm-logo")
    return f"""<section class="br-page brm-cover" style="background:{colors['background']}">
  <div class="brm-cover-topbar">
    {logo_tag}
    <span class="brm-cover-company">{_esc(data.get('company_name','Your Company'))}</span>
    <span class="brm-cover-tagline">{_esc(data.get('brand_tagline',''))}</span>
  </div>
  <div class="brm-cover-title">{_esc(data.get('product_name','Your Product'))}</div>
  {f'<div class="brm-cover-category">{_esc(data.get("product_category",""))}</div>' if data.get('product_category') else ''}
  <p class="brm-cover-overview">{_esc(data.get('product_overview','') or data.get('brand_tagline',''))}</p>
</section>"""


def _sec_problem_solution_modern(data: dict, colors: dict) -> str:
    if not (data.get("problem_statement") or data.get("solution_statement")):
        return ""
    problem = data.get("problem_statement", "")
    solution = data.get("solution_statement", "")
    return f"""<div class="brm-ps-grid">
  {f'<div class="brm-ps-card brm-ps-problem" style="background:{colors["accent"]}14"><div class="brm-ps-label" style="color:{colors["accent"]}">The Problem</div><p class="brm-ps-text">{_esc(problem)}</p></div>' if problem else ''}
  {f'<div class="brm-ps-card brm-ps-solution"><div class="brm-ps-label">Our Solution</div><p class="brm-ps-text">{_esc(solution)}</p></div>' if solution else ''}
</div>"""


def _sec_problem_solution(data: dict, colors: dict) -> str:
    if not (data.get("problem_statement") or data.get("solution_statement")):
        return ""
    return f"""<div class="br-block">
  <div class="br-heading" style="color:{colors['accent']}">The Problem</div>
  <p class="br-body">{_esc(data.get('problem_statement',''))}</p>
</div>
<div class="br-block">
  <div class="br-heading" style="color:{colors['accent']}">Our Solution</div>
  <p class="br-body">{_esc(data.get('solution_statement',''))}</p>
</div>"""


def _sec_item_grid(items: list, heading: str, colors: dict, template: str = "classic") -> str:
    items = [i for i in items if (i.get("title") or "").strip()]
    if not items:
        return ""
    if template == "modern":
        cells = "".join(
            f'''<div class="brm-item">
  <div class="brm-item-badge" style="background:{colors['accent']}1a;color:{colors['accent']}">
    {_flyer_image_tag(i.get("icon_base64",""), "brm-item-icon") if i.get('icon_base64') else '&#10022;'}
  </div>
  <div>
    <div class="brm-item-title">{_esc(i.get('title',''))}</div>
    {f'<div class="brm-item-desc">{_esc(i.get("description",""))}</div>' if i.get('description') else ''}
  </div>
</div>''' for i in items
        )
        return f"""<div class="brm-block">
  <div class="brm-heading" style="color:{colors['accent']}">{_esc(heading)}</div>
  <div class="brm-grid">{cells}</div>
</div>"""
    cells = "".join(
        f'''<div class="br-item">
  {f'<div class="br-item-icon-wrap" style="border-color:{colors["accent"]}">{_flyer_image_tag(i.get("icon_base64",""), "br-item-icon")}</div>' if i.get('icon_base64') else f'<div class="br-item-dot" style="background:{colors["accent"]}"></div>'}
  <div class="br-item-title">{_esc(i.get('title',''))}</div>
  <div class="br-item-desc">{_esc(i.get('description',''))}</div>
</div>''' for i in items
    )
    return f"""<div class="br-block">
  <div class="br-heading" style="color:{colors['accent']}">{_esc(heading)}</div>
  <div class="br-grid">{cells}</div>
</div>"""


def _sec_differentiators(items: list, colors: dict) -> str:
    """Renders the short 'what sets us apart' one-liner list as a clean
    numbered checklist — the flyer-level equivalent of the sample's
    'Features that distinguish X from others' numbered list."""
    items = [d.strip() for d in (items or []) if d and d.strip()]
    if not items:
        return ""
    rows = "".join(
        f'''<div class="br-diff-row">
  <div class="br-diff-num" style="background:{colors['accent']}">{idx+1}</div>
  <div class="br-diff-text">{_esc(text)}</div>
</div>''' for idx, text in enumerate(items)
    )
    return f"""<div class="br-block">
  <div class="br-heading" style="color:{colors['accent']}">What Sets Us Apart</div>
  <div class="br-diff-list">{rows}</div>
</div>"""


def _sec_screenshots(shots: list, colors: dict) -> str:
    shots = [s for s in shots if s.get("image_base64")]
    if not shots:
        return ""
    cells = "".join(
        f'''<figure class="br-shot">
  {_flyer_image_tag(s.get('image_base64',''), 'br-shot-img')}
  {f'<figcaption class="br-shot-cap">{_esc(s.get("caption",""))}</figcaption>' if s.get('caption') else ''}
</figure>''' for s in shots
    )
    return f"""<div class="br-block">
  <div class="br-heading" style="color:{colors['accent']}">Screenshots</div>
  <div class="br-shot-grid">{cells}</div>
</div>"""


def _sec_pricing(data: dict, colors: dict) -> str:
    if not data.get("pricing_enabled") or not data.get("pricing_plans"):
        return ""
    cards = ""
    for plan in data["pricing_plans"]:
        feats = "".join(f'<li>{_esc(f)}</li>' for f in (plan.get("features") or []))
        hl = plan.get("highlighted")
        style = f"border:2px solid {colors['accent']};transform:scale(1.03)" if hl else "border:1px solid #e5e7eb"
        cards += f"""<div class="br-plan" style="{style}">
  {'<div class="br-plan-badge" style="background:' + colors['accent'] + '">Most Popular</div>' if hl else ''}
  <div class="br-plan-name">{_esc(plan.get('name',''))}</div>
  <div class="br-plan-price" style="color:{colors['accent']}">{_esc(plan.get('price',''))}<span class="br-plan-period">{_esc(plan.get('period',''))}</span></div>
  <ul class="br-plan-feats">{feats}</ul>
</div>"""
    return f"""<div class="br-block">
  <div class="br-heading" style="color:{colors['accent']}">Pricing</div>
  <div class="br-plans">{cards}</div>
</div>"""


def _sec_testimonials(items: list, colors: dict) -> str:
    items = [t for t in items if (t.get("quote") or "").strip()]
    if not items:
        return ""
    cards = "".join(
        f'''<div class="br-quote-card">
  <div class="br-quote-mark" style="color:{colors['accent']}">&ldquo;</div>
  <p class="br-quote-text">{_esc(t.get('quote',''))}</p>
  <div class="br-quote-author">{_esc(t.get('author',''))}</div>
  <div class="br-quote-role">{_esc(t.get('role',''))}</div>
</div>''' for t in items
    )
    return f"""<div class="br-block">
  <div class="br-heading" style="color:{colors['accent']}">What Our Customers Say</div>
  <div class="br-quotes">{cards}</div>
</div>"""


def _sec_contact_cta(data: dict, colors: dict) -> str:
    if data.get("template") == "modern":
        return _sec_contact_cta_modern(data, colors)
    rows = ""
    for label, value in (("Phone", data.get("phone", "")), ("Email", data.get("email", "")),
                          ("Web", data.get("website", "")), ("Address", data.get("address", ""))):
        if value:
            rows += f'<div class="br-contact-row"><span class="br-contact-label">{label}</span>{_esc(value)}</div>'
    cta = ""
    if data.get("cta_heading") or data.get("cta_subtext"):
        cta = f"""<div class="br-cta" style="background:{colors['background']}">
  <div class="br-cta-heading">{_esc(data.get('cta_heading','Ready to get started?'))}</div>
  <div class="br-cta-sub">{_esc(data.get('cta_subtext',''))}</div>
  <div class="br-cta-btn" style="background:{colors['accent']}">{_esc(data.get('cta_button','Get Started'))}</div>
</div>"""
    return f"""<div class="br-block">
  <div class="br-heading" style="color:{colors['accent']}">Get In Touch</div>
  <div class="br-contacts">{rows}</div>
</div>{cta}"""


def _sec_contact_cta_modern(data: dict, colors: dict) -> str:
    icons = {"Phone": "&#9742;", "Email": "&#9993;", "Web": "&#127760;", "Address": "&#128205;"}
    rows = ""
    for label, value in (("Phone", data.get("phone", "")), ("Email", data.get("email", "")),
                          ("Web", data.get("website", "")), ("Address", data.get("address", ""))):
        if value:
            rows += f'''<div class="brm-contact-item">
  <div class="brm-contact-badge" style="background:{colors['accent']}1a;color:{colors['accent']}">{icons[label]}</div>
  <span>{_esc(value)}</span>
</div>'''
    contact_block = f'''<div class="brm-block">
  <div class="brm-heading" style="color:{colors['accent']}">Get In Touch</div>
  <div class="brm-contact-grid">{rows}</div>
</div>''' if rows else ""
    cta = ""
    if data.get("cta_heading") or data.get("cta_subtext"):
        cta = f"""<div class="brm-cta">
  <div>
    <div class="brm-cta-heading">{_esc(data.get('cta_heading','Ready to get started?'))}</div>
    {f'<div class="brm-cta-sub">{_esc(data.get("cta_subtext",""))}</div>' if data.get('cta_subtext') else ''}
  </div>
  <span class="brm-cta-btn" style="background:{colors['accent']}">{_esc(data.get('cta_button','Get Started'))} &#8599;</span>
</div>"""
    return contact_block + cta


# ---- One Page Flyer — dedicated, independent rendering engine ---------
# Deliberately NOT built out of _all_sections()/_distribute_pages()
# above (those only serve the other four multi-page layouts). This
# mirrors the frontend's OnePageFlyer/ONEPAGE_STYLE_BLOCK in
# Mediasection.jsx block-for-block and tier-for-tier: same fixed
# content-priority order, same top-4/4/3/1 limits, same 4 CSS shrink
# tiers, same CTA-pinned-to-bottom layout — so the live preview matches
# this PDF export exactly.
#
# Content order (never reshuffled, never paginated):
#   Logo -> Company -> Product -> Overview -> Problem & Solution ->
#   Top 4 Features -> Top 4 Benefits -> Top 3 Why Choose Us ->
#   1 Screenshot -> Contact -> CTA (always pinned to the page bottom).
#
# Sizing: instead of shrinking to fit via one pass, an inline <script>
# tries a small number of FIXED size tiers (0 normal -> 3 ultra-dense)
# against the real rendered page, in the actual headless-Chromium
# viewport that will become the PDF, and keeps the first one that
# doesn't overflow — never cutting content, only shrinking font
# size/spacing/padding. Tier 3 is the guaranteed-fit floor.

_ONEPAGE_TIER_COUNT = 4

_ONEPAGE_CSS = """
.op-page{position:relative;width:calc(210mm - 28mm);height:calc(297mm - 32mm);box-sizing:border-box;display:flex;flex-direction:column;padding:16px 14px;background:#fff}
.op-header{display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:14px;border-bottom:2px solid #eef0f3;flex:0 0 auto}
.op-logo{width:56px;height:56px;object-fit:cover;border-radius:10px;flex-shrink:0;background:rgba(127,127,127,.12);border:1px solid rgba(127,127,127,.18)}
.op-company{font-size:21px;font-weight:900;color:#111827;line-height:1.15}
.op-product{font-size:12.5px;font-weight:700;margin-top:2px}
.op-tagline{font-size:10.5px;color:#6b7280;margin-top:2px}
.op-inner{flex:1 1 auto;min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:12px}
.op-heading{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
.op-body{font-size:11px;color:#374151;line-height:1.5;margin-bottom:6px}
.op-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.op-item{border:1px solid #eef0f3;border-radius:8px;padding:8px 10px}
.op-item-title{font-size:11px;font-weight:700;color:#111827;margin-bottom:2px}
.op-item-desc{font-size:9.5px;color:#6b7280;line-height:1.45}
.op-shot-img{width:100%;height:110px;object-fit:cover;border-radius:8px;display:block}
.op-shot-cap{font-size:9px;color:#6b7280;text-align:center;margin-top:4px}
.op-contacts{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:10.5px;color:#374151}
.op-cta{margin-top:12px;flex:0 0 auto;border-radius:14px;padding:14px;text-align:center;color:#fff}
.op-cta-heading{font-size:13.5px;font-weight:800}
.op-cta-sub{font-size:10px;opacity:.85;margin-top:2px}
.op-cta-btn{display:inline-block;margin-top:8px;padding:6px 18px;border-radius:999px;font-size:10px;font-weight:700}

.op-page.op-tier-1{padding:13px 11px}
.op-page.op-tier-1 .op-header{gap:10px;margin-bottom:10px;padding-bottom:10px}
.op-page.op-tier-1 .op-logo{width:42px;height:42px}
.op-page.op-tier-1 .op-company{font-size:16.5px}
.op-page.op-tier-1 .op-product{font-size:11.5px}
.op-page.op-tier-1 .op-tagline{font-size:9.5px}
.op-page.op-tier-1 .op-inner{gap:9px}
.op-page.op-tier-1 .op-heading{font-size:10.5px}
.op-page.op-tier-1 .op-body{font-size:9.8px;margin-bottom:5px}
.op-page.op-tier-1 .op-item-desc{font-size:8.5px}
.op-page.op-tier-1 .op-shot-img{height:90px}
.op-page.op-tier-1 .op-cta-heading{font-size:12.5px}
.op-page.op-tier-1 .op-cta-sub{font-size:9.3px}

.op-page.op-tier-2{padding:10px 9px}
.op-page.op-tier-2 .op-header{gap:8px;margin-bottom:8px;padding-bottom:8px}
.op-page.op-tier-2 .op-logo{width:34px;height:34px}
.op-page.op-tier-2 .op-company{font-size:14.5px}
.op-page.op-tier-2 .op-product{font-size:10.5px}
.op-page.op-tier-2 .op-tagline{font-size:8.5px}
.op-page.op-tier-2 .op-inner{gap:7px}
.op-page.op-tier-2 .op-heading{font-size:9.5px}
.op-page.op-tier-2 .op-body{font-size:8.8px;margin-bottom:4px}
.op-page.op-tier-2 .op-item-desc{font-size:7.5px}
.op-page.op-tier-2 .op-shot-img{height:72px}
.op-page.op-tier-2 .op-cta-heading{font-size:11.5px}
.op-page.op-tier-2 .op-cta-sub{font-size:8.6px}

.op-page.op-tier-3{padding:8px 7px}
.op-page.op-tier-3 .op-header{gap:6px;margin-bottom:6px;padding-bottom:6px}
.op-page.op-tier-3 .op-logo{width:28px;height:28px}
.op-page.op-tier-3 .op-company{font-size:12.5px}
.op-page.op-tier-3 .op-product{font-size:9.5px}
.op-page.op-tier-3 .op-tagline{font-size:7.5px}
.op-page.op-tier-3 .op-inner{gap:5px}
.op-page.op-tier-3 .op-heading{font-size:8.5px}
.op-page.op-tier-3 .op-body{font-size:8px;margin-bottom:3px}
.op-page.op-tier-3 .op-item-desc{font-size:7px}
.op-page.op-tier-3 .op-shot-img{height:58px}
.op-page.op-tier-3 .op-cta-heading{font-size:10.5px}
.op-page.op-tier-3 .op-cta-sub{font-size:8px}
"""

# Runs client-side, in the real Chromium page that becomes the PDF —
# tries each tier against the real rendered content, keeps the first
# one that fits, and flags completion so render_document_pdf() can
# wait for it before calling page.pdf().
_ONEPAGE_FIT_SCRIPT = f"""<script>
(function(){{
  var page = document.querySelector('.op-page');
  var inner = document.querySelector('.op-inner');
  if (!page || !inner) {{ document.documentElement.setAttribute('data-op-fit','done'); return; }}
  var TIERS = {_ONEPAGE_TIER_COUNT};
  var chosen = TIERS - 1;
  for (var i = 0; i < TIERS; i++) {{
    page.className = 'op-page op-tier-' + i;
    if (inner.scrollHeight <= inner.clientHeight + 1) {{ chosen = i; break; }}
  }}
  page.className = 'op-page op-tier-' + chosen;
  document.documentElement.setAttribute('data-op-fit', 'done');
}})();
</script>"""


def _sec_onepage_header(data: dict, colors: dict, template: str = "classic") -> str:
    logo_tag = _flyer_image_tag(data.get("logo_base64", ""), "op-logo")
    product_name = data.get("product_name", "")
    tagline = data.get("brand_tagline", "")
    company = _esc(data.get("company_name", "Your Company"))
    if template == "modern":
        # Matches the Live Preview's cover exactly: company + tagline row,
        # big WHITE product name (not accent), the overview paragraph
        # inside the same dark banner, then the category tag — instead
        # of an accent-colored product name/category with the overview
        # rendered as a separate plain paragraph outside the banner.
        category = data.get("product_category", "")
        overview = (data.get("product_overview") or "").strip()
        return f"""<div class="op-header" style="background:{colors['background']};border-radius:12px;padding:14px 16px;color:#fff;border-bottom:none;flex-direction:column;align-items:flex-start;gap:0">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%">
    <div style="display:flex;align-items:center;gap:8px">{logo_tag}<span class="op-company" style="color:#fff">{company}</span></div>
    {f'<span class="op-tagline" style="color:rgba(255,255,255,.55)">{_esc(tagline)}</span>' if tagline else ''}
  </div>
  {f'<div class="op-product" style="color:#fff;font-size:22px;font-weight:900;margin-top:10px">{_esc(product_name)}</div>' if product_name else ''}
  {f'<div class="op-body" style="color:rgba(255,255,255,.72);margin-top:6px;margin-bottom:0">{_esc(overview)}</div>' if overview else ''}
  {f'<div class="op-tagline" style="color:rgba(255,255,255,.55);margin-top:4px">{_esc(category)}</div>' if category else ''}
</div>"""
    return f"""<div class="op-header">
  {logo_tag}
  <div>
    <div class="op-company">{company}</div>
    {f'<div class="op-product" style="color:{colors["accent"]}">{_esc(product_name)}</div>' if product_name else ''}
    {f'<div class="op-tagline">{_esc(tagline)}</div>' if tagline else ''}
  </div>
</div>"""


def _sec_onepage_overview(data: dict, template: str = "classic") -> str:
    # Modern folds the overview into the header banner itself (see
    # _sec_onepage_header) so it isn't rendered twice as a separate block.
    if template == "modern":
        return ""
    overview = (data.get("product_overview") or "").strip()
    return f'<p class="op-body">{_esc(overview)}</p>' if overview else ""


def _sec_onepage_problem_solution(data: dict, colors: dict, template: str = "classic") -> str:
    problem = data.get("problem_statement", "")
    solution = data.get("solution_statement", "")
    if not (problem or solution):
        return ""
    if template == "modern":
        cells = ""
        if problem:
            cells += f'''<div style="flex:1;background:{colors['accent']}14;border-radius:8px;padding:8px 10px">
  <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:{colors['accent']};margin-bottom:3px">The Problem</div>
  <div class="op-item-desc">{_esc(problem)}</div>
</div>'''
        if solution:
            cells += f'''<div style="flex:1;background:#f9fafb;border-radius:8px;padding:8px 10px">
  <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:3px">Our Solution</div>
  <div class="op-item-desc">{_esc(solution)}</div>
</div>'''
        return f'<div class="op-block" style="display:flex;gap:8px">{cells}</div>'
    parts = []
    if problem:
        parts.append(f'<p class="op-body"><strong style="color:{colors["accent"]}">Problem: </strong>{_esc(problem)}</p>')
    if solution:
        parts.append(f'<p class="op-body"><strong style="color:{colors["accent"]}">Solution: </strong>{_esc(solution)}</p>')
    return f'<div class="op-block">{"".join(parts)}</div>'


def _sec_onepage_grid(items: list, heading: str, colors: dict, limit: int, template: str = "classic") -> str:
    items = [i for i in items if (i.get("title") or "").strip()][:limit]
    if not items:
        return ""
    if template == "modern":
        cells = "".join(
            f'''<div class="op-item" style="display:flex;align-items:flex-start;gap:8px">
  <span style="flex-shrink:0;width:20px;height:20px;border-radius:6px;background:{colors['accent']}22;color:{colors['accent']};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700">&#10022;</span>
  <span style="min-width:0">
    <span class="op-item-title" style="display:block">{_esc(i.get('title',''))}</span>
    {f'<span class="op-item-desc" style="display:block">{_esc(i.get("description",""))}</span>' if i.get('description') else ''}
  </span>
</div>''' for i in items
        )
    else:
        cells = "".join(
            f'''<div class="op-item">
  <div class="op-item-title">{_esc(i.get('title',''))}</div>
  {f'<div class="op-item-desc">{_esc(i.get("description",""))}</div>' if i.get('description') else ''}
</div>''' for i in items
        )
    return f"""<div class="op-block">
  <div class="op-heading" style="color:{colors['accent']}">{_esc(heading)}</div>
  <div class="op-grid">{cells}</div>
</div>"""


def _sec_onepage_screenshot(shots: list) -> str:
    """Exactly the top 1 screenshot — never more — matching the
    priority list's '1 Screenshot' slot."""
    shots = [s for s in shots if s.get("image_base64")]
    if not shots:
        return ""
    top = shots[0]
    cap = top.get("caption", "")
    return f"""<div class="op-block">
  {_flyer_image_tag(top.get('image_base64',''), 'op-shot-img')}
  {f'<p class="op-shot-cap">{_esc(cap)}</p>' if cap else ''}
</div>"""


def _sec_onepage_benefits_why_modern(data: dict, colors: dict) -> str:
    """Modern only: Benefits and Why-Choose-Us side by side, each a
    single-column icon-badge list — matches the Live Preview's 'Key
    Benefits / Why Choose Us' two-column layout exactly, instead of two
    separate full-width 2-column grids stacked one after another."""
    benefits = [b for b in data.get("benefits", []) if (b.get("title") or "").strip()][:4]
    why = [w for w in data.get("why_choose_us", []) if (w.get("title") or "").strip()][:3]
    if not benefits and not why:
        return ""

    def _col(items, heading):
        if not items:
            return ""
        rows = "".join(
            f'''<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px">
  <span style="flex-shrink:0;width:20px;height:20px;border-radius:6px;background:{colors['accent']}22;color:{colors['accent']};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700">&#10022;</span>
  <span style="min-width:0">
    <span class="op-item-title" style="display:block">{_esc(i.get('title',''))}</span>
    {f'<span class="op-item-desc" style="display:block">{_esc(i.get("description",""))}</span>' if i.get('description') else ''}
  </span>
</div>''' for i in items
        )
        return f'''<div style="flex:1;min-width:0">
  <div class="op-heading" style="color:{colors['accent']}">{_esc(heading)}</div>
  {rows}
</div>'''

    return f'''<div class="op-block" style="display:flex;gap:16px">
  {_col(benefits, "Key Benefits")}
  {_col(why, "Why Choose Us")}
</div>'''


def _sec_onepage_pricing(data: dict, colors: dict) -> str:
    """Top 3 pricing plans — capped, same 'never more than N' philosophy
    as the other One Page sections, so it can't blow past a single page."""
    if not data.get("pricing_enabled") or not data.get("pricing_plans"):
        return ""
    plans = [p for p in data["pricing_plans"] if (p.get("name") or "").strip()][:3]
    if not plans:
        return ""
    cards = "".join(
        f'''<div style="flex:1;border-radius:8px;padding:7px 9px;{"border:2px solid " + colors["accent"] if p.get("highlighted") else "border:1px solid #e5e7eb"}">
  <div class="op-item-title">{_esc(p.get('name',''))}</div>
  <div style="font-size:12.5px;font-weight:900;color:{colors['accent']}">{_esc(p.get('price',''))}<span style="font-size:8px;font-weight:500;color:#9ca3af;margin-left:2px">{_esc(p.get('period',''))}</span></div>
</div>''' for p in plans
    )
    return f"""<div class="op-block">
  <div class="op-heading" style="color:{colors['accent']}">Pricing</div>
  <div style="display:flex;gap:8px">{cards}</div>
</div>"""


def _sec_onepage_testimonials(items: list, colors: dict) -> str:
    """Top 2 testimonials — capped for the same reason as pricing above."""
    items = [t for t in items if (t.get("quote") or "").strip()][:2]
    if not items:
        return ""
    cards = "".join(
        f'''<div style="border-left:2px solid {colors['accent']};padding:2px 0 2px 8px;margin-bottom:6px">
  <div class="op-item-desc" style="font-style:italic">&ldquo;{_esc(t.get('quote',''))}&rdquo;</div>
  <div style="font-size:9px;font-weight:700;color:#111827;margin-top:2px">{_esc(t.get('author',''))}{f" — {_esc(t.get('role',''))}" if t.get('role') else ''}</div>
</div>''' for t in items
    )
    return f"""<div class="op-block">
  <div class="op-heading" style="color:{colors['accent']}">Testimonials</div>
  {cards}
</div>"""


def _sec_onepage_contact(data: dict, colors: dict, template: str = "classic") -> str:
    icons = {"Phone": "&#9742;", "Email": "&#9993;", "Web": "&#127760;", "Address": "&#128205;"}
    rows = ""
    for label, value in (("Phone", data.get("phone", "")), ("Email", data.get("email", "")),
                          ("Web", data.get("website", "")), ("Address", data.get("address", ""))):
        if value:
            if template == "modern":
                rows += f'''<span style="display:inline-flex;align-items:center;gap:5px">
  <span style="width:16px;height:16px;border-radius:5px;background:{colors['accent']}22;color:{colors['accent']};display:inline-flex;align-items:center;justify-content:center;font-size:9px">{icons[label]}</span>
  {_esc(value)}
</span>'''
            else:
                rows += f'<span><strong>{label}:</strong> {_esc(value)}</span>'
    if not rows:
        return ""
    return f"""<div class="op-block">
  <div class="op-heading" style="color:{colors['accent']}">{'Get In Touch' if template == 'modern' else 'Contact'}</div>
  <div class="op-contacts">{rows}</div>
</div>"""


def _sec_onepage_cta(data: dict, colors: dict, template: str = "classic") -> str:
    if not (data.get("cta_heading") or data.get("cta_subtext")):
        return ""
    subtext = data.get("cta_subtext", "")
    bg = "#0a0a0a" if template == "modern" else colors["background"]
    return f"""<div class="op-cta" style="background:{bg}">
  <div class="op-cta-heading">{_esc(data.get('cta_heading','Ready to get started?'))}</div>
  {f'<div class="op-cta-sub">{_esc(subtext)}</div>' if subtext else ''}
  <span class="op-cta-btn" style="background:{colors['accent']}">{_esc(data.get('cta_button','Get Started'))}</span>
</div>"""


def _build_onepage_flyer(data: dict, colors: dict) -> str:
    """Builds the full <section class="br-page op-page ..."> for the One
    Page Flyer. Always exactly one page — page_count is intentionally
    never consulted here (see _build_flyer_layout). Now honors
    data["template"] ("classic" default, or "modern") — Modern reuses
    the exact same op-* classes/tier CSS so the auto-fit sizing script
    still works identically; only icon badges/colors differ.

    Content order (matches the Live Preview so what you see is what you
    download): Overview -> Problem & Solution -> Top 4 Features -> Top
    4 Benefits -> Top 3 Why Choose Us -> 1 Screenshot -> top 3 Pricing
    plans (if enabled) -> top 2 Testimonials -> Contact -> CTA (pinned
    to the bottom by the auto-fit layout)."""
    template = data.get("template", "classic")
    header = _sec_onepage_header(data, colors, template)
    benefits_why = (
        _sec_onepage_benefits_why_modern(data, colors)
        if template == "modern"
        else _sec_onepage_grid(data.get("benefits", []), "Key Benefits", colors, 4, template)
        + _sec_onepage_grid(data.get("why_choose_us", []), "Why Choose Us", colors, 3, template)
    )
    inner_blocks = "".join([
        _sec_onepage_overview(data, template),
        _sec_onepage_problem_solution(data, colors, template),
        _sec_onepage_grid(data.get("features", []), "Top Features" if template != "modern" else "Key Features", colors, 4, template),
        benefits_why,
        _sec_onepage_screenshot(data.get("screenshots", [])),
        _sec_onepage_pricing(data, colors),
        _sec_onepage_testimonials(data.get("testimonials", []), colors),
        _sec_onepage_contact(data, colors, template),
    ])
    cta = _sec_onepage_cta(data, colors, template)

    return f"""<section class="br-page op-page op-tier-0">
  {header}
  <div class="op-inner">{inner_blocks}</div>
  {cta}
</section>
{_ONEPAGE_FIT_SCRIPT}"""


# ---- Layout-aware page assembly --------------------------------------
# Every layout uses the exact same section renderers above; only page
# size/orientation and how sections are grouped into <section class="br-page">
# blocks (each one a hard page-break) differ.

def _all_sections(data: dict, colors: dict, dense: bool = False) -> list:
    """Returns the ordered list of non-empty content sections, EXCLUDING
    contact/cta — contact + CTA are pinned to the last page inside
    _build_flyer_layout so they never float into the middle of the
    document (see the footer_html handling below).

    dense=True is used when everything (all sections + contact + CTA)
    has to land on a single physical content page: the pricing+
    testimonials page-break-protection wrapper is skipped there, since
    forcing that combined block to "never split" is exactly what was
    pushing it (and Contact/CTA right after it) onto a 3rd physical
    page whenever the two together didn't quite fit in what was left
    of the single content page — leaving a large blank gap above the
    push and Contact stranded near the bottom of that extra page."""
    template = data.get("template", "classic")
    sections = [s for s in [
        _sec_problem_solution_modern(data, colors) if template == "modern" else _sec_problem_solution(data, colors),
        _sec_item_grid(data.get("features", []), "Features" if template != "modern" else "Key Features", colors, template),
        _sec_item_grid(data.get("benefits", []), "Benefits" if template != "modern" else "Key Benefits", colors, template),
        _sec_item_grid(data.get("why_choose_us", []), "Why Choose Us", colors, template),
        _sec_differentiators(data.get("differentiators", []), colors),
        _sec_screenshots(data.get("screenshots", []), colors),
    ] if s]
    # ── pricing + testimonials are glued together (when there's more
    # than one content page to spread across) so _distribute_pages can
    # never split them badly across two pages.
    pricing = _sec_pricing(data, colors)
    testimonials = _sec_testimonials(data.get("testimonials", []), colors)
    if pricing and testimonials:
        sections.append(f'{pricing}{testimonials}' if dense else f'<div class="br-group">{pricing}{testimonials}</div>')
    elif pricing:
        sections.append(pricing)
    elif testimonials:
        sections.append(testimonials)
    return sections


def _distribute_pages(blocks: list, num_pages: int) -> list:
    """Spreads `blocks` (already-rendered section HTML strings) evenly
    across exactly `num_pages` page-chunks (each a list of block
    strings), so the finished document lands on that many content
    pages regardless of how many sections were actually supplied.

    - If there are fewer blocks than pages, some pages come back empty
      (the caller drops those, so the PDF is simply shorter than asked
      — you can't stretch zero content across 10 pages).
    - If there are more blocks than pages, extra blocks stack onto the
      earlier pages (earlier pages absorb the remainder) so no content
      is ever dropped.
    """
    num_pages = max(1, num_pages)
    if not blocks:
        return [[] for _ in range(num_pages)]
    base, remainder = divmod(len(blocks), num_pages)
    pages, i = [], 0
    for p in range(num_pages):
        take = base + (1 if p < remainder else 0)
        take = max(take, 1) if i < len(blocks) else 0
        pages.append(blocks[i:i + take])
        i += take
    return pages


def _paginate(blocks: list, per_page: int, page_class: str = "br-page") -> str:
    pages = []
    for i in range(0, len(blocks), per_page):
        chunk = "".join(blocks[i:i + per_page])
        pages.append(f'<section class="{page_class}">{chunk}</section>')
    return "".join(pages)


def _paginate_to_count(blocks: list, num_pages: int, page_class: str = "br-page") -> str:
    """Like _paginate, but targets an exact page count instead of a
    fixed per_page size — used whenever the caller passed page_count."""
    chunks = _distribute_pages(blocks, num_pages)
    return "".join(
        f'<section class="{page_class}">{"".join(chunk)}</section>'
        for chunk in chunks if chunk
    )


def _build_flyer_layout(layout: str, data: dict, colors: dict) -> tuple:
    """Returns (body_html, landscape: bool) for the requested layout.
    If data["page_count"] is set, it overrides each layout's default
    section density so the finished PDF lands on that many total pages
    (cover included) — see _distribute_pages().

    onePage is the one exception: it ALWAYS renders exactly one page
    via its own dedicated engine (_build_onepage_flyer), regardless of
    page_count — a literal single-page flyer, never a squeezed-down
    multi-page flyer and never spread across a cover + section
    pages. Pick any other layout for a real multi-page document.

    IMPORTANT: for biFold/triFold, the cover panel gets its fair share
    of the leading sections too (below the logo/tagline) instead of
    being left mostly blank while every other panel gets overloaded —
    that overloading was also why later sections like Screenshots
    could end up squeezed off-page.
    """
    page_count = data.get("page_count")
    content_pages = max(1, page_count - 1) if page_count else None

    if layout == "onePage":
        return _build_onepage_flyer(data, colors), False

    cover = _sec_cover(data, colors)
    sections = _all_sections(data, colors)
    # Contact + CTA are rendered ONLY on the last page (see the `is_last`
    # checks below) instead of being one more section that could land
    # mid-document — a flyer's call-to-action belongs on the final page.
    footer_html = _sec_contact_cta(data, colors)

    if layout in ("biFold", "triFold"):
        # Landscape A4, split into panels that mirror a physical fold.
        # Default panel count comes from the fold (2 or 3); page_count,
        # if given, overrides it so you can ask for a longer landscape
        # spread than the literal fold implies. The cover panel now
        # takes the first share of sections too (rendered below the
        # logo/tagline) so no panel — including the cover one — sits
        # empty while another is overloaded.
        panels = content_pages + 1 if content_pages else (2 if layout == "biFold" else 3)
        chunks = _distribute_pages(sections, panels)
        panel_pages = []
        for i, chunk in enumerate(chunks):
            is_last = (i == len(chunks) - 1)
            inner = f'{cover}{"".join(chunk)}' if i == 0 else "".join(chunk)
            if is_last and footer_html:
                inner += footer_html
            panel_pages.append(f'<section class="br-page br-panel">{inner}</section>')
        return "".join(panel_pages), True

    if layout == "catalogue":
        # Cover, then screenshot-forward pages (product catalogue reads
        # as a lookbook — bigger imagery, one or two sections per page
        # by default, or however many page_count calls for).
        num_pages = content_pages if content_pages else max(1, -(-len(sections) // 2))
        if num_pages == 1:
            # Everything (sections + contact + CTA) has to fit on the
            # ONE physical content page this leaves — dense mode so it
            # reliably does, instead of overflowing onto a 3rd page.
            dense_sections = _all_sections(data, colors, dense=True)
            inner = "".join(dense_sections) + footer_html
            return cover + f'<section class="br-page br-page-dense">{inner}</section>', False
        chunks = _distribute_pages(sections, num_pages)
        pages = []
        for i, chunk in enumerate(chunks):
            is_last = (i == len(chunks) - 1)
            inner = "".join(chunk)
            if is_last and footer_html:
                inner += footer_html
            pages.append(f'<section class="br-page">{inner}</section>')
        return cover + "".join(pages), False

    if layout == "companyProfile":
        # Narrative, text-forward company profile: cover, then one
        # section per page by default so each topic reads like a
        # profile chapter — or however many page_count calls for.
        num_pages = content_pages if content_pages else max(1, len(sections))
        if num_pages == 1:
            # Same dense single-content-page fix as catalogue above —
            # this is what "Two Page" (cover + 1 content page) maps to.
            dense_sections = _all_sections(data, colors, dense=True)
            inner = "".join(dense_sections) + footer_html
            return cover + f'<section class="br-page br-page-dense">{inner}</section>', False
        chunks = _distribute_pages(sections, num_pages)
        pages = []
        for i, chunk in enumerate(chunks):
            is_last = (i == len(chunks) - 1)
            inner = "".join(chunk)
            if is_last and footer_html:
                inner += footer_html
            pages.append(f'<section class="br-page">{inner}</section>')
        return cover + "".join(pages), False

    # Fallback — same as onePage, single dense page with everything
    # (including the footer) on it.
    inner = "".join(sections)
    if footer_html:
        inner += footer_html
    body = f'<section class="br-page br-page-dense" style="background:{colors["background"]}">{cover}{inner}</section>'
    return body, False


# ---- Full HTML document (CSS + header/footer + pages) ----------------

def build_flyer_html(data: dict) -> str:
    layout = data.get("layout") if data.get("layout") in ALLOWED_FLYER_LAYOUTS else "onePage"
    theme  = data.get("theme") or {}
    colors = _flyer_theme_colors(theme)
    company = data.get("company_name", "Flyer")
    page_size = "A4 landscape" if layout in ("biFold", "triFold") else "A4"

    body, landscape = _build_flyer_layout(layout, data, colors)

    css = f"""*,*::before,*::after{{box-sizing:border-box;margin:0;padding:0}}
@page{{size:{page_size};margin:16mm 14mm}}
body{{font-family:{colors['font']};color:#111827;background:#fff;font-size:12.5px;line-height:1.6}}
.br-page{{position:relative;page-break-after:always;page-break-inside:avoid;min-height:calc(297mm - 32mm)}}
.br-group{{page-break-inside:avoid}}
.br-page:last-child{{page-break-after:auto}}
.br-panel{{min-height:calc(210mm - 28mm)}}
.br-page::after{{content:"{_esc(company)}";position:absolute;bottom:-10mm;left:0;font-size:8.5px;color:#9ca3af;letter-spacing:1px;text-transform:uppercase}}
.br-page::before{{content:"";position:absolute;bottom:-10mm;right:0;font-size:8.5px;color:#9ca3af}}
.br-cover{{color:#fff;display:flex;align-items:center;justify-content:center;min-height:calc(297mm - 32mm)}}
.br-cover-inner{{max-width:520px;text-align:center;padding:20px}}
.br-logo{{width:80px;height:80px;object-fit:cover;margin:0 auto 18px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:14px}}
.br-eyebrow{{font-size:11px;font-weight:700;letter-spacing:4px;text-transform:uppercase;opacity:.7;margin-bottom:14px}}
.br-cover-title{{font-size:34px;font-weight:900;letter-spacing:-.5px;line-height:1.1;margin-bottom:10px}}
.br-cover-sub{{font-size:14px;opacity:.8;margin-bottom:22px}}
.br-cover-product{{display:inline-block;font-size:13px;font-weight:700;padding:8px 20px;border-radius:999px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.3)}}
.br-page-dense{{padding:10mm;border-radius:{colors['radius']}px}}
.br-page-dense .br-block{{margin-top:10px}}
.br-page-dense .br-heading{{font-size:13px}}
.br-page-dense .br-body,.br-page-dense .br-item-desc{{font-size:10.5px}}
.br-block{{margin:0 0 20px;padding:18px 0}}
.br-heading{{font-size:17px;font-weight:800;margin-bottom:10px;letter-spacing:-.2px}}
.br-body{{font-size:12.5px;color:#374151;text-align:justify;margin-bottom:10px}}
.br-grid{{display:grid;grid-template-columns:1fr 1fr;gap:14px}}
.br-item{{border:1px solid #eef0f3;border-radius:10px;padding:12px 14px}}
.br-item-dot{{width:8px;height:8px;border-radius:50%;margin-bottom:8px}}
.br-item-icon-wrap{{width:38px;height:38px;border-radius:50%;border:2px solid;display:flex;align-items:center;justify-content:center;margin-bottom:8px;overflow:hidden}}
.br-item-icon{{width:22px;height:22px;object-fit:contain}}
.br-item-title{{font-size:12.5px;font-weight:700;color:#111827;margin-bottom:4px}}
.br-item-desc{{font-size:11px;color:#6b7280;line-height:1.55}}
.br-diff-list{{display:flex;flex-direction:column;gap:8px}}
.br-diff-row{{display:flex;align-items:flex-start;gap:10px}}
.br-diff-num{{flex:0 0 auto;width:20px;height:20px;border-radius:50%;color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-top:1px}}
.br-diff-text{{font-size:11.5px;color:#374151;line-height:1.5}}
.br-shot-grid{{display:grid;grid-template-columns:1fr 1fr;gap:14px}}
.br-shot{{border:1px solid #eef0f3;border-radius:10px;overflow:hidden}}
.br-shot-img{{width:100%;height:150px;object-fit:cover;display:block}}
.br-shot-cap{{font-size:10px;color:#6b7280;text-align:center;padding:6px}}
.br-plans{{display:flex;gap:14px}}
.br-plan{{flex:1;border-radius:12px;padding:18px;position:relative}}
.br-plan-badge{{position:absolute;top:-10px;left:50%;transform:translateX(-50%);color:#fff;font-size:9px;font-weight:700;padding:3px 10px;border-radius:999px}}
.br-plan-name{{font-size:13px;font-weight:700;margin-bottom:6px}}
.br-plan-price{{font-size:22px;font-weight:900;margin-bottom:10px}}
.br-plan-period{{font-size:11px;font-weight:500;color:#9ca3af;margin-left:4px}}
.br-plan-feats{{list-style:none;font-size:11px;color:#4b5563;display:flex;flex-direction:column;gap:6px}}
.br-quotes{{display:flex;flex-direction:column;gap:14px}}
.br-quote-card{{border-left:3px solid #eef0f3;padding:6px 0 6px 16px}}
.br-quote-mark{{font-size:26px;font-weight:900;line-height:.5}}
.br-quote-text{{font-size:12px;color:#374151;font-style:italic;margin:6px 0}}
.br-quote-author{{font-size:11.5px;font-weight:700;color:#111827}}
.br-quote-role{{font-size:10.5px;color:#9ca3af}}
.br-contacts{{display:flex;flex-direction:column;gap:8px}}
.br-contact-row{{font-size:12px;color:#374151}}
.br-contact-label{{display:inline-block;width:70px;font-weight:700;color:#111827}}
.br-cta{{margin-top:16px;border-radius:{colors['radius']}px;padding:26px;color:#fff;text-align:center}}
.br-cta-heading{{font-size:18px;font-weight:800;margin-bottom:6px}}
.br-cta-sub{{font-size:12px;opacity:.8;margin-bottom:16px}}
.br-cta-btn{{display:inline-block;padding:9px 24px;border-radius:999px;font-size:12px;font-weight:700}}"""

    # The One Page Flyer's tier CSS is appended only for that layout —
    # it's a fully independent stylesheet (op-* classes never collide
    # with the shared br-* rules above) so it never affects the other
    # four layouts.
    if layout == "onePage":
        css += _ONEPAGE_CSS

    # Modern template CSS — brm-* classes, independent of the br-*
    # classic rules above, so switching templates never affects the
    # Classic design. Doesn't apply to layout="onePage" (see the
    # FlyerRequest.template docstring) since that keeps its own
    # dedicated engine regardless of template.
    if data.get("template") == "modern" and layout != "onePage":
        css += f"""
.brm-cover{{color:#fff;padding:40px 36px;min-height:calc(297mm - 32mm);position:relative;overflow:hidden}}
.brm-cover-topbar{{display:flex;align-items:center;gap:10px}}
.brm-logo{{width:32px;height:32px;object-fit:cover;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:8px}}
.brm-cover-company{{font-weight:800;font-size:13px}}
.brm-cover-tagline{{margin-left:auto;font-size:11px;color:rgba(255,255,255,.6)}}
.brm-cover-title{{font-weight:900;font-size:34px;margin-top:26px;line-height:1.1}}
.brm-cover-category{{font-weight:800;font-size:13px;color:{colors['accent']};margin-top:6px}}
.brm-cover-overview{{font-size:12.5px;color:rgba(255,255,255,.75);margin-top:10px;max-width:420px;line-height:1.6}}
.brm-block{{margin:0 0 20px}}
.brm-heading{{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px}}
.brm-ps-grid{{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px}}
.brm-ps-card{{border-radius:12px;padding:16px}}
.brm-ps-solution{{background:#f9fafb}}
.brm-ps-label{{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;color:#6b7280}}
.brm-ps-text{{font-size:11.5px;color:#374151;line-height:1.6}}
.brm-grid{{display:grid;grid-template-columns:1fr 1fr;gap:14px}}
.brm-item{{display:flex;align-items:flex-start;gap:10px}}
.brm-item-badge{{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px;font-weight:700}}
.brm-item-icon{{width:18px;height:18px;object-fit:contain}}
.brm-item-title{{font-size:12px;font-weight:700;color:#111827}}
.brm-item-desc{{font-size:10.5px;color:#6b7280;line-height:1.5;margin-top:2px}}
.brm-contact-grid{{display:grid;grid-template-columns:1fr 1fr;gap:12px}}
.brm-contact-item{{display:flex;align-items:center;gap:10px;font-size:11.5px;color:#374151}}
.brm-contact-badge{{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px}}
.brm-cta{{margin-top:16px;border-radius:{colors['radius']}px;padding:22px 26px;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:space-between;gap:16px}}
.brm-cta-heading{{font-size:15px;font-weight:800}}
.brm-cta-sub{{font-size:11px;color:#9ca3af;margin-top:3px}}
.brm-cta-btn{{flex-shrink:0;display:inline-block;padding:9px 20px;border-radius:999px;font-size:11.5px;font-weight:700;color:#fff}}
"""

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>{_esc(company)} Flyer</title>
<style>{css}</style></head>
<body>{body}</body></html>"""


# ---- AI Content Generator ---------------------------------------------
# Same two-path pattern as the AI Theme Generator: Anthropic if
# available, otherwise a heuristic template that still produces
# complete, editable draft copy for every section.

_FLYER_CONTENT_SYSTEM_PROMPT_TEMPLATE = """You are a professional B2B marketing copywriter drafting flyer content for a real company. You output ONLY a JSON object, no prose, no markdown fences.

Ground rules for genuine, non-generic copy:
- Every description must say something CONCRETE and SPECIFIC about what that feature/benefit actually does for this exact product/industry — not vague filler like "streamlines your workflow" with nothing underneath it. Name the actual mechanism (what it tracks, automates, calculates, displays, or prevents).
- Do not repeat the same sentence structure across items — vary phrasing the way a human copywriter would.
- Titles are short (2-5 words) and read like real product feature names, not marketing platitudes.
- Never invent specific customer names, dollar figures, or statistics that weren't given to you.

Given a company name, product name, industry, and optional website, draft complete flyer copy. Return strictly this JSON shape:
{{
  "brand_tagline": string (short, punchy, <= 12 words),
  "product_overview": string (2-3 sentences),
  "problem_statement": string (2-3 sentences describing the customer pain point),
  "solution_statement": string (2-3 sentences describing how the product solves it),
  "features": [{{"title": string, "description": string}}]  ({features_count} items, each a genuinely distinct capability),
  "benefits": [{{"title": string, "description": string}}]  ({benefits_count} items, each a distinct outcome for the customer, not a restatement of a feature),
  "why_choose_us": [{{"title": string, "description": string}}]  ({why_count} items),
  "differentiators": [string]  ({diff_count} short one-line bullets, each a specific, concrete claim -- e.g. "Available on web, tablet, and set-top box" style, not vague praise),
  "cta_heading": string,
  "cta_subtext": string
}}

The flyer will span roughly {page_count} pages, so give this list enough real, non-repetitive substance to fill it -- do not pad with filler if you can't; write exactly the requested number of specific, genuine items."""


def _content_item_counts(page_count: int | None) -> dict:
    """Scales how many features/benefits/why_choose_us/differentiators
    get drafted based on the requested page_count, so a 10-page ask
    doesn't come back with the same thin 4-item lists as a 1-pager."""
    pc = page_count or 6
    return {
        "features_count": min(24, max(4, pc + 2)),
        "benefits_count": min(24, max(4, pc + 1)),
        "why_count":      min(12, max(3, pc // 2 + 2)),
        "diff_count":     min(30, max(6, pc * 2)),
    }


def _heuristic_flyer_content(company_name: str, product_name: str, industry: str, page_count: int | None = None) -> dict:
    ind = industry.strip() or "your industry"
    counts = _content_item_counts(page_count)

    features_pool = [
        {"title": "Centralized Dashboard", "description": "See everything that matters in one clean, real-time view."},
        {"title": "Smart Automation", "description": "Automate repetitive tasks so your team can focus on higher-value work."},
        {"title": "Secure Access", "description": "Role-based permissions keep the right data with the right people."},
        {"title": "Actionable Insights", "description": "Reports and analytics that turn raw data into clear next steps."},
        {"title": "Custom Workflows", "description": "Configure the exact steps your team follows, without touching code."},
        {"title": "Mobile Access", "description": f"Manage {ind} operations from a phone, tablet, or desktop, wherever you are."},
        {"title": "Audit Trail", "description": "Every change is logged and timestamped for accountability and compliance."},
        {"title": "Bulk Import & Export", "description": "Move existing data in and reporting data out without manual re-entry."},
        {"title": "Notifications & Alerts", "description": "Get flagged the moment something needs attention, instead of finding out late."},
        {"title": "Multi-User Collaboration", "description": "Multiple team members can work in the system at once without stepping on each other."},
        {"title": "Custom Reports", "description": "Build the exact report your stakeholders ask for, on demand."},
        {"title": "API & Integrations", "description": "Connect with the other tools your team already relies on."},
    ]
    benefits_pool = [
        {"title": "Save Time", "description": "Cut manual work and free up hours every week."},
        {"title": "Reduce Errors", "description": "Fewer manual steps means fewer costly mistakes."},
        {"title": "Scale Easily", "description": "Grows with your team without adding operational overhead."},
        {"title": "Better Decisions", "description": "Real-time data means faster, more confident calls."},
        {"title": "Lower Costs", "description": "Less time on admin work translates directly into lower operating costs."},
        {"title": "Faster Onboarding", "description": "New team members get productive in days, not weeks."},
        {"title": "Improved Visibility", "description": "Leadership can see what's actually happening without asking around."},
        {"title": "Stronger Compliance", "description": "Built-in tracking makes audits and reviews far less painful."},
    ]
    why_pool = [
        {"title": "Proven in the field", "description": f"Trusted by teams across {ind} to run critical workflows."},
        {"title": "Dedicated support", "description": "A team that's there when you need help, not just at sign-up."},
        {"title": "Built to last", "description": "Reliable, secure, and continuously improved."},
        {"title": "Transparent pricing", "description": "No hidden fees or surprise upsells down the line."},
        {"title": "Fast implementation", "description": "Up and running in days, not months."},
    ]
    diff_pool = [
        f"Available on both online and offline modes, on web, tablet, mobile, and desktop.",
        f"Full customization for multiple {ind} teams or locations in a single database.",
        "Modular approach — turn on only the pieces you actually need.",
        "Role-based dashboards for every level, from front-line staff to leadership.",
        "Cloud-based scaling — add users without added operational cost.",
        "Data can be sliced and reviewed at every level, with usage capture built in.",
        "Access from anywhere, with logins scoped to each person's role.",
        "Responsive design across mobile, tablet, and desktop.",
        f"Purpose-built for the day-to-day realities of {ind}, not a generic template.",
        "Regular updates driven directly by customer feedback.",
    ]

    def _cycle(pool, n):
        out = []
        i = 0
        while len(out) < n:
            out.append(pool[i % len(pool)])
            i += 1
        return out

    return {
        "brand_tagline": f"Empowering {ind} with smarter technology",
        "product_overview": (
            f"{product_name} by {company_name} is a modern solution built for teams in {ind}. "
            f"It brings together the tools organizations need to work faster, reduce manual effort, "
            f"and make better decisions every day."
        ),
        "problem_statement": (
            f"Teams in {ind} often struggle with scattered tools, manual processes, and limited visibility "
            f"into what's actually happening day to day. This slows decisions and creates avoidable errors."
        ),
        "solution_statement": (
            f"{product_name} brings everything into one place — automating routine work, surfacing the "
            f"insights that matter, and giving teams a single reliable system to work from."
        ),
        "features": _cycle(features_pool, counts["features_count"]),
        "benefits": _cycle(benefits_pool, counts["benefits_count"]),
        "why_choose_us": _cycle(why_pool, counts["why_count"]),
        "differentiators": _cycle(diff_pool, counts["diff_count"]),
        "cta_heading": f"Ready to see {product_name} in action?",
        "cta_subtext": f"Get in touch and we'll show you how {company_name} can help your team today.",
    }


# ---- AI Content Generator: Gemini (tried first, no AWS) -------------
# Same two-key-rotator idea used elsewhere for multi-key setups: if the
# caller has more than one Gemini key (GEMINI_API_KEYS, comma-separated,
# or GEMINI_API_KEY / GEMINI_API_KEY_1.._19), this rotates across them
# and backs off a key for 60s once it looks rate-limited/quota-exhausted,
# instead of hard-failing the whole request on one bad key.

class KeyRotator:
    def __init__(self, keys: list, name: str):
        self.keys = keys
        self.name = name
        self._index = 0
        self._exhausted = {}
        logger.info(f"{name} KeyRotator: {len(keys)} keys ready")

    def get_key(self) -> str:
        now = time.time()
        for _ in range(len(self.keys)):
            key = self.keys[self._index % len(self.keys)]
            self._index += 1
            if now - self._exhausted.get(key, 0) > 60:
                return key
        oldest = min(self._exhausted, key=lambda k: self._exhausted[k])
        wait = 60 - (now - self._exhausted[oldest])
        if wait > 0:
            logger.warning(f"{self.name}: all keys exhausted, waiting {wait:.0f}s...")
            time.sleep(wait + 2)
        self._exhausted.pop(oldest, None)
        return oldest

    def mark_exhausted(self, key: str):
        self._exhausted[key] = time.time()
        logger.warning(f"{self.name}: key exhausted — {len(self._exhausted)}/{len(self.keys)}")

    @classmethod
    def from_env(cls, env_multi: str, env_single: str, name: str) -> "KeyRotator":
        keys = []
        multi = os.environ.get(env_multi, "")
        if multi:
            keys += [k.strip() for k in multi.split(",") if k.strip()]
        for i in range(1, 20):
            k = os.environ.get(f"{env_single}_{i}", "")
            if k.strip() and k.strip() not in keys:
                keys.append(k.strip())
        single = os.environ.get(env_single, "")
        if single.strip() and single.strip() not in keys:
            keys.append(single.strip())
        if not keys:
            raise EnvironmentError(f"{name}: no keys found — set {env_single}")
        return cls(keys, name)


def _call_gemini_json(prompt: str, rotator: "KeyRotator") -> dict:
    import google.generativeai as genai
    max_attempts = len(rotator.keys) * 2 + 3
    last_error = None
    for attempt in range(max_attempts):
        key = rotator.get_key()
        try:
            genai.configure(api_key=key)
            model = genai.GenerativeModel("gemini-2.5-flash-lite")
            response = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.35, max_output_tokens=8192,
                ),
            )
            raw = response.text.strip()
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)
            return json.loads(raw)
        except json.JSONDecodeError as e:
            last_error = e
            logger.warning(f"Gemini attempt {attempt + 1}: JSON error — {e}")
            time.sleep(2)
        except Exception as e:
            last_error = e
            err = str(e)
            if "429" in err or "quota" in err.lower() or "rate" in err.lower():
                rotator.mark_exhausted(key)
            else:
                logger.warning(f"Gemini attempt {attempt + 1}: {e}")
                time.sleep(3)
    raise RuntimeError(f"Gemini failed: {last_error}")


_FLYER_GEMINI_PROMPT = """You are a senior B2B marketing copywriter drafting flyer content.

STRICT RULES:
1. Every description must say something CONCRETE about what that feature/benefit actually does — not vague filler.
2. Titles are short (2-5 words) and read like real product feature names.
3. Do not invent specific customer names, dollar figures, or statistics that weren't given.
4. Return ONLY valid minified JSON — no markdown fences, no commentary.

OUTPUT FORMAT:
{
  "brand_tagline": string (short, punchy, <= 12 words),
  "product_overview": string (2-3 sentences),
  "problem_statement": string (2-3 sentences describing the customer pain point),
  "solution_statement": string (2-3 sentences describing how the product solves it),
  "features": [{"title": string, "description": string}],
  "benefits": [{"title": string, "description": string}],
  "why_choose_us": [{"title": string, "description": string}],
  "differentiators": [string],
  "cta_heading": string,
  "cta_subtext": string
}"""


async def _gemini_flyer_content(company_name: str, product_name: str, industry: str, website: str, page_count: int | None = None) -> dict | None:
    """Tried FIRST by the endpoint (see generate_flyer_content), before
    the Anthropic fallback below. Returns None (never raises) if no
    Gemini key is configured, or if generation fails after retrying
    across all available keys — the caller then falls through to
    Anthropic, then the heuristic template."""
    try:
        rotator = KeyRotator.from_env("GEMINI_API_KEYS", "GEMINI_API_KEY", "Gemini")
    except EnvironmentError:
        return None

    counts = _content_item_counts(page_count)
    prompt = f"""{_FLYER_GEMINI_PROMPT}

COMPANY: {company_name}
PRODUCT: {product_name}
INDUSTRY: {industry or 'general'}
WEBSITE: {website or 'N/A'}

Produce exactly:
- brand_tagline
- product_overview
- problem_statement
- solution_statement
- {counts['features_count']} features
- {counts['benefits_count']} benefits
- {counts['why_count']} why_choose_us items
- {counts['diff_count']} differentiators (short one-liners)
- cta_heading & cta_subtext

Return ONLY the JSON object."""

    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, _call_gemini_json, prompt, rotator)
        return result if isinstance(result, dict) else None
    except Exception as e:
        logger.warning(f"Gemini flyer content failed, falling back: {e}")
        return None


async def _ai_flyer_content(company_name: str, product_name: str, industry: str, website: str, page_count: int | None = None) -> dict | None:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key or anthropic is None:
        return None
    try:
        counts = _content_item_counts(page_count)
        system_prompt = _FLYER_CONTENT_SYSTEM_PROMPT_TEMPLATE.format(
            page_count=page_count or "a handful of",
            **counts,
        )
        client = anthropic.AsyncAnthropic(api_key=api_key)
        user_msg = f"Company: {company_name}\nProduct: {product_name}\nIndustry: {industry or 'general'}"
        if website:
            user_msg += f"\nWebsite: {website}"
        resp = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4000,
            system=system_prompt,
            messages=[{"role": "user", "content": user_msg}],
        )
        raw = "".join(block.text for block in resp.content if getattr(block, "type", "") == "text").strip()
        raw = raw.strip("`")
        if raw[:4].lower() == "json":
            raw = raw[4:].strip()
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else None
    except Exception as e:
        logger.warning(f"AI flyer content failed, falling back to heuristic: {e}")
        return None


# ---- AI Image Generator -------------------------------------------
# Fills the same optional image slots (feature icons, cover hero
# image, screenshots) that the user could otherwise upload into by
# hand — same two-path idea as everything else here: AI if
# OPENAI_API_KEY is set, otherwise the slot is simply left for the
# user to fill in themselves (never a hard failure).

async def _ai_generate_image(prompt: str, purpose: str) -> str | None:
    """Generates one image with OpenAI's image API and returns it as a
    data URL, or None if OPENAI_API_KEY isn't set / the package isn't
    installed / the call fails — callers treat None as 'not available'
    and leave that image slot for the user to upload manually instead."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key or AsyncOpenAI is None:
        return None

    size_by_purpose = {
        "icon":       "1024x1024",
        "hero":       "1536x1024",
        "screenshot": "1536x1024",
    }
    size = size_by_purpose.get(purpose, "1024x1024")

    style_hint = {
        "icon": "simple flat vector icon, single subject, centered, plain background, clean minimal line-and-fill style — no text",
        "hero": "professional wide banner photo or illustration suitable as a flyer cover background — no text overlays",
        "screenshot": "clean modern product UI mockup, realistic screen content — no real brand logos, no text that needs to be legible",
    }.get(purpose, "clean flat vector illustration, no text")

    try:
        client = AsyncOpenAI(api_key=api_key)
        result = await client.images.generate(
            model="gpt-image-1",
            prompt=f"{prompt}. Style: {style_hint}.",
            size=size,
            n=1,
        )
        b64 = result.data[0].b64_json
        return f"data:image/png;base64,{b64}"
    except Exception as e:
        logger.warning(f"AI image generation failed for purpose='{purpose}': {e}")
        return None


# ---- Endpoints ---------------------------------------------------------

@router.post("/generate-flyer", response_model=FlyerResponse)
async def generate_flyer(req: FlyerRequest):
    if req.layout not in ALLOWED_FLYER_LAYOUTS:
        raise HTTPException(422, f"layout must be one of {sorted(ALLOWED_FLYER_LAYOUTS)}")

    job_id = str(uuid.uuid4())[:8]
    slug   = re.sub(r"[^a-z0-9]+", "-", (req.company_name or req.product_name or "flyer").lower())[:40].strip("-") or "flyer"

    logger.info(f"[{job_id}] flyer company='{req.company_name}' layout={req.layout}")

    data = req.model_dump()
    tmp_dir  = tempfile.gettempdir()
    out_path = os.path.join(tmp_dir, f"{slug}-{job_id}.pdf")

    try:
        html = build_flyer_html(data)
        landscape = req.layout in ("biFold", "triFold")
        await render_document_pdf(html, out_path, landscape=landscape, wait_for_fit=(req.layout == "onePage"))
    except Exception as e:
        logger.error(f"[{job_id}] Flyer render error: {e}")
        raise HTTPException(500, f"Flyer generation failed: {e}")

    try:
        s3_key       = f"flyers/{slug}-{job_id}.pdf"
        download_url = save_local_file(out_path, s3_key, content_type="application/pdf")
    except Exception as e:
        logger.error(f"[{job_id}] Flyer save error: {e}")
        raise HTTPException(502, f"Flyer export failed: {e}")
    finally:
        if os.path.exists(out_path):
            os.remove(out_path)

    logger.info(f"[{job_id}] Flyer done!")
    return FlyerResponse(
        success      = True,
        download_url = download_url,
        s3_key       = s3_key,
        job_id       = job_id,
        message      = f"Flyer generated for '{req.company_name}' ({req.layout}, template={req.template})",
    )


@router.post("/api/generate-flyer-content", response_model=FlyerContentResponse)
async def generate_flyer_content(req: FlyerContentRequest):
    # 1) Try Gemini first (works with GEMINI_API_KEY / GEMINI_API_KEYS; no AWS)
    ai_result = await _gemini_flyer_content(req.company_name, req.product_name, req.industry, req.website, req.page_count)
    if ai_result is not None:
        logger.info(f"Gemini flyer content generated for '{req.company_name}' / '{req.product_name}'")
        return FlyerContentResponse(success=True, content=ai_result, source="gemini")

    # 2) Fall back to Anthropic (if ANTHROPIC_API_KEY is configured)
    ai_result = await _ai_flyer_content(req.company_name, req.product_name, req.industry, req.website, req.page_count)
    if ai_result is not None:
        logger.info(f"AI flyer content generated for '{req.company_name}' / '{req.product_name}'")
        return FlyerContentResponse(success=True, content=ai_result, source="ai")

    # 3) Final fallback — built-in heuristic templates (always works)
    content = _heuristic_flyer_content(req.company_name, req.product_name, req.industry, req.page_count)
    logger.info(f"Heuristic flyer content generated for '{req.company_name}' / '{req.product_name}'")
    return FlyerContentResponse(success=True, content=content, source="heuristic")


@router.post("/api/generate-flyer-image", response_model=FlyerImageResponse)
async def generate_flyer_image(req: FlyerImageRequest):
    """On-demand AI image for any image slot in the flyer (feature
    icon, cover hero image, or a screenshot placeholder) — the
    frontend calls this per-slot when the user clicks something like
    "Generate with AI" next to that image field, as an alternative to
    uploading their own file into the exact same field."""
    if AsyncOpenAI is None or not os.environ.get("OPENAI_API_KEY"):
        return FlyerImageResponse(
            success=False,
            message="AI image generation isn't configured — set OPENAI_API_KEY (and `pip install openai`) in the backend's environment. You can still upload your own image for this slot.",
        )
    image = await _ai_generate_image(req.prompt, req.purpose)
    if image is None:
        return FlyerImageResponse(success=False, message="Image generation failed — try again, or upload your own image for this slot.")
    return FlyerImageResponse(success=True, image_base64=image)


# ═══════════════════════════════════════════════════════════════
# APP — runnable on its own as your React project's backend
# ═══════════════════════════════════════════════════════════════

app = FastAPI(title="Feature Card Generator")

# React dev servers commonly run on one of these — add your deployed
# frontend's URL here too once you have one.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",   # Create React App
        "http://127.0.0.1:3000",
        "http://localhost:5173",   # Vite
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

# Serves everything saved into OUTPUT_DIR (by save_local_file above)
# back out at GET /files/<subfolder>/<filename> — this is what
# download_url actually points at now, instead of an S3 bucket.
app.mount("/files", StaticFiles(directory=OUTPUT_DIR), name="files")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("feature_card_generator:app", host="0.0.0.0", port=5000, reload=True)