from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from geopy.distance import geodesic
from services.google_maps import (
    geocode_address,
    places_autocomplete,
    get_place_details,
    get_driving_distance,
    places_nearby_search,
    places_text_search,
)
from models import SessionLocal, NGO

router = APIRouter(prefix="/geocode", tags=["Geocoding & Places"])


class GeocodeRequest(BaseModel):
    address: str


class PlacesRequest(BaseModel):
    query: str
    location: Optional[str] = "12.9716,77.5946"
    radius: Optional[int] = 20000


class PlaceDetailRequest(BaseModel):
    place_id: str


class DistanceRequest(BaseModel):
    origin_lat: float
    origin_lng: float
    dest_lat: float
    dest_lng: float


class NearbyNGORequest(BaseModel):
    lat: float
    lng: float
    target_count: int = 0
    step_km: int = 10
    max_radius_km: int = 100


def _is_valid_coord(lat, lng) -> bool:
    if lat is None or lng is None:
        return False
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return False
    if abs(lat) < 0.0001 and abs(lng) < 0.0001:
        return False
    return True


def _db_nearby_ngos(lat: float, lng: float, max_radius_km: int) -> list[dict]:
    db = SessionLocal()
    try:
        records = db.query(NGO).all()
        result: list[dict] = []
        for ngo in records:
            ngo_lat = getattr(ngo, "latitude", None)
            ngo_lng = getattr(ngo, "longitude", None)
            if not _is_valid_coord(ngo_lat, ngo_lng):
                continue
            distance_km = round(geodesic((lat, lng), (ngo_lat, ngo_lng)).km, 2)
            if distance_km > max_radius_km:
                continue
            result.append({
                "id": f"db-{ngo.id}",
                "db_ngo_id": ngo.id,
                "name": ngo.name,
                "lat": ngo_lat,
                "lng": ngo_lng,
                "distance_km": distance_km,
                "address": ngo.address,
                "rating": None,
                "types": ["db_ngo_profile"],
                "source": "db_ngos",
            })
        result.sort(key=lambda item: item["distance_km"])
        return result
    except Exception:
        return []
    finally:
        db.close()


NEARBY_NGO_KEYWORDS = [
    "ngo",
    "charity",
    "charitable trust",
    "orphanage",
    "old age home",
    "ashram",
    "ashramam",
    "food bank",
    "community kitchen",
    "shelter",
    "homeless shelter",
    "annadhanam",
    "annadhan trust",
    "relief center",
    "temple charity",
    "church charity",
    "mosque charity",
    "foundation",
    "volunteer organization",
]

NEARBY_NGO_TEXT_QUERIES = [
    "non profit organization",
    "social service organization",
    "charitable organization",
    "food relief organization",
    "community welfare trust",
]

EXCLUDED_PLACE_TYPES = {
    "restaurant",
    "meal_delivery",
    "meal_takeaway",
    "cafe",
    "bar",
    "night_club",
    "lodging",
    "banquet_hall",
    "place_of_worship",
    "hindu_temple",
    "mosque",
    "church",
}

EXCLUDED_NAME_TOKENS = [
    "restaurant",
    "resturant",
    "marriage hall",
    "wedding hall",
    "banquet",
    "convention",
    "hotel",
    "resort",
    "cafe",
    "bistro",
    "private limited",
    "pvt ltd",
    "pvt. ltd",
    "limited",
    "llp",
    "llc",
    "inc",
    "corp",
    "corporation",
    "company",
    "software",
    "technologies",
    "solutions",
    "consulting",
    "logistics",
]

INCLUDE_NAME_TOKENS = [
    "ngo",
    "trust",
    "foundation",
    "charity",
    "charitable",
    "orphanage",
    "ashram",
    "old age home",
    "shelter",
    "welfare",
    "social service",
    "non profit",
    "non-profit",
    "uthavum karangal",
    "karangal",
    "seva",
    "sangam",
    "association",
    "society",
    "nonprofit",
]


def _is_likely_ngo(name: str | None, place_types: list[str] | None, address: str | None = None) -> bool:
    normalized_name = (name or "").strip().lower()
    normalized_address = (address or "").strip().lower()
    normalized_types = {str(item).strip().lower() for item in (place_types or [])}

    if "db_ngo_profile" in normalized_types:
        return True
    if any(token in normalized_name for token in EXCLUDED_NAME_TOKENS):
        return False
    if normalized_types & EXCLUDED_PLACE_TYPES:
        return False
    if any(token in normalized_name for token in INCLUDE_NAME_TOKENS):
        return True
    if any(token in normalized_address for token in INCLUDE_NAME_TOKENS):
        return True

    return (
        "non_profit_organization" in normalized_types
        or "social_services_organization" in normalized_types
        or "charity" in normalized_types
    )


