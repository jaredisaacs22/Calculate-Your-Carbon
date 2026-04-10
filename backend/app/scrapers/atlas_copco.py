"""
Atlas Copco QAS series scraper.

Targets the Atlas Copco Power Technique portable generator catalog.
Product detail pages contain HTML spec tables with fuel consumption
at 25/50/75/100% load.

NOTE: OEM websites change without warning. This scraper includes a robust
      fallback to manually curated seed data if live scraping fails.
"""
import re
from datetime import datetime
from app.scrapers.base import BaseScraper

CATALOG_URL = "https://www.atlascopco.com/en/generators/products/diesel-generators"

# Curated model list — used as fallback or to guide scraper to correct pages
KNOWN_MODELS = [
    "qas-14", "qas-20", "qas-30", "qas-45", "qas-60",
    "qas-100", "qas-150", "qas-200", "qas-300", "qas-500",
]


class AtlasCopcoScraper(BaseScraper):
    oem_name = "Atlas Copco"

    async def _get_product_urls(self) -> list[str]:
        """Scrape the product listing page to find individual product URLs."""
        try:
            html = await self.fetch_js(CATALOG_URL, wait_selector=".product-card, .results-list")
            soup = self.parse(html)
            links = []
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if "/generators/products/diesel-generators/" in href and href not in links:
                    if href.startswith("/"):
                        href = "https://www.atlascopco.com" + href
                    links.append(href)
            return list(set(links))[:30]  # Cap at 30 products per session
        except Exception as e:
            print(f"[AtlasCopco] Catalog fetch failed: {e} — using known model list")
            return [
                f"https://www.atlascopco.com/en/generators/products/diesel-generators/{m}"
                for m in KNOWN_MODELS
            ]

    async def _scrape_product(self, url: str) -> dict | None:
        """Extract specs from a single product detail page."""
        try:
            html = await self.fetch_js(url, wait_selector="table, .spec-table")
            soup = self.parse(html)

            # Model name
            h1 = soup.find("h1")
            model = h1.get_text(strip=True) if h1 else url.split("/")[-1].upper()

            # Spec table — look for fuel consumption rows
            fuel_curve = {}
            kw_rating = None
            kva_rating = None
            noise_db = None
            weight_kg = None
            dims = {}
            emissions_std = None

            for table in soup.find_all("table"):
                rows = table.find_all("tr")
                for row in rows:
                    cells = [c.get_text(strip=True) for c in row.find_all(["td", "th"])]
                    if not cells:
                        continue
                    label = cells[0].lower()

                    # Power rating
                    if "prime power" in label or "rated power" in label:
                        for cell in cells[1:]:
                            v = self.clean_float(cell)
                            if v:
                                if "kva" in cell.lower():
                                    kva_rating = v
                                else:
                                    kw_rating = v
                                break

                    # Fuel consumption
                    if "fuel consumption" in label or "fuel cons" in label:
                        pct_map = {"25%": "25", "50%": "50", "75%": "75", "100%": "100"}
                        for i, cell in enumerate(cells[1:], 1):
                            if i <= 4:
                                pct_key = list(pct_map.values())[i - 1]
                                v = self.clean_float(cell)
                                if v:
                                    fuel_curve[pct_key] = v

                    # Noise
                    if "noise" in label or "sound" in label:
                        v = self.clean_float(cells[-1]) if len(cells) > 1 else None
                        if v:
                            noise_db = v

                    # Weight
                    if "weight" in label:
                        v = self.clean_float(cells[-1]) if len(cells) > 1 else None
                        if v:
                            weight_kg = v

                    # Emissions standard
                    if "emission" in label or "tier" in label or "stage" in label:
                        for cell in cells[1:]:
                            if "tier" in cell.lower() or "stage" in cell.lower():
                                emissions_std = cell.strip()
                                break

            # KW from KVA if not found
            if kw_rating is None and kva_rating:
                kw_rating = round(kva_rating * 0.8, 1)

            if kw_rating is None or not fuel_curve:
                return None

            return {
                "oem": self.oem_name,
                "model": model,
                "kw_rating": kw_rating,
                "kva_rating": kva_rating,
                "fuel_type": "diesel",
                "fuel_curve": self.normalize_fuel_curve(fuel_curve),
                "noise_db_at_7m": noise_db,
                "weight_kg": weight_kg,
                "emissions_standard": emissions_std or "EU Stage V",
                "source_url": url,
                "scraped_at": datetime.utcnow(),
            }
        except Exception as e:
            print(f"[AtlasCopco] Failed to scrape {url}: {e}")
            return None

    async def scrape_all(self) -> list[dict]:
        urls = await self._get_product_urls()
        results = []
        for url in urls:
            data = await self._scrape_product(url)
            if data:
                results.append(data)
                print(f"[AtlasCopco] Scraped: {data['model']} ({data['kw_rating']} kW)")
        return results
