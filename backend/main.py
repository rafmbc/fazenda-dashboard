from fastapi import FastAPI, HTTPException, Query
import pandas as pd
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # change in production!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Load once (fast)
FILE_PATH = "../data/DF_LIMPO.csv"


def sample_evenly(records: list[dict], limit: int) -> list[dict]:
    """Return up to `limit` points spread across the full timeline."""
    if limit <= 0 or len(records) <= limit:
        return records

    if limit == 1:
        return [records[-1]]

    last_idx = len(records) - 1
    step = last_idx / (limit - 1)
    sampled_idx = []
    seen = set()

    for i in range(limit):
        idx = round(i * step)
        if idx in seen:
            continue
        seen.add(idx)
        sampled_idx.append(idx)

    if sampled_idx[-1] != last_idx:
        sampled_idx[-1] = last_idx

    return [records[i] for i in sampled_idx]


def parse_datetime(value: str) -> pd.Timestamp:
    """Parse string parameters to pandas timestamps and validate ordering."""
    try:
        return pd.to_datetime(value)
    except Exception as err:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Invalid datetime '{value}'") from err


@app.get("/")
def root():
    return {"message": "API is running"}


@app.get("/data")
def get_data(
    start: str = Query("2025-12-01 19:20:42", description="Start datetime (YYYY-MM-DD HH:MM:SS)"),
    end: str = Query("2025-12-27 16:18:41", description="End datetime (YYYY-MM-DD HH:MM:SS)"),
    limit: int = 500
):
    start_ts = parse_datetime(start)
    end_ts = parse_datetime(end)
    if start_ts > end_ts:
        raise HTTPException(status_code=400, detail="start must be before end")

    chunks = pd.read_csv(
        FILE_PATH,
        chunksize=5000,
        parse_dates=["Timestamp"]
    )

    results = []

    for chunk in chunks:
        filtered = chunk[
            (chunk["Timestamp"] >= start_ts) &
            (chunk["Timestamp"] <= end_ts)
        ].copy()

        if not filtered.empty:
            filtered.sort_values("Timestamp", inplace=True)
            results.extend(filtered.to_dict(orient="records"))

    if not results:
        return []

    results.sort(key=lambda row: row["Timestamp"])
    return sample_evenly(results, limit)
