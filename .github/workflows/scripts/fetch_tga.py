import os, json, datetime
import requests

FRED_API_KEY = os.getenv("FRED_API_KEY", "")
BASE = "https://api.stlouisfed.org/fred/series/observations"

# TGA: (depende de qué serie uses; si ya tenés una que funciona, mantenela)
TGA_SERIES_ID = "WTREGEN"  # Treasury General Account (aprox, verificar tu serie actual)

def fetch_series(series_id):
    params = {
        "series_id": series_id,
        "api_key": FRED_API_KEY,
        "file_type": "json",
        "observation_start": "2018-01-01",
    }
    r = requests.get(BASE, params=params, timeout=60)
    r.raise_for_status()
    data = r.json()

    rows = []
    for obs in data.get("observations", []):
        d = obs.get("date")
        v = obs.get("value")
        if v in (None, ".", ""):
            val = None
        else:
            try:
                val = float(v)
            except ValueError:
                val = None
        rows.append({"date": d, "TGA": val})

    return rows

def main():
    if not FRED_API_KEY:
        raise RuntimeError("FRED_API_KEY no está seteada en secrets.")

    rows = fetch_series(TGA_SERIES_ID)

    os.makedirs("data", exist_ok=True)
    with open("data/tga_data.json", "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)

    print("OK -> data/tga_data.json")

if __name__ == "__main__":
    main()
