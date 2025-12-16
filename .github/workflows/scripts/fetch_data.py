import os, json, datetime
import requests

FRED_API_KEY = os.getenv("FRED_API_KEY", "")
BASE = "https://api.stlouisfed.org/fred/series/observations"

SERIES = ["SOFR", "EFFR", "IORB", "WALCL", "TGCR", "ONRRP"]

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

    dates = []
    values = []
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
        dates.append(d)
        values.append(val)

    return {"dates": dates, "values": values}

def main():
    if not FRED_API_KEY:
        raise RuntimeError("FRED_API_KEY no está seteada en secrets.")

    out = {
        "last_updated_utc": datetime.datetime.utcnow().isoformat() + "Z",
        "series": {},
    }

    for sid in SERIES:
        out["series"][sid] = fetch_series(sid)

    os.makedirs("data", exist_ok=True)
    with open("data/plumbing_data.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print("OK -> data/plumbing_data.json")

if __name__ == "__main__":
    main()
