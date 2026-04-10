"""
Base scraper — shared fetch helpers used by all OEM scrapers.
Uses httpx for static pages and Playwright for JS-rendered pages.
"""
import asyncio
import re
import time
from typing import Optional
import httpx
from bs4 import BeautifulSoup

DEFAULT_UA = "Mozilla/5.0 (compatible; CarbonCalcBot/1.0; +https://calculateyourcarbon.com)"
REQUEST_DELAY = 2.0   # seconds between requests (polite crawling)


class BaseScraper:
    oem_name: str = "Unknown"

    def __init__(self, user_agent: str = DEFAULT_UA):
        self.ua = user_agent
        self._last_request: float = 0.0

    # ──── HTTP helpers ────────────────────────────────────────────────────

    async def _throttle(self):
        elapsed = time.monotonic() - self._last_request
        if elapsed < REQUEST_DELAY:
            await asyncio.sleep(REQUEST_DELAY - elapsed)
        self._last_request = time.monotonic()

    async def fetch_static(self, url: str) -> str:
        """Fetch a plain HTML page with httpx (no JS execution)."""
        await self._throttle()
        headers = {"User-Agent": self.ua}
        async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            return resp.text

    async def fetch_js(self, url: str, wait_selector: str = "body") -> str:
        """Fetch a JS-rendered page using Playwright (chromium headless)."""
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            raise RuntimeError("Playwright not installed. Run: pip install playwright && playwright install chromium")

        await self._throttle()
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            page = await browser.new_page(user_agent=self.ua)
            await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
            try:
                await page.wait_for_selector(wait_selector, timeout=10_000)
            except Exception:
                pass
            html = await page.content()
            await browser.close()
        return html

    def parse(self, html: str) -> BeautifulSoup:
        return BeautifulSoup(html, "lxml")

    # ──── Data normalisation helpers ──────────────────────────────────────

    def clean_float(self, text: str) -> Optional[float]:
        """Extract first number from a string, return None if none found."""
        m = re.search(r"[\d]+\.?[\d]*", text.replace(",", ""))
        return float(m.group()) if m else None

    def normalize_fuel_curve(self, raw: dict) -> dict:
        """
        Accept fuel curve data in any unit/key format and normalise to
        { "25": L_hr, "50": L_hr, "75": L_hr, "100": L_hr }
        """
        result = {}
        for key, val in raw.items():
            # Accept percentage as int or string
            pct = str(int(float(str(key).replace("%", "").strip())))
            try:
                result[pct] = round(float(val), 3)
            except (TypeError, ValueError):
                continue
        return result

    # ──── Override in subclasses ──────────────────────────────────────────

    async def scrape_all(self) -> list[dict]:
        """Return list of generator dicts ready to INSERT into generators table."""
        raise NotImplementedError
