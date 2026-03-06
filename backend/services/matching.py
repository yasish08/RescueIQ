"""
Smart NGO Matching Algorithm using DB-first entities with seed fallback.
Scores each NGO by weighted combination:
  - Driving distance (inverse) weight 0.4
  - Urgency score              weight 0.3
  - Capacity ratio             weight 0.2
  - Reliability score          weight 0.1
"""
import copy

from models import SessionLocal, Restaurant, NGO
from seed.mock_data import NGOS, RESTAURANTS
from services.google_maps import get_driving_distance_sync


def _get_restaurants():
    db = SessionLocal()
    try:
        rows = db.query(Restaurant).all()
        if rows:
            return [
                {
                    "id": r.id,
                    "name": r.name,
                    "latitude": r.latitude,
                    "longitude": r.longitude,
                    "avg_daily_covers": r.avg_daily_covers,
                    "reliability_score": r.reliability_score,
                }
                for r in rows
            ]
    except Exception:
        pass
    finally:
        db.close()

    return copy.deepcopy(RESTAURANTS)


def _get_ngos():
    db = SessionLocal()
    try:
        rows = db.query(NGO).all()
        if rows:
            return [
                {
                    "id": n.id,
                    "name": n.name,
                    "address": n.address,
                    "latitude": n.latitude,
                    "longitude": n.longitude,
                    "capacity": n.capacity,
                    "current_load": n.current_load,
                    "urgency_score": n.urgency_score,
                    "reliability_score": n.reliability_score,
                    "phone": n.phone,
                }
                for n in rows
            ]
    except Exception:
        pass
    finally:
        db.close()

    return copy.deepcopy(NGOS)


def score_ngo(ngo: dict, restaurant_lat: float, restaurant_lng: float) -> tuple[float, dict]:
    dist_info = get_driving_distance_sync(
        restaurant_lat, restaurant_lng,
        ngo["latitude"], ngo["longitude"]
    )
    distance_km = dist_info["distance_km"]

    distance_score = max(0.0, 1.0 - distance_km / 25.0)

    capacity = max(1, ngo.get("capacity", 1))
    available = ngo.get("capacity", 0) - ngo.get("current_load", 0)
    capacity_ratio = max(0.0, min(1.0, available / capacity))

    urgency = ngo.get("urgency_score", 0.5)
    reliability = ngo.get("reliability_score", 0.8)

    score = (
        0.4 * distance_score
        + 0.3 * urgency
        + 0.2 * capacity_ratio
        + 0.1 * reliability
    )

    return round(score, 4), dist_info


def match_ngo(restaurant_id: int, food_quantity: int) -> dict:
    restaurants = _get_restaurants()
    restaurant = next((r for r in restaurants if r["id"] == restaurant_id), None)
    if not restaurant:
        raise ValueError(f"Restaurant ID {restaurant_id} not found.")

    ngos = _get_ngos()
    scored = []

    for ngo in ngos:
        available = ngo.get("capacity", 0) - ngo.get("current_load", 0)
        if available < food_quantity:
            continue

        s, dist_info = score_ngo(ngo, restaurant["latitude"], restaurant["longitude"])
        scored.append({
            **ngo,
            "score": s,
            "distance_km": dist_info.get("distance_km"),
            "duration_min": dist_info.get("duration_min"),
            "distance_text": dist_info.get("distance_text"),
            "duration_text": dist_info.get("duration_text"),
            "distance_source": dist_info.get("source", "geodesic"),
        })

    if not scored:
        for ngo in ngos:
            s, dist_info = score_ngo(ngo, restaurant["latitude"], restaurant["longitude"])
            scored.append({
                **ngo,
                "score": s,
                "distance_km": dist_info.get("distance_km"),
                "duration_min": dist_info.get("duration_min"),
                "distance_text": dist_info.get("distance_text"),
                "duration_text": dist_info.get("duration_text"),
                "distance_source": dist_info.get("source", "geodesic"),
            })

    if not scored:
        raise ValueError("No NGOs available for matching.")

    best = max(scored, key=lambda x: x["score"])
    ranked = sorted(scored, key=lambda x: x["score"], reverse=True)

    return {
        "matched_ngo": best,
        "all_ranked": ranked[:5],
        "restaurant": restaurant,
    }


def get_all_ngos():
    return _get_ngos()


def get_all_restaurants():
    return _get_restaurants()
