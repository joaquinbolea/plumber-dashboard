import os
import json
from datetime import datetime
import requests

FRED_API_KEY = os.environ.get("FRED_API_KEY")
if not FRED_API_KEY:
    raise RuntimeError("FRED_API_KEY no está definido")

BASE_URL = "https://api.stlouisfed.org/fred/series/observations"
START_DATE = "2015-01-01"

SERIES = {
    "TGCRRATE": "Tri-Party General Collateral Rate",
    "RRPONTSYD": "ON RRP volume (Treasury securities sold)",
    "RRPONTSYAWARD": "ON RRP award rate",
}


def fetch_series(series_id: str, start: str):
    params = {
        "series_id": series_id,
        "api_key": FRED_API_KEY,
        "file_type": "json",
        "observation_start": start,
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
    out = {
        "last_updated_utc": datetime.utcnow().isoformat() + "Z",
        "series": {},
        "meta": SERIES,
    }

    for sid in SERIES.keys():
        print(f"Descargando {sid} ...")
        out["series"][sid] = fetch_series(sid, START_DATE)

    os.makedirs("data", exist_ok=True)
    with open("data/repo.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)

    print("Guardado data/repo.json con series:", ", ".join(out["series"].keys()))


if __name__ == "__main__":
    main()
