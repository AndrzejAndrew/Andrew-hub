import html
import json
import os
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from email.utils import parsedate_to_datetime

SOURCES = {
    "security": [
        {"name": "Sekurak", "badge": "sec", "url": "https://sekurak.pl/feed/"},
        {"name": "Niebezpiecznik", "badge": "nieb", "url": "https://niebezpiecznik.pl/feed/"},
        {
            "name": "Cyber Google News",
            "badge": "sec",
            "url": "https://news.google.com/rss/search?q="
            + urllib.parse.quote("(cyberbezpieczeństwo OR podatność OR wyciek danych)")
            + "&hl=pl&gl=PL&ceid=PL:pl",
        },
    ],
    "it_games": [
        {
            "name": "IT & Dev PL",
            "badge": "sec",
            "url": "https://news.google.com/rss/search?q="
            + urllib.parse.quote("(programowanie OR linux OR chmura OR sztuczna inteligencja)")
            + "&hl=pl&gl=PL&ceid=PL:pl",
        },
        {
            "name": "Gry PL",
            "badge": "sec",
            "url": "https://news.google.com/rss/search?q="
            + urllib.parse.quote("(gry komputerowe OR gamedev OR premiera gry)")
            + "&hl=pl&gl=PL&ceid=PL:pl",
        },
    ],
    "leclerc": [
        {
            "name": "Media PL",
            "badge": "sec",
            "url": "https://news.google.com/rss/search?q="
            + urllib.parse.quote('"E.Leclerc" OR "E. Leclerc"')
            + "&hl=pl&gl=PL&ceid=PL:pl",
        }
    ],
}


def fetch_rss(url, source_name, badge_class, limit=6):
    items = []
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            xml_data = response.read()
        root = ET.fromstring(xml_data)

        for item in root.findall(".//item")[:limit]:
            title_el = item.find("title")
            link_el = item.find("link")
            pub_date_el = item.find("pubDate")
            source_el = item.find("source")

            title = html.unescape(title_el.text.strip()) if (title_el is not None and title_el.text) else "Brak tytułu"
            link = link_el.text.strip() if (link_el is not None and link_el.text) else "#"

            formatted_date = ""
            timestamp = 0
            if pub_date_el is not None and pub_date_el.text:
                try:
                    dt = parsedate_to_datetime(pub_date_el.text)
                    formatted_date = dt.strftime("%d.%m.%Y, %H:%M")
                    timestamp = dt.timestamp()
                except Exception:
                    formatted_date = pub_date_el.text[:16]

            actual_source = source_name
            if source_el is not None and source_el.text:
                actual_source = html.unescape(source_el.text.strip())
            elif " - " in title:
                parts = title.rsplit(" - ", 1)
                if len(parts[1].strip()) <= 45:
                    title = parts[0].strip()
                    actual_source = parts[1].strip()

            title = re.sub(r"\s+", " ", title)

            items.append({
                "title": title,
                "link": link,
                "source": actual_source,
                "badge": badge_class,
                "date": formatted_date,
                "timestamp": timestamp,
            })
    except Exception as e:
        print(f"Błąd pobierania {source_name}: {e}")
    return items


def dedup_and_sort(raw_items, limit):
    seen = set()
    unique = []
    for item in sorted(raw_items, key=lambda x: x["timestamp"], reverse=True):
        key = re.sub(r"[^a-z0-9ąćęłńóśźż]+", "", item["title"].lower())[:70] or item["link"]
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
        if len(unique) >= limit:
            break
    return unique


def main():
    existing = {}
    if os.path.exists("data/news.json"):
        try:
            with open("data/news.json", "r", encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            existing = {}

    security_raw = []
    for src in SOURCES["security"]:
        security_raw.extend(fetch_rss(src["url"], src["name"], src["badge"], limit=5))
    security_news = dedup_and_sort(security_raw, 6) or existing.get("security", [])

    it_games_raw = []
    for src in SOURCES["it_games"]:
        it_games_raw.extend(fetch_rss(src["url"], src["name"], src["badge"], limit=6))
    it_games_news = dedup_and_sort(it_games_raw, 8) or existing.get("it_games", [])

    leclerc_raw = []
    for src in SOURCES["leclerc"]:
        leclerc_raw.extend(fetch_rss(src["url"], src["name"], src["badge"], limit=8))
    leclerc_news = dedup_and_sort(leclerc_raw, 6) or existing.get("leclerc", [])

    output = {
        "updated_at": datetime.now().strftime("%d.%m.%Y %H:%M"),
        "security": security_news,
        "it_games": it_games_news,
        "leclerc": leclerc_news,
    }

    os.makedirs("data", exist_ok=True)
    with open("data/news.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("Zaktualizowano data/news.json!")


if __name__ == "__main__":
    main()
