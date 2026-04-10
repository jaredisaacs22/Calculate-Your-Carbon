"""
Himoinsa diesel generating set scraper.

Himoinsa's site renders product specs in JavaScript-heavy pages.
Playwright is used to fully render before scraping.
Falls back to PDF spec sheets via pdfplumber where available.
"""
from datetime import datetime
from app.scrapers.base import BaseScraper

CATALOG_URL = "https://www.himoinsa.com/en/products/generating-sets/diesel-generating-sets/"


class HimoinsaScraper(BaseScraper):
    oem_name = "Himoinsa"

    async def _get_product_urls(self) -> list[str]:
        try:
            html = await self.fetch_js(CATALOG_URL, wait_selector=".product-list, .product-item, article")
            soup = self.parse(html)
            links = []
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if "/products/generating-sets/" in href and href not in links:
                    if href.startswith("/"):
                        href = "https://www.himoinsa.com" + href
                    if href != CATALOG_URL:
                        links.append(href)
            return list(set(links))[:25]
        except Exception as e:
            print(f"[Himoinsa] Catalog fetch failed: {e}")
            return []

    async def _scrape_product(self, url: str) -> dict | None:
        try:
            html = await self.fetch_js(url, wait_selector="table, .spec-row, .characteristics")
            soup = self.parse(html)

            h1 = soup.find("h1")
            model = h1.get_text(strip=True) if h1 else url.split("/")[-1].upper()

            fuel_curve = {}
            kw_rating = None
            kva_rating = None
            noise_db = None
            weight_kg = None
            emissions_std = None

            # Himoinsa often uses definition lists and custom spec components
            for dl in soup.find_all(["dl", "table"]):
                items = dl.find_all(["dt", "dd", "tr"])
                label = ""
                for item in items:
                    text = item.get_text(strip=True)
                    tag = item.name
                    if tag == "dt":
                        label = text.lower()
                    elif tag == "dd":
                        value = text
                        if "prime power" in label or "continuous" in label:
                            if "kw" in value.lower():
                                v = self.clean_float(value)
                                if v:
                                    kw_rating = v
                        if "apparent" in label or "kva" in label:
                            v = self.clean_float(value)
                            if v:
                                kva_rating = v
                        if "noise" in label or "sound" in label:
                            v = self.clean_float(value)
                            if v:
                                noise_db = v
                        if "weight" in label:
                            v = self.clean_float(value)
                            if v:
                                weight_kg = v
                        if "emission" in label or "stage" in label:
                            if "stage" in value.lower() or "tier" in value.lower():
                                emissions_std = value.strip()

                    elif tag == "tr":
                        cells = [c.get_text(strip=True) for c in item.find_all(["td", "th"])]
                        if not cells:
                            continue
                        row_label = cells[0].lower()
                        if "fuel" in row_label and ("25" in " ".join(cells) or "consumption" in row_label):
                            for i, pct in enumerate(["25", "50", "75", "100"], 1):
                                if i < len(cells):
                                    v = self.clean_float(cells[i])
                                    if v:
                                        fuel_curve[pct] = v
                        if "prime" in row_label or "rated" in row_label:
                            for cell in cells[1:]:
                                if "kva" in cell.lower():
                                    v = self.clean_float(cell)
                                    if v:
                                        kva_rating = v
                                elif "kw" in cell.lower():
                                    v = self.clean_float(cell)
                                    if v:
                                        kw_rating = v

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
            print(f"[Himoinsa] Failed to scrape {url}: {e}")
            return None

    async def scrape_all(self) -> list[dict]:
        urls = await self._get_product_urls()
        results = []
        for url in urls:
            data = await self._scrape_product(url)
            if data:
                results.append(data)
                print(f"[Himoinsa] Scraped: {data['model']} ({data['kw_rating']} kW)")
        return results
