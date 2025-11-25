import os
import json
from datetime import datetime
import requests

FRED_API_KEY = os.environ.get("FRED_API_KEY")
if not FRED_API_KEY:
    raise RuntimeError("FRED_API_KEY no está definido")

BASE_URL = "https://api.stlouisfed.org/fred/series/observations"

# Serie de TGA en FRED (Treasury General Account)
TGA_SERIES_ID = "WTREGEN"  # Weekly Treasury General Account, average balance
START_DATE = "2015-01-01"


def fetch_tga():
    params = {
        "series_id": TGA_SERIES_ID,
        "api_key": FRED_API_KEY,
        "file_type": "json",
        "observation_start": START_DATE,
    }
    resp = requests.get(BASE_URL, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    dates = []
    values = []

    for obs in data.get("observations", []):
        v = obs.get("value")
        if v is None or v == ".":
            continue
        try:
            values.append(float(v))
            dates.append(obs.get("date"))
        except ValueError:
            continue

    return {"dates": dates, "values": values}


def main():
    tga_series = fetch_tga()

    output = {
        "last_updated_utc": datetime.utcnow().isoformat() + "Z",
        "series": {
            "TGA": tga_series
        }
    }

    os.makedirs("data", exist_ok=True)
    with open("data/tga.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False)

    print(
        "Guardado data/tga.json con",
        len(tga_series["dates"]),
        "observaciones de TGA",
    )


if __name__ == "__main__":
    main()
