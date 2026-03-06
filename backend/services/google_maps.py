"""
Google Maps API Service
Uses: Distance Matrix API, Geocoding API, Places API (via backend proxy)
"""
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")

BASE = "https://maps.googleapis.com/maps/api"


async def get_driving_distance(
    origin_lat: float, origin_lng: float,
    dest_lat: float, dest_lng: float
) -> dict:
    """
    Get real driving distance + duration between two points
    using the Distance Matrix API.
    Falls back to geodesic straight-line if API unavailable.
    """
    if not GOOGLE_MAPS_API_KEY:
        return _geodesic_fallback(origin_lat, origin_lng, dest_lat, dest_lng)

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{BASE}/distancematrix/json", params={
                "origins": f"{origin_lat},{origin_lng}",
                "destinations": f"{dest_lat},{dest_lng}",
                "mode": "driving",
                "units": "metric",
                "key": GOOGLE_MAPS_API_KEY,
            })
            data = r.json()
            element = data["rows"][0]["elements"][0]
            if element["status"] == "OK":
                return {
                    "distance_km": round(element["distance"]["value"] / 1000, 2),
                    "duration_min": round(element["duration"]["value"] / 60, 1),
                    "distance_text": element["distance"]["text"],
                    "duration_text": element["duration"]["text"],
                    "source": "google",
                }
    except Exception as e:
        print(f"[Google Maps] Distance Matrix failed: {e}. Using geodesic fallback.")

    return _geodesic_fallback(origin_lat, origin_lng, dest_lat, dest_lng)


def get_driving_distance_sync(
    origin_lat: float, origin_lng: float,
    dest_lat: float, dest_lng: float
) -> dict:
    """Synchronous version for use inside the matching algorithm."""
    import httpx as _httpx
    if not GOOGLE_MAPS_API_KEY:
        return _geodesic_fallback(origin_lat, origin_lng, dest_lat, dest_lng)
    try:
        r = _httpx.get(f"{BASE}/distancematrix/json", params={
            "origins": f"{origin_lat},{origin_lng}",
            "destinations": f"{dest_lat},{dest_lng}",
            "mode": "driving",
            "units": "metric",
            "key": GOOGLE_MAPS_API_KEY,
        }, timeout=5.0)
        data = r.json()
        element = data["rows"][0]["elements"][0]
        if element["status"] == "OK":
            return {
                "distance_km": round(element["distance"]["value"] / 1000, 2),
                "duration_min": round(element["duration"]["value"] / 60, 1),
                "distance_text": element["distance"]["text"],
                "duration_text": element["duration"]["text"],
                "source": "google",
            }
    except Exception as e:
        print(f"[Google Maps] Sync distance failed: {e}. Falling back.")
    return _geodesic_fallback(origin_lat, origin_lng, dest_lat, dest_lng)


async def geocode_address(address: str) -> dict | None:
    """Convert a text address to lat/lng using Geocoding API."""
    if not GOOGLE_MAPS_API_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{BASE}/geocode/json", params={
                "address": address,
                "region": "in",          # bias results to India
                "key": GOOGLE_MAPS_API_KEY,
            })
            data = r.json()
            if data["results"]:
                loc = data["results"][0]["geometry"]["location"]
                return {
                    "lat": loc["lat"],
                    "lng": loc["lng"],
                    "formatted_address": data["results"][0]["formatted_address"],
                }
    except Exception as e:
        print(f"[Google Maps] Geocoding failed: {e}")
    return None


def geocode_address_sync(address: str) -> dict | None:
    """Synchronous geocode helper for non-async router paths."""
    import httpx as _httpx

    if not GOOGLE_MAPS_API_KEY:
        return None
    try:
        r = _httpx.get(f"{BASE}/geocode/json", params={
            "address": address,
            "region": "in",
            "key": GOOGLE_MAPS_API_KEY,
        }, timeout=5.0)
        data = r.json()
        if data.get("results"):
            loc = data["results"][0]["geometry"]["location"]
            return {
                "lat": loc["lat"],
                "lng": loc["lng"],
                "formatted_address": data["results"][0].get("formatted_address"),
            }
    except Exception as e:
        print(f"[Google Maps] Sync geocoding failed: {e}")
    return None


