from fastapi import FastAPI, Query
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


@app.get("/")
def root():
    return {"message": "API is running"}


@app.get("/data")
def get_data(
    start: str = Query(..., description="Start datetime (YYYY-MM-DD HH:MM:SS)"),
    end: str = Query(..., description="End datetime (YYYY-MM-DD HH:MM:SS)"),
    limit: int = 500
):
    chunks = pd.read_csv(
        FILE_PATH,
        chunksize=5000,
        parse_dates=["Timestamp"]
    )

    results = []

    for chunk in chunks:
        filtered = chunk[
            (chunk["Timestamp"] >= start) &
            (chunk["Timestamp"] <= end)
        ]

        if not filtered.empty:
            results.extend(filtered.to_dict(orient="records"))

        if len(results) >= limit:
            break

    return results[:limit]