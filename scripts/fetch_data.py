import os
import json
from datetime import datetime

import requests
import pandas as pd

FRED_API_KEY = os.getenv("FRED_API_KEY")
FRED_BASE_URL = "https://api.stlouisfed.org/fred/series/observations"


def get_fred_series(series_id, start_date="2015-01-01"):
    """
    Descarga una serie de FRED y la devuelve como DataFrame con índice fecha.
    """
    params = {
        "series_id": series_id,
        "api_key": FRED_API_KEY,
        "file_type": "json",
        "observation_start": start_date,
    }
    r = requests.get(FRED_BASE_URL, params=params, timeout=30)
    r.raise_for_status()
    obs = r.json()["observations"]

    df = pd.DataFrame(obs)
    df["date"] = pd.to_datetime(df["date"])
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    df = df.set_index("date")[["value"]]
    df.columns = [series_id]
    return df


def fetch_all_series():
    """
    Baja las series centrales de plumbing:
    - SOFR
    - EFFR (Effective Fed Funds Rate)
    - IORB
    - WALCL (balance de la Fed)
    """
    sofr = get_fred_series("SOFR", "2018-01-01")
    effr = get_fred_series("EFFR", "2015-01-01")
    iorb = get_fred_series("IORB", "2015-01-01")
    walcl = get_fred_series("WALCL", "2005-01-01")

    df = sofr.join([effr, iorb, walcl], how="outer")

    # Spread de stress SOFR - IORB
    df["SOFR_minus_IORB"] = df["SOFR"] - df["IORB"]

    return df


def main():
    df = fetch_all_series()

    out = {
        "last_updated_utc": datetime.utcnow().isoformat() + "Z",
        "series": {},
    }

    for col in df.columns:
        sub = df[col].dropna()
        sub = sub[sub.index >= pd.Timestamp("2018-01-01")]
        out["series"][col] = {
            "dates": [d.strftime("%Y-%m-%d") for d in sub.index],
            "values": [float(v) for v in sub.values],
        }

    os.makedirs("data", exist_ok=True)
    with open("data/plumbing_data.json", "w") as f:
        json.dump(out, f, indent=2)

    print("Guardado data/plumbing_data.json con series:", list(df.columns))


if __name__ == "__main__":
    main()
