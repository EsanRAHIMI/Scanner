from __future__ import annotations

from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

_TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"

_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
)


def _fmt_money(value: Any, currency: str = "AED") -> str:
    try:
        return f"{float(value):,.0f} {currency}"
    except (TypeError, ValueError):
        return f"— {currency}"


_env.filters["money"] = _fmt_money


def render_proposal_html(
    proposal: dict[str, Any],
    template_doc: dict[str, Any],
    *,
    page_index: int | None = None,
    base_url: str = "",
    for_pdf: bool = False,
    for_embed: bool = False,
) -> str:
    """Render the whole proposal (or a single page) as exact-layout HTML.

    The same templates are used for the editor preview iframes and for the
    Playwright PDF export, so what you see is exactly what exports.
    """
    branding = dict(template_doc.get("branding") or {})
    pages = proposal.get("pages") or []
    if page_index is not None:
        if 0 <= page_index < len(pages):
            pages = [pages[page_index]]
        else:
            pages = []

    def absolutize(url: str | None) -> str:
        if not url:
            return ""
        if url.startswith("/") and base_url:
            return f"{base_url.rstrip('/')}{url}"
        return url

    branding["logo_url"] = absolutize(branding.get("logo_url"))
    branding["pattern_url"] = absolutize(branding.get("pattern_url"))
    branding["pattern2_url"] = absolutize(branding.get("pattern2_url"))

    # Absolutize image URLs inside page data without mutating the stored docs.
    resolved_pages: list[dict[str, Any]] = []
    for page in pages:
        data = dict(page.get("data") or {})
        for key in ("image_url", "drawing_url"):
            if key in data:
                data[key] = absolutize(data.get(key))
        resolved_pages.append({**page, "data": data})

    template = _env.get_template("proposal.html")
    return template.render(
        proposal=proposal,
        pages=resolved_pages,
        branding=branding,
        pricing=proposal.get("pricing") or {},
        salesperson=proposal.get("salesperson") or {},
        customer=proposal.get("customer") or {},
        project=proposal.get("project") or {},
        for_pdf=for_pdf,
        for_embed=for_embed,
        total_pages=len(proposal.get("pages") or []),
    )
