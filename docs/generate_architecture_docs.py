"""Generate architecture Word (.docx) and PowerPoint (.pptx) for planned-surveys-api."""

from __future__ import annotations

from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt
from pptx import Presentation
from pptx.util import Inches as PInches, Pt as PPt

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = Path(__file__).resolve().parent
DOCX_PATH = OUT_DIR / "Planned-Surveys-API-Architecture.docx"
PPTX_PATH = OUT_DIR / "Planned-Surveys-API-Architecture.pptx"

TODAY = date.today().isoformat()
DOC_VERSION = "1.1"

CODE_EXTENSIONS = {".py", ".js", ".html", ".css", ".bicep", ".sh", ".ps1"}
MARKDOWN_EXTENSIONS = {".md"}
CONFIG_EXTENSIONS = {".yml", ".yaml", ".txt"}
SKIP_DIR_NAMES = {".venv", "__pycache__", ".git", "node_modules"}
BINARY_EXTENSIONS = {".png", ".otf", ".svg", ".woff", ".woff2"}


def _line_count(path: Path) -> int:
    try:
        with path.open(encoding="utf-8", errors="replace") as handle:
            return sum(1 for _ in handle)
    except OSError:
        return 0


def _iter_project_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIR_NAMES for part in path.parts):
            continue
        if path.suffix.lower() in BINARY_EXTENSIONS:
            continue
        files.append(path)
    return files


def collect_code_metrics(root: Path) -> dict[str, object]:
    """Physical line counts (excludes .venv); binaries not counted."""
    source_total = 0
    source_files = 0
    by_folder: dict[str, int] = {}
    by_file: list[tuple[str, int]] = []
    markdown_lines = 0
    config_lines = 0

    for path in _iter_project_files(root):
        ext = path.suffix.lower()
        lines = _line_count(path)
        rel = path.relative_to(root)
        rel_str = rel.as_posix()

        if ext in CODE_EXTENSIONS:
            source_total += lines
            source_files += 1
            folder = rel.parts[0] if len(rel.parts) > 1 else "(root)"
            by_folder[folder] = by_folder.get(folder, 0) + lines
            by_file.append((rel_str, lines))
        elif ext in MARKDOWN_EXTENSIONS:
            markdown_lines += lines
        elif ext in CONFIG_EXTENSIONS:
            config_lines += lines
        elif ext == ".json" and "portal-deploy.json" not in rel_str:
            config_lines += lines

    by_file.sort(key=lambda row: row[1], reverse=True)
    web_share = 0
    if source_total:
        web_share = round(100 * by_folder.get("web", 0) / source_total)

    return {
        "source_total": source_total,
        "source_files": source_files,
        "by_folder": sorted(by_folder.items(), key=lambda row: row[1], reverse=True),
        "top_files": by_file[:10],
        "markdown_lines": markdown_lines,
        "config_lines": config_lines,
        "web_share_pct": web_share,
    }


def _fmt_loc(n: int) -> str:
    return f"{n:,}"


def add_bullet_slide(prs: Presentation, title: str, bullets: list[str]) -> None:
    layout = prs.slide_layouts[1]
    slide = prs.slides.add_slide(layout)
    slide.shapes.title.text = title
    body = slide.placeholders[1].text_frame
    body.clear()
    for i, line in enumerate(bullets):
        p = body.paragraphs[0] if i == 0 else body.add_paragraph()
        p.text = line
        p.level = 0


def add_title_slide(prs: Presentation) -> None:
    slide = prs.slides.add_slide(prs.slide_layouts[0])
    slide.shapes.title.text = "Planned Surveys API"
    slide.placeholders[1].text = (
        "System architecture\n"
        f"WITSML 1.3.1.1 planned trajectory converter\n"
        f"Generated {TODAY}"
    )