@router.post("/address")
async def geocode(body: GeocodeRequest):
    result = await geocode_address(body.address)
    if not result:
        return {"error": "Could not geocode address"}
    return result


@router.post("/autocomplete")
async def autocomplete(body: PlacesRequest):
    results = await places_autocomplete(body.query, body.location, body.radius)
    return {"predictions": results}


@router.post("/place")
async def place_detail(body: PlaceDetailRequest):
    result = await get_place_details(body.place_id)
    if not result:
        return {"error": "Could not fetch place details"}
    return result


@router.post("/distance")
async def driving_distance(body: DistanceRequest):
    result = await get_driving_distance(
        body.origin_lat, body.origin_lng,
        body.dest_lat, body.dest_lng
    )
    return result


@router.post("/nearby-ngos")
async def nearby_ngos(body: NearbyNGORequest):
    target = body.target_count if body.target_count and body.target_count > 0 else None
    if target is not None:
        target = min(target, 200)
    step_km = max(1, body.step_km)
    max_radius_km = max(step_km, body.max_radius_km)

    collected_by_place_id: dict[str, dict] = {}
    searched_radius_km = 0

    radius_km = step_km
    while radius_km <= max_radius_km and (target is None or len(collected_by_place_id) < target):
        radius_m = radius_km * 1000
        for keyword in NEARBY_NGO_KEYWORDS:
            results = await places_nearby_search(body.lat, body.lng, radius_m, keyword)
            for place in results:
                place_id = place.get("place_id")
                if not place_id:
                    continue
                loc = place.get("geometry", {}).get("location", {})
                lat = loc.get("lat")
                lng = loc.get("lng")
                if lat is None or lng is None:
                    continue
                place_name = place.get("name")
                place_types = place.get("types", [])
                place_address = place.get("vicinity") or place.get("formatted_address")
                if not _is_likely_ngo(place_name, place_types, place_address):
                    continue

                distance_km = round(geodesic((body.lat, body.lng), (lat, lng)).km, 2)
                if place_id not in collected_by_place_id or distance_km < collected_by_place_id[place_id]["distance_km"]:
                    collected_by_place_id[place_id] = {
                        "id": place_id,
                        "name": place_name,
                        "lat": lat,
                        "lng": lng,
                        "distance_km": distance_km,
                        "address": place.get("vicinity") or place.get("formatted_address"),
                        "rating": place.get("rating"),
                        "types": place_types,
                        "source": "google_places",
                    }
        for query in NEARBY_NGO_TEXT_QUERIES:
            results = await places_text_search(body.lat, body.lng, radius_m, query)
            for place in results:
                place_id = place.get("place_id")
                if not place_id:
                    continue
                loc = place.get("geometry", {}).get("location", {})
                lat = loc.get("lat")
                lng = loc.get("lng")
                if lat is None or lng is None:
                    continue
                place_name = place.get("name")
                place_types = place.get("types", [])
                place_address = place.get("formatted_address") or place.get("vicinity")
                if not _is_likely_ngo(place_name, place_types, place_address):
                    continue

                distance_km = round(geodesic((body.lat, body.lng), (lat, lng)).km, 2)
                if place_id not in collected_by_place_id or distance_km < collected_by_place_id[place_id]["distance_km"]:
                    collected_by_place_id[place_id] = {
                        "id": place_id,
                        "name": place_name,
                        "lat": lat,
                        "lng": lng,
                        "distance_km": distance_km,
                        "address": place.get("formatted_address") or place.get("vicinity"),
                        "rating": place.get("rating"),
                        "types": place_types,
                        "source": "google_places_text",
                    }
        searched_radius_km = radius_km
        radius_km += step_km

    ngos = sorted(collected_by_place_id.values(), key=lambda item: item["distance_km"])

    # Fallback/augment with NGO profiles from DB when Places is unavailable/sparse.
    db_candidates = _db_nearby_ngos(body.lat, body.lng, max_radius_km)
    if db_candidates:
        existing_coords = {
            (round(item["lat"], 4), round(item["lng"], 4))
            for item in ngos
            if isinstance(item.get("lat"), (int, float)) and isinstance(item.get("lng"), (int, float))
        }
        for item in db_candidates:
            if not _is_likely_ngo(item.get("name"), item.get("types", [])):
                continue
            coord_key = (round(item["lat"], 4), round(item["lng"], 4))
            if coord_key in existing_coords:
                continue
            ngos.append(item)
            existing_coords.add(coord_key)

    ngos.sort(key=lambda item: item["distance_km"])
    if target is not None:
        ngos = ngos[:target]
    return {
        "ngos": ngos,
        "count": len(ngos),
        "searched_radius_km": searched_radius_km,
        "target_count": target or 0,
        "step_km": step_km,
    }