async def places_autocomplete(query: str, location: str = "12.9716,77.5946", radius: int = 20000) -> list:
    """
    Return place suggestions using the Places Autocomplete API.
    Biased to Bangalore (lat,lng) within `radius` metres.
    """
    if not GOOGLE_MAPS_API_KEY:
        return []
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{BASE}/place/autocomplete/json", params={
                "input": query,
                "location": location,
                "radius": radius,
                "types": "establishment|geocode",
                "key": GOOGLE_MAPS_API_KEY,
            })
            data = r.json()
            return [
                {
                    "place_id": p["place_id"],
                    "description": p["description"],
                    "main_text": p["structured_formatting"]["main_text"],
                }
                for p in data.get("predictions", [])[:5]
            ]
    except Exception as e:
        print(f"[Google Maps] Places autocomplete failed: {e}")
    return []


async def get_place_details(place_id: str) -> dict | None:
    """Resolve a place_id to lat/lng + address."""
    if not GOOGLE_MAPS_API_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{BASE}/place/details/json", params={
                "place_id": place_id,
                "fields": "geometry,formatted_address,name",
                "key": GOOGLE_MAPS_API_KEY,
            })
            data = r.json()
            result = data.get("result", {})
            loc = result.get("geometry", {}).get("location", {})
            if loc:
                return {
                    "lat": loc["lat"],
                    "lng": loc["lng"],
                    "name": result.get("name"),
                    "formatted_address": result.get("formatted_address"),
                }
    except Exception as e:
        print(f"[Google Maps] Place details failed: {e}")
    return None


async def places_nearby_search(lat: float, lng: float, radius_m: int, keyword: str) -> list[dict]:
    """Nearby places search around a coordinate for a specific keyword."""
    if not GOOGLE_MAPS_API_KEY:
        return []
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(f"{BASE}/place/nearbysearch/json", params={
                "location": f"{lat},{lng}",
                "radius": radius_m,
                "keyword": keyword,
                "key": GOOGLE_MAPS_API_KEY,
            })
            data = r.json()
            return data.get("results", [])
    except Exception as e:
        print(f"[Google Maps] Nearby search failed for '{keyword}': {e}")
        return []


def places_nearby_search_sync(lat: float, lng: float, radius_m: int, keyword: str, timeout_sec: float = 8.0) -> list[dict]:
    """Synchronous nearby places search for non-async code paths."""
    if not GOOGLE_MAPS_API_KEY:
        return []
    try:
        import httpx as _httpx

        r = _httpx.get(
            f"{BASE}/place/nearbysearch/json",
            params={
                "location": f"{lat},{lng}",
                "radius": radius_m,
                "keyword": keyword,
                "key": GOOGLE_MAPS_API_KEY,
            },
            timeout=timeout_sec,
        )
        data = r.json()
        return data.get("results", [])
    except Exception as e:
        print(f"[Google Maps] Sync nearby search failed for '{keyword}': {e}")
        return []


async def places_text_search(lat: float, lng: float, radius_m: int, query: str) -> list[dict]:
    """Places text search around a coordinate for broader NGO discovery."""
    if not GOOGLE_MAPS_API_KEY:
        return []
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(f"{BASE}/place/textsearch/json", params={
                "query": query,
                "location": f"{lat},{lng}",
                "radius": radius_m,
                "key": GOOGLE_MAPS_API_KEY,
            })
            data = r.json()
            return data.get("results", [])
    except Exception as e:
        print(f"[Google Maps] Text search failed for '{query}': {e}")
        return []


def _geodesic_fallback(lat1, lng1, lat2, lng2) -> dict:
    """Straight-line distance fallback when Google API is unavailable."""
    from geopy.distance import geodesic
    km = round(geodesic((lat1, lng1), (lat2, lng2)).km, 2)
    return {
        "distance_km": km,
        "duration_min": round(km / 0.4, 1),   # rough ~24 km/h city speed
        "distance_text": f"{km} km",
        "duration_text": f"{round(km / 0.4)} min",
        "source": "geodesic",
    }
