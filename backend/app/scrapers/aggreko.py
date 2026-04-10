"""
Aggreko generator scraper.

Aggreko's product pages are less JS-heavy than Atlas Copco.
BeautifulSoup over httpx handles most pages; Playwright as fallback.
"""
from datetime import datetime
from app.scrapers.base import BaseScraper

CATALOG_URL = "https://www.aggreko.com/en-us/products/power-generators/diesel-generators/"


class AggrekoScraper(BaseScraper):
    oem_name = "Aggreko"

    async def _get_product_urls(self) -> list[str]:
        try:
            html = await self.fetch_static(CATALOG_URL)
            soup = self.parse(html)
            links = []
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if "/products/power-generators/" in href and href not in links:
                    if href.startswith("/"):
                        href = "https://www.aggreko.com" + href
                    if href != CATALOG_URL:
                        links.append(href)
            return list(set(links))[:25]
        except Exception as e:
            print(f"[Aggreko] Catalog fetch failed: {e}")
            return []

    async def _scrape_product(self, url: str) -> dict | None:
        try:
            html = await self.fetch_static(url)
            soup = self.parse(html)

            h1 = soup.find("h1")
            model = h1.get_text(strip=True) if h1 else url.split("/")[-1].replace("-", " ").title()

            fuel_curve = {}
            kw_rating = None
            kva_rating = None
            noise_db = None
            weight_kg = None
            emissions_std = None

            for table in soup.find_all("table"):
                rows = table.find_all("tr")
                for row in rows:
                    cells = [c.get_text(strip=True) for c in row.find_all(["td", "th"])]
                    if not cells:
                        continue
                    label = cells[0].lower()

                    if ("prime" in label or "standby" in label or "rated" in label) and "kw" in label:
                        for cell in cells[1:]:
                            v = self.clean_float(cell)
                            if v:
                                kw_rating = v
                                break

                    if "kva" in label:
                        for cell in cells[1:]:
                            v = self.clean_float(cell)
                            if v:
                                kva_rating = v
                                break

                    if "fuel" in label and ("25" in " ".join(cells) or "50" in " ".join(cells)):
                        for i, pct in enumerate(["25", "50", "75", "100"], 1):
                            if i < len(cells):
                                v = self.clean_float(cells[i])
                                if v:
                                    fuel_curve[pct] = v

                    if "noise" in label or "db" in label:
                        v = self.clean_float(cells[-1]) if len(cells) > 1 else None
                        if v:
                            noise_db = v

                    if "weight" in label:
                        v = self.clean_float(cells[-1]) if len(cells) > 1 else None
                        if v:
                            weight_kg = v

                    if "tier" in label or "emission" in label:
                        for cell in cells[1:]:
                            if any(x in cell.lower() for x in ["tier", "stage", "epa"]):
                                emissions_std = cell.strip()
                                break

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
                "emissions_standard": emissions_std or "EPA Tier 4 Final",
                "source_url": url,
                "scraped_at": datetime.utcnow(),
            }
        except Exception as e:
            print(f"[Aggreko] Failed to scrape {url}: {e}")
            return None

    async def scrape_all(self) -> list[dict]:
        urls = await self._get_product_urls()
        results = []
        for url in urls:
            data = await self._scrape_product(url)
            if data:
                results.append(data)
                print(f"[Aggreko] Scraped: {data['model']} ({data['kw_rating']} kW)")
        return results
