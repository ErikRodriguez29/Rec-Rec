#!/usr/bin/env python3
import csv
import json
import sys
import time
from datetime import datetime

import requests

URL = "https://goboardapi.azurewebsites.net/api/FacilityCount/GetCountsByAccount?AccountAPIKey=9ff6a29d-9ef2-4d75-97ea-187f31ac0025"
CSV_FILE = "facility_counts.csv"
INTERVAL_SECONDS = 5 * 60  # Every 5 Minutes
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_LATITUDE = 34.4140
OPEN_METEO_LONGITUDE = -119.8489  # UCSB Coordinates


def parse_api_timestamp(value: object) -> datetime | None:
    if not value:
        return None
    s = str(value)
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def get_json(url):
    response = requests.get(
        url,
        timeout=30,
        headers={
            "Accept": "application/json,*/*;q=0.8",
        },
    )
    response.raise_for_status()  # Raise an exception for bad status codes
    return response.json(), response.headers.get("content-type", "")


def get_open_meteo_is_raining() -> bool | None:
    """
    Returns whether Open-Meteo's weather_code indicates precipitation (drizzle+),
    i.e. weather_code >= 51 (drizzle, rain, freezing rain, snow, showers, etc.).
    None means we couldn't determine it (network/API error).
    """
    # Weather code: 51–67 drizzle/rain; higher codes include snow, showers, thunderstorms.
    WMO_PRECIP_THRESHOLD = 51
    params = {
        "latitude": OPEN_METEO_LATITUDE,
        "longitude": OPEN_METEO_LONGITUDE,
        "current": "weather_code",
        "timezone": "UTC",
    }
    for attempt in range(2):
        try:
            response = requests.get(
                OPEN_METEO_URL,
                params=params,
                timeout=30,
                headers={"Accept": "application/json,*/*;q=0.8"},
            )
            response.raise_for_status()
            payload = response.json()
            current = payload.get("current") if isinstance(payload, dict) else None
            if not isinstance(current, dict):
                return None
            code = current.get("weather_code")
            try:
                code_int = int(float(code))
            except (TypeError, ValueError):
                return None
            return code_int >= WMO_PRECIP_THRESHOLD
        except Exception:
            if attempt == 0:
                time.sleep(1)
                continue
            return None


def scrape_facility_counts(data, *, is_raining: bool | None):
    facilities = []

    if isinstance(data, dict):
        for key in ("items", "data", "value", "results"):
            if key in data:
                data = data[key]
                break

    if not isinstance(data, list):
        raise ValueError(f"Expected JSON list, got {type(data).__name__}")

    for item in data:
        if not isinstance(item, dict):
            continue

        location_name = str(item.get("LocationName") or "").strip()
        if not location_name:
            continue

        # Check if facility is closed with the IsClosed property
        is_closed = item.get("IsClosed", False)
        if is_closed:
            print(f"{location_name} is currently closed, skipping...")
            continue

        # Timestamp in CSV based on API LastUpdatedDateAndTime
        dt = parse_api_timestamp(item.get("LastUpdatedDateAndTime"))
        if dt is None:
            continue

        # Set current count equal to last count (Idk if this is right or if last count refers to the previous timestamp, but seems right based on percentage values on the website)
        current_count = item.get("LastCount", "N/A")

        # Get total_capacity from the API
        total_capacity = item.get("TotalCapacity", 0)

        # Calculate percentage_filled
        try:
            current_count_float = float(current_count)
            total_capacity_float = float(total_capacity)
            if total_capacity_float > 0:
                percentage_filled = (current_count_float / total_capacity_float) * 100
                percentage_filled_str = f"{percentage_filled:.2f}"
            else:
                percentage_filled_str = "0.00"
        except (ValueError, ZeroDivisionError):
            percentage_filled_str = "0.00"

        formatted_timestamp = dt.strftime("%Y-%m-%d %H:%M:%S")
        day_of_week = dt.weekday()

        facilities.append(
            {
                "facility_name": location_name,
                "current_count": str(current_count),
                "total_capacity": str(total_capacity),
                "percentage_filled": percentage_filled_str,
                "timestamp": formatted_timestamp,
                "day_of_week": day_of_week,
                "is_raining": is_raining,
            }
        )

    return facilities


def load_existing_keys(filename: str) -> set[tuple[str, str]]:
    # Prevent duplicate timestamps if the facility hasn't been updated in a while
    keys: set[tuple[str, str]] = set()
    try:
        with open(filename, "r", newline="", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                fn = (row.get("facility_name") or "").strip()
                ts = (row.get("timestamp") or "").strip()
                if fn and ts:
                    keys.add((fn, ts))
    except FileNotFoundError:
        pass
    return keys


def save_to_csv(facilities, filename=CSV_FILE):
    if not facilities:
        return
    file_exists = False
    try:
        with open(filename, "r"):
            file_exists = True
    except FileNotFoundError:
        pass

    existing_keys = load_existing_keys(filename)
    deduped = []
    for row in facilities:
        key = (
            str(row.get("facility_name") or "").strip(),
            str(row.get("timestamp") or "").strip(),
        )
        if not key[0] or not key[1]:
            continue
        if key in existing_keys:
            continue
        existing_keys.add(key)
        deduped.append(row)

    with open(filename, "a", newline="", encoding="utf-8") as csvfile:
        fieldnames = [
            "facility_name",
            "current_count",
            "total_capacity",
            "percentage_filled",
            "timestamp",
            "day_of_week",
            "is_raining",
        ]
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames, extrasaction="ignore")
        if not file_exists:
            writer.writeheader()
        writer.writerows(deduped)


def main():
    print(f"Starting\nPress Ctrl+C to stop\n")

    while True:
        try:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Scraping...")
            is_raining = get_open_meteo_is_raining()
            data, content_type = get_json(URL)

            # Save raw JSON for debugging
            with open("raw.json", "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

            facilities = scrape_facility_counts(data, is_raining=is_raining)

            if facilities:
                save_to_csv(facilities)
                print(f"Successfully scraped {len(facilities)} facilities")
            else:
                print(f"No data found.")

            time.sleep(INTERVAL_SECONDS)
        except KeyboardInterrupt:
            sys.exit(0)
        except Exception as e:
            print(f"Unexpected error: {e}")
            time.sleep(60)  # Wait a minute before retry if crashed


if __name__ == "__main__":
    main()