def build_pptx(metrics: dict[str, object]) -> None:
    prs = Presentation()
    add_title_slide(prs)
    total = int(metrics["source_total"])
    nfiles = int(metrics["source_files"])
    web_pct = int(metrics["web_share_pct"])

    add_bullet_slide(
        prs,
        "Purpose",
        [
            "Replicates Excel macro Convert_and_Generate_XML_UTF8 (Planned surveys generator, sheet Data row 4+).",
            "Accepts survey stations (MD, incl, azi, TVD, deltas, DLS, displacements) as JSON or pasted text.",
            "Produces Planned_surveys_.xml — WITSML 1.3.1.1 planned trajectory (obj_trajectory schema).",
            "Two delivery models: static browser converter (no login) and secured FastAPI app (SLB OAuth).",
        ],
    )

    add_bullet_slide(
        prs,
        "Deployment topologies",
        [
            "Local: uvicorn/gunicorn on port 8000 — full API + SLB OAuth + web UI.",
            "Azure App Service: Linux Python 3.12, Bicep (infra/main.bicep), gunicorn + UvicornWorker.",
            "Render: render.yaml — free web service, same startup command.",
            "GitHub Pages: static web/ only — no Python, no /api/callback (Actions workflow).",
            "DDH (ddh.apps.slb.com): App Service + Entra Easy Auth; optional ROOT_PATH subpath.",
        ],
    )

    add_bullet_slide(
        prs,
        "Logical architecture (FastAPI host)",
        [
            "Presentation: web/login.html, web/index.html, StaticFiles mount on /",
            "API: FastAPI app.main — routes, Pydantic models, OpenAPI /docs",
            "Auth: app/slb_auth.py (CSI OAuth), app/session_store.py (in-memory sessions)",
            "Guards: app/slb_auth_deps.py — cookie ps_session_id, Bearer, optional SLB_AUTH_REQUIRED",
            "Core: app/witsml.py — normalize N/A → -999.25, build XML UTF-8",
        ],
    )

    add_bullet_slide(
        prs,
        "Repository structure",
        [
            "app/ — Python service (main, witsml, slb_auth, session_store, slb_auth_deps)",
            "web/ — Static UI (index.html converter, login.html, witsml.js client logic)",
            "tests/ — pytest (WITSML, SLB auth, API endpoints)",
            "infra/ — Azure Bicep (main.bicep, portal-deploy.bicep)",
            "scripts/deploy-azure.ps1 — RG + Bicep + zip deploy",
            ".github/workflows — GitHub Pages, Azure deploy, gh-pages branch",
        ],
    )

    add_bullet_slide(
        prs,
        "SLB OAuth 2.0 flow",
        [
            "1. User → GET /login → Sign in → GET /api/auth/login",
            "2. Redirect to CSI (csi.slb.com/v2/auth) with client_id, redirect_uri, state, scope",
            "3. User authenticates at SLB → redirect GET /api/callback?code&state",
            "4. Server validates state, POST token URL, stores tokens in server session",
            "5. Set-Cookie ps_session_id (httponly) → redirect /app",
            "Redirect URI must match SLB app registration (e.g. …azurewebsites.net/api/callback).",
        ],
    )

    add_bullet_slide(
        prs,
        "Session model",
        [
            "Browser holds small cookie ps_session_id — not full JWT (avoids cookie size limits).",
            "Server _sessions dict: session id → access_token, id_token, expires_at (12h TTL cleanup).",
            "Legacy path: slb_* cookies still recognized for older builds.",
            "API clients: Authorization: Bearer <access_token> when SLB_AUTH_REQUIRED=true.",
            "Logout: GET /api/auth/logout clears session and cookies.",
        ],
    )

    add_bullet_slide(
        prs,
        "Data conversion pipeline",
        [
            "Input: JSON POST body { meta, stations[] } or browser paste → witsml.js parse",
            "Columns map Excel B–J: md, incl, azi, tvd, mdDelta, vertSect, dls, dispNs, dispEw",
            "Normalization: null, N/A, empty → -999.25; decimal comma → dot",
            "First station typeTrajStation = tie in point; others = unknown",
            "Output: application/xml attachment Planned_surveys_.xml",
        ],
    )

    add_bullet_slide(
        prs,
        "HTTP routes (FastAPI)",
        [
            "/, /login, /app — UI gating by session",
            "/health — liveness (Azure/Render health checks)",
            "/api/auth/login, /api/callback, /api/auth/me, /api/auth/logout",
            "POST /api/planned-surveys/xml — core generator",
            "/docs — Swagger UI",
        ],
    )

    add_bullet_slide(
        prs,
        "Static vs secured paths",
        [
            "GitHub Pages: witsml.js runs entirely in browser — same XML logic as server path",
            "FastAPI /app: uses API POST when authenticated; serves static assets from web/",
            "GitHub Pages cannot host /api/callback — SLB registration targets Azure/Render/local only",
            "Public share link: worktopublic.github.io/planned-surveys-api/ (no OAuth)",
        ],
    )

    add_bullet_slide(
        prs,
        "Azure infrastructure",
        [
            "Bicep: Microsoft.Web/serverfarms (Linux) + sites (PYTHON|3.12)",
            "Startup: gunicorn -w 2 -k uvicorn.workers.UvicornWorker app.main:app :8000",
            "App settings: WEBSITES_PORT=8000, SCM_DO_BUILD_DURING_DEPLOYMENT, ENABLE_ORYX_BUILD",
            "SKU F1 (free) or B1; httpsOnly; optional system-assigned identity (main.bicep)",
            "Secrets via portal: CLIENT_ID, CLIENT_SECRET, APP_KEY, SLB_REDIRECT_URI",
        ],
    )

    add_bullet_slide(
        prs,
        "CI/CD",
        [
            "github-pages.yml — push main → upload-pages-artifact path web → GitHub Pages",
            "azure-deploy.yml — workflow_dispatch + AZURE_WEBAPP_PUBLISH_PROFILE",
            "deploy-azure.ps1 — az deployment group create + webapp deploy zip",
            "Zip package: app, requirements.txt, startup.sh (script may omit web/ — include for UI)",
        ],
    )

    add_bullet_slide(
        prs,
        "Technology stack",
        [
            "Python 3.12, FastAPI, Uvicorn, Gunicorn, httpx, python-dotenv, Pydantic",
            "Frontend: vanilla HTML/CSS/JS modules (witsml.js)",
            "Auth: SLB CSI OAuth 2.0 authorization code + Basic client auth at token endpoint",
            "Tests: pytest",
            "IaC: Azure Bicep; optional Render blueprint",
        ],
    )

    folder_bullets = [
        f"{name}/ — {_fmt_loc(lines)} lines"
        for name, lines in metrics["by_folder"]  # type: ignore[arg-type]
    ]
    top = metrics["top_files"]  # type: ignore[assignment]
    top_bullets = [f"{name} ({_fmt_loc(lines)} lines)" for name, lines in top[:4]]  # type: ignore[index]

    add_bullet_slide(
        prs,
        "Codebase size",
        [
            f"Source total: {_fmt_loc(total)} lines across {nfiles} files "
            f"(.py, .js, .html, .bicep, .sh, .ps1; excludes .venv and binaries).",
            "By folder: " + "; ".join(folder_bullets[:6]),
            f"~{web_pct}% of source is web/ (witsml.js + index.html — browser/XML parity).",
            "Largest files: " + "; ".join(top_bullets),
            f"Markdown docs: {_fmt_loc(int(metrics['markdown_lines']))} lines | "
            f"CI/config (yml, requirements, etc.): {_fmt_loc(int(metrics['config_lines']))} lines.",
            "Fonts/images (.otf, .png) are assets — not included in line counts.",
        ],
    )

    add_bullet_slide(
        prs,
        "Security considerations",
        [
            "CLIENT_SECRET only on server — never in static Pages bundle",
            "OAuth state parameter (10 min TTL) CSRF protection",
            "SLB_AUTH_REQUIRED gates POST /api/planned-surveys/xml when enabled",
            "Sessions in-memory — single instance; scale-out needs shared session store",
            ".env / Azure app settings — not committed to git",
        ],
    )

    prs.save(PPTX_PATH)


def _doc_heading(doc: Document, text: str, level: int = 1) -> None:
    doc.add_heading(text, level=level)


def _doc_para(doc: Document, text: str, bold: bool = False) -> None:
    p = doc.add_paragraph()
    run = p.add_run(text)
    if bold:
        run.bold = True


def _doc_table(doc: Document, headers: list[str], rows: list[list[str]]) -> None:
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr[i].text = h
    for r_idx, row in enumerate(rows):
        cells = table.rows[r_idx + 1].cells
        for c_idx, val in enumerate(row):
            cells[c_idx].text = val
    doc.add_paragraph()


def build_docx(metrics: dict[str, object]) -> None:
    doc = Document()
    title = doc.add_heading("Planned Surveys API — Architecture", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    _doc_para(doc, f"Document version: {DOC_VERSION} | Date: {TODAY}", bold=True)
    doc.add_paragraph()

    _doc_heading(doc, "1. Executive summary")
    _doc_para(
        doc,
        "The Planned Surveys API is an HTTP service that reproduces the behavior of the "
        "Excel macro Convert_and_Generate_XML_UTF8 from the Planned surveys generator workbook. "
        "It converts planned survey station data into WITSML 1.3.1.1 trajectory XML suitable "
        "for upload to drilling and wellbore data systems. The solution supports anonymous "
        "use via a static web converter and enterprise use via SLB (CSI) OAuth on a Python FastAPI backend."
    )

    _doc_heading(doc, "2. Business context")
    _doc_para(
        doc,
        "Field engineers and planners maintain survey programs in Excel (sheet Data, columns B through J). "
        "The macro generates Planned_surveys_.xml with consistent null handling (-999.25) and UTF-8 encoding. "
        "This project exposes the same rules through a REST API and browser UI so teams can generate XML "
        "without Excel, share a public link, or deploy behind corporate authentication."
    )

    _doc_heading(doc, "3. System context diagram (narrative)")
    _doc_para(doc, "External actors and systems:")
    actors = [
        ["Actor / system", "Interaction"],
        ["End user (browser)", "Login, paste survey data, download XML via /app or static Pages"],
        ["API client (PowerShell, scripts)", "POST JSON to /api/planned-surveys/xml"],
        ["SLB CSI OAuth", "Authorization and token endpoints (csi.slb.com/v2/auth, /v2/token)"],
        ["SLB App Registration", "Registered redirect URI must match SLB_REDIRECT_URI"],
        ["Azure App Service", "Hosts FastAPI in cloud (e.g. planned-surveys.azurewebsites.net)"],
        ["GitHub Pages", "Hosts static web/ only — no server-side OAuth"],
        ["Excel macro (legacy)", "Functional reference implementation"],
    ]
    _doc_table(doc, actors[0], actors[1:])

    _doc_heading(doc, "4. Architectural views")
    _doc_heading(doc, "4.1 Deployment view", 2)
    deploy_rows = [
        ["Mode", "Host", "OAuth", "XML generation"],
        ["Local dev", "127.0.0.1:8000 uvicorn", "Yes", "Server app/witsml.py"],
        ["Azure", "App Service Linux Py3.12", "Yes", "Server"],
        ["Render", "render.com container", "Yes", "Server"],
        ["GitHub Pages", "github.io/<repo>/", "No", "Client web/witsml.js"],
        ["DDH platform", "ddh.apps.slb.com (+ optional ROOT_PATH)", "Entra + app patterns", "Server"],
    ]
    _doc_table(doc, deploy_rows[0], deploy_rows[1:])

    _doc_heading(doc, "4.2 Application layers", 2)
    layers = [
        ["Layer", "Components", "Responsibility"],
        ["Presentation", "web/login.html, web/index.html, web/witsml.js", "UX, paste/parse, download"],
        ["API / routing", "app/main.py", "HTTP, validation, file responses, static mount"],
        ["Security", "app/slb_auth.py, slb_auth_deps.py, session_store.py", "OAuth, sessions, optional API guard"],
        ["Domain", "app/witsml.py", "WITSML XML generation, Excel parity rules"],
        ["Infrastructure", "infra/*.bicep, startup.sh, deploy-azure.ps1", "Azure provisioning and deploy"],
    ]
    _doc_table(doc, layers[0], layers[1:])

    _doc_heading(doc, "4.3 Component responsibilities", 2)
    components = [
        ["Module", "Key functions"],
        ["main.py", "FastAPI app; routes /, /login, /app, /health, auth, POST XML; mounts WEB_DIR"],
        ["witsml.py", "normalize_for_xml, build_planned_surveys_xml"],
        ["slb_auth.py", "SlbAuthConfig.from_env, build_authorization_url, exchange_authorization_code"],
        ["session_store.py", "create_session, get_session_payload, in-memory store"],
        ["slb_auth_deps.py", "session_is_valid, require_slb_user (SLB_AUTH_REQUIRED)"],
        ["witsml.js", "Client-side parse and XML build for static hosting"],
    ]
    _doc_table(doc, components[0], components[1:])

    _doc_heading(doc, "5. Authentication and authorization")
    _doc_para(
        doc,
        "Authentication uses the authorization code OAuth 2.0 flow against SLB CSI. The application "
        "never exposes CLIENT_SECRET to the browser. After successful token exchange, the server creates "
        "a random session identifier stored in an httponly cookie (ps_session_id). Token material "
        "remains server-side in an in-process dictionary with periodic expiry cleanup (12 hours)."
    )
    _doc_para(
        doc,
        "The redirect URI (SLB_REDIRECT_URI) is typically http://localhost:8000/api/callback for development "
        "and https://<app-name>.azurewebsites.net/api/callback for Azure. GitHub Pages URLs must not be "
        "registered as OAuth callbacks because no Python handler exists on that host."
    )
    oauth_steps = [
        ["Step", "Endpoint", "Description"],
        ["1", "GET /api/auth/login", "302 redirect to CSI authorize URL with state"],
        ["2", "CSI login", "User credentials at SLB"],
        ["3", "GET /api/callback", "Validate state; exchange code; create session; Set-Cookie"],
        ["4", "GET /app", "Serve converter if session valid"],
        ["5", "GET /api/auth/me", "JSON session status for UI"],
    ]
    _doc_table(doc, oauth_steps[0], oauth_steps[1:])

    _doc_heading(doc, "6. Data model and API contract")
    _doc_para(
        doc,
        "POST /api/planned-surveys/xml accepts JSON with stations[] and optional meta "
        "(name_well, name_wellbore, trajectory_name, trajectory_uid). "
        "Each station supports md, incl, azi, tvd, mdDelta, vertSect, dls, dispNs, dispEw "
        "(camelCase aliases per Pydantic). Response is UTF-8 XML with Content-Disposition attachment."
    )
    col_map = [
        ["Excel column", "JSON field", "WITSML element"],
        ["B md", "md", "md"],
        ["C incl", "incl", "incl"],
        ["D azi", "azi", "azi"],
        ["E tvd", "tvd", "tvd"],
        ["F mdDelta", "mdDelta", "mdDelta"],
        ["G vertSect", "vertSect", "vertSect"],
        ["H dls", "dls", "dls"],
        ["I dispNs", "dispNs", "dispNs"],
        ["J dispEw", "dispEw", "dispEw"],
    ]
    _doc_table(doc, col_map[0], col_map[1:])

    _doc_heading(doc, "7. Configuration")
    env_rows = [
        ["Variable", "Purpose"],
        ["CLIENT_ID, CLIENT_SECRET, APP_KEY", "SLB application credentials"],
        ["SLB_REDIRECT_URI", "Must match portal registration exactly"],
        ["SLB_AUTHORIZATION_URL, SLB_TOKEN_URL", "CSI endpoints (defaults provided)"],
        ["SLB_SCOPES", "OAuth scope string"],
        ["SLB_AUTH_REQUIRED", "When true, POST XML requires valid session or Bearer"],
        ["ROOT_PATH", "Reverse-proxy subpath prefix (e.g. DDH)"],
        ["APP_FRONTEND_URL", "Post-login browser base URL (optional)"],
    ]
    _doc_table(doc, env_rows[0], env_rows[1:])

    _doc_heading(doc, "8. Infrastructure (Azure)")
    _doc_para(
        doc,
        "Infrastructure as code is defined in infra/main.bicep and infra/portal-deploy.bicep. "
        "Resources include a Linux App Service plan and Web App with PYTHON|3.12 runtime, "
        "gunicorn with UvicornWorker, port 8000, and HTTPS-only. Deployment packages Python "
        "source via zip deploy (scripts/deploy-azure.ps1) or GitHub Actions publish profile."
    )

    _doc_heading(doc, "9. CI/CD pipelines")
    cicd = [
        ["Workflow", "Trigger", "Artifact"],
        ["github-pages.yml", "push main", "web/ → GitHub Pages"],
        ["github-pages-branch.yml", "manual", "gh-pages branch fallback"],
        ["azure-deploy.yml", "workflow_dispatch", "Full repo → Azure Web App"],
    ]
    _doc_table(doc, cicd[0], cicd[1:])

    _doc_heading(doc, "10. Quality assurance")
    _doc_para(
        doc,
        "Automated tests under tests/ cover WITSML output parity, SLB redirect URI resolution, "
        "and API behavior including /api/callback error handling. Run: python -m pytest tests -v "
        "using the project virtual environment."
    )

    _doc_heading(doc, "11. Operational considerations")
    ops = [
        "Health endpoint /health for load balancers and Azure probes.",
        "F1 App Service tier may cold-start; B1 recommended for Always On.",
        "In-memory sessions do not survive multi-instance scale-out without redesign.",
        "Include web/ folder in Azure zip deploy for /login and /app UI assets.",
        "Align SLB redirect URI across portal, Azure app settings, and .env.",
    ]
    for item in ops:
        doc.add_paragraph(item, style="List Bullet")

    _doc_heading(doc, "12. ASCII reference — request flow (secured host)")
    flow = (
        "User → /login → /api/auth/login → CSI (SLB)\n"
        "CSI → /api/callback → session_store → /app → POST /api/planned-surveys/xml → witsml.py → XML download"
    )
    p = doc.add_paragraph()
    run = p.add_run(flow)
    run.font.name = "Consolas"
    run.font.size = Pt(9)

    _doc_heading(doc, "13. Codebase size and composition")
    total = int(metrics["source_total"])
    nfiles = int(metrics["source_files"])
    _doc_para(
        doc,
        f"The project is compact: approximately {_fmt_loc(total)} lines of source code "
        f"in {nfiles} files. Counts are physical lines (one per line break), excluding "
        f"virtual environments (.venv), bytecode caches, and binary assets (.png, .otf, .svg). "
        f"Included extensions: Python, JavaScript, HTML, Bicep, shell, and PowerShell."
    )
    summary_rows = [
        ["Source code (total)", f"{_fmt_loc(total)} lines in {nfiles} files"],
        ["Markdown documentation", f"{_fmt_loc(int(metrics['markdown_lines']))} lines"],
        ["CI / config (yml, yaml, txt, json)", f"{_fmt_loc(int(metrics['config_lines']))} lines"],
        ["Share in web/", f"~{int(metrics['web_share_pct'])}% of source lines"],
    ]
    _doc_table(doc, ["Metric", "Value"], summary_rows)

    _doc_heading(doc, "13.1 Lines by top-level folder", 2)
    folder_rows = [
        [name, _fmt_loc(lines)] for name, lines in metrics["by_folder"]  # type: ignore[misc]
    ]
    _doc_table(doc, ["Folder", "Lines"], folder_rows)

    _doc_heading(doc, "13.2 Largest source files", 2)
    file_rows = [
        [name, _fmt_loc(lines)] for name, lines in metrics["top_files"]  # type: ignore[misc]
    ]
    _doc_table(doc, ["File", "Lines"], file_rows)

    _doc_para(
        doc,
        "Most volume sits in web/witsml.js and web/index.html, which mirror the Excel macro "
        "in the browser for GitHub Pages. Server logic in app/ is roughly 600 lines; automated "
        "tests add about 300 lines under tests/."
    )

    _doc_heading(doc, "14. Related documentation")
    refs = [
        "README.md — runbooks, routes, Azure deploy",
        "GITHUB.md — Pages publishing",
        ".env.example — OAuth template",
        "WITSML 1.3.1.1 trajectory schema (obj_trajectory.xsd)",
    ]
    for r in refs:
        doc.add_paragraph(r, style="List Bullet")

    doc.save(DOCX_PATH)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    metrics = collect_code_metrics(ROOT)
    build_docx(metrics)
    build_pptx(metrics)
    print(f"Wrote: {DOCX_PATH}")
    print(f"Wrote: {PPTX_PATH}")
    print(
        f"LOC: {metrics['source_total']} source lines "
        f"({metrics['source_files']} files) as of {TODAY}"
    )


if __name__ == "__main__":
    main()
