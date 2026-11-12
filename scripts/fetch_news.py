import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import json
import os
from datetime import datetime
from email.utils import parsedate_to_datetime

SOURCES = {
    "security": [
        {"name": "Sekurak", "badge": "sec", "url": "https://sekurak.pl/feed/"},
        {"name": "Niebezpiecznik", "badge": "nieb", "url": "https://niebezpiecznik.pl/feed/"}
    ],
    "leclerc": [
        {
            "name": "Media PL",
            "badge": "sec",
            "url": "https://news.google.com/rss/search?q=" + urllib.parse.quote('"E.Leclerc"') + "&hl=pl&gl=PL&ceid=PL:pl"
        }
    ]
}

def fetch_rss(url, source_name, badge_class, limit=5):
    items = []
    req = urllib.request.Request(
        url,
        headers={'User-Agent': 'Mozilla/5.0 (Andrew-Hub News Aggregator)'}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            xml_data = response.read()
        root = ET.fromstring(xml_data)
        
        for item in root.findall('.//item')[:limit]:
            title_el = item.find('title')
            link_el = item.find('link')
            pub_date_el = item.find('pubDate')

            title = title_el.text.strip() if title_el is not None else "Brak tytułu"
            link = link_el.text.strip() if link_el is not None else "#"
            
            # Formatowanie daty i wyciąganie nazwy źródła z Google News
            formatted_date = ""
            timestamp = 0
            if pub_date_el is not None and pub_date_el.text:
                try:
                    dt = parsedate_to_datetime(pub_date_el.text)
                    formatted_date = dt.strftime("%d.%m.%Y, %H:%M")
                    timestamp = dt.timestamp()
                except Exception:
                    formatted_date = pub_date_el.text[:16]

            # Google News dodaje nazwę portalu po myślniku na końcu tytułu (np. "Tytuł - Wiadomości Handlowe")
            actual_source = source_name
            if source_name == "Media PL" and " - " in title:
                parts = title.rsplit(" - ", 1)
                title = parts[0]
                actual_source = parts[1]

            items.append({
                "title": title,
                "link": link,
                "source": actual_source,
                "badge": badge_class,
                "date": formatted_date,
                "timestamp": timestamp
            })
    except Exception as e:
        print(f"Błąd pobierania {source_name}: {e}")
    return items

def main():
    security_news = []
    for src in SOURCES["security"]:
        security_news.extend(fetch_rss(src["url"], src["name"], src["badge"], limit=4))
    
    # Sortowanie od najnowszych
    security_news.sort(key=lambda x: x["timestamp"], reverse=True)

    leclerc_news = []
    for src in SOURCES["leclerc"]:
        leclerc_news.extend(fetch_rss(src["url"], src["name"], src["badge"], limit=6))
    leclerc_news.sort(key=lambda x: x["timestamp"], reverse=True)

    output = {
        "updated_at": datetime.now().strftime("%d.%m.%Y %H:%M"),
        "security": security_news[:6],
        "leclerc": leclerc_news[:6]
    }

    os.makedirs("data", exist_ok=True)
    with open("data/news.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print("Zaktualizowano data/news.json!")

if __name__ == "__main__":
    main()