from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from math import asin, cos, radians, sin, sqrt
import time
import copy
from sqlalchemy import func
from seed.mock_data import DONATIONS, RESTAURANTS, NGOS
from services.google_maps import places_nearby_search_sync
from models import Donation, DonationStatus, NGO, Prediction, Restaurant, SessionLocal

router = APIRouter(prefix="/donations", tags=["Donations"])

# In-memory store (mirrors real DB structure)
_donations = copy.deepcopy(DONATIONS)
_next_id = len(_donations) + 1


class DonationCreate(BaseModel):
    restaurant_id: int
    food_quantity: int
    food_type: Optional[str] = "mixed"
    pickup_time: Optional[str] = None
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    notes: Optional[str] = None
    auto_match: bool = True


class DonationUpdate(BaseModel):
    status: Optional[str] = None
    ngo_id: Optional[int] = None
    notes: Optional[str] = None


class NGORequestCreate(BaseModel):
    ngo_id: int
    requested_quantity: int
    food_type: Optional[str] = "mixed"
    needed_by: Optional[str] = None
    notes: Optional[str] = None


_NEARBY_NGO_KEYWORDS = [
    "ngo",
    "charity",
    "non profit",
    "social service organization",
    "food bank",
    "community kitchen",
    "trust",
    "foundation",
]


def _parse_pickup_time(value: Optional[str]) -> Optional[datetime]:
    """
    Accept pickup time as either:
    - full ISO datetime (e.g. 2026-03-06T19:30:00)
    - time-only string from HTML input[type=time] (e.g. 19:30 or 19:30:00)
    """
    if not value:
        return None

    normalized = value.strip()
    if not normalized:
        return None

    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        pass

    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            parsed_time = datetime.strptime(normalized, fmt).time()
            return datetime.combine(date.today(), parsed_time)
        except ValueError:
            continue

    raise HTTPException(status_code=400, detail="pickup_time must be ISO datetime or HH:MM")


def _suggest_nearby_ngo(
    lat: float,
    lng: float,
    radius_km: int = 15,
    max_keywords: int = 1,
    max_duration_sec: float = 3.0,
) -> Optional[dict]:
    collected: dict[str, dict] = {}
    started_at = time.monotonic()
    keywords = _NEARBY_NGO_KEYWORDS[:max(1, max_keywords)]
    for keyword in keywords:
        if time.monotonic() - started_at > max_duration_sec:
            break
        for place in places_nearby_search_sync(lat, lng, radius_km * 1000, keyword, timeout_sec=1.2):
            if time.monotonic() - started_at > max_duration_sec:
                break
            place_id = place.get("place_id")
            if not place_id:
                continue
            location = place.get("geometry", {}).get("location", {})
            p_lat = location.get("lat")
            p_lng = location.get("lng")
            if p_lat is None or p_lng is None:
                continue

            distance_km = _haversine_km(lat, lng, p_lat, p_lng)
            rating = float(place.get("rating") or 0.0)

            # Distance-heavy ranking with rating tie-break.
            distance_score = max(0.0, 1.0 - (distance_km / 25.0))
            rating_score = min(1.0, rating / 5.0)
            score = round((0.75 * distance_score) + (0.25 * rating_score), 4)

            existing = collected.get(place_id)
            candidate = {
                "id": place_id,
                "name": place.get("name"),
                "address": place.get("vicinity") or place.get("formatted_address"),
                "lat": p_lat,
                "lng": p_lng,
                "distance_km": distance_km,
                "distance_text": f"{round(distance_km, 1)} km",
                "duration_text": None,
                "rating": rating if rating > 0 else None,
                "source": "google_places_suggestion",
                "score": score,
            }
            if existing is None or candidate["score"] > existing["score"]:
                collected[place_id] = candidate

    if not collected:
        return None

    ranked = sorted(collected.values(), key=lambda item: (item["score"], -item["distance_km"]), reverse=True)
    return ranked[0]


def _is_valid_coord(lat: Optional[float], lng: Optional[float]) -> bool:
    if lat is None or lng is None:
        return False
    return -90 <= lat <= 90 and -180 <= lng <= 180 and not (abs(lat) < 0.0001 and abs(lng) < 0.0001)


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    earth_radius_km = 6371.0
    d_lat = radians(lat2 - lat1)
    d_lng = radians(lng2 - lng1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lng / 2) ** 2
    return earth_radius_km * (2 * asin(sqrt(a)))


@router.get("")
def list_donations(status: Optional[str] = None, restaurant_id: Optional[int] = None, ngo_id: Optional[int] = None):
    db = SessionLocal()
    try:
        rows = db.query(Donation).all()
        result = []
        for donation in rows:
            entry = {
                "id": donation.id,
                "restaurant_id": donation.restaurant_id,
                "ngo_id": donation.ngo_id,
                "food_quantity": donation.food_quantity,
                "food_type": donation.food_type,
                "pickup_time": donation.pickup_time.isoformat() if donation.pickup_time else None,
                "status": donation.status.value if hasattr(donation.status, "value") else str(donation.status),
                "notes": donation.notes,
                "created_at": donation.created_at.isoformat() if donation.created_at else None,
                "restaurant_name": donation.restaurant.name if donation.restaurant else "Unknown",
                "ngo_name": donation.ngo.name if donation.ngo else "Unmatched",
            }
            result.append(entry)

        if status:
            result = [d for d in result if d["status"] == status]
        if restaurant_id:
            result = [d for d in result if d["restaurant_id"] == restaurant_id]
        if ngo_id:
            result = [d for d in result if d.get("ngo_id") == ngo_id]
        return result
    except Exception:
        result = _donations
        if status:
            result = [d for d in result if d["status"] == status]
        if restaurant_id:
            result = [d for d in result if d["restaurant_id"] == restaurant_id]
        if ngo_id:
            result = [d for d in result if d.get("ngo_id") == ngo_id]
        enriched = []
        for d in result:
            entry = dict(d)
            rest = next((r for r in RESTAURANTS if r["id"] == d["restaurant_id"]), {})
            ngo = next((n for n in NGOS if n["id"] == d.get("ngo_id")), {})
            entry["restaurant_name"] = rest.get("name", "Unknown")
            entry["ngo_name"] = ngo.get("name", "Unmatched")
            enriched.append(entry)
        return enriched
    finally:
        db.close()


@router.get("/{donation_id}")
def get_donation(donation_id: int):
    db = SessionLocal()
    try:
        donation = db.get(Donation, donation_id)
        if donation:
            return {
                "id": donation.id,
                "restaurant_id": donation.restaurant_id,
                "ngo_id": donation.ngo_id,
                "food_quantity": donation.food_quantity,
                "food_type": donation.food_type,
                "pickup_time": donation.pickup_time.isoformat() if donation.pickup_time else None,
                "status": donation.status.value if hasattr(donation.status, "value") else str(donation.status),
                "notes": donation.notes,
                "created_at": donation.created_at.isoformat() if donation.created_at else None,
            }
    finally:
        db.close()

    donation = next((d for d in _donations if d["id"] == donation_id), None)
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    return donation


@router.post("", status_code=201)
def create_donation(body: DonationCreate):
    global _next_id
    db_for_id = SessionLocal()
    try:
        max_db_id = db_for_id.query(func.max(Donation.id)).scalar()
        if max_db_id is not None:
            _next_id = max(_next_id, int(max_db_id) + 1)
    except Exception:
        pass
    finally:
        db_for_id.close()

    donation_id = _next_id
    created_at = datetime.now()
    new = {
        "id": donation_id,
        "restaurant_id": body.restaurant_id,
        "food_quantity": body.food_quantity,
        "food_type": body.food_type,
        "pickup_time": body.pickup_time,
        "notes": body.notes,
        "ngo_id": None,
        "status": "pending",
        "created_at": created_at.isoformat(),
    }
    suggested_ngo = None

    _donations.append(new)
    _next_id += 1

    db = SessionLocal()
    try:
        restaurant = db.get(Restaurant, body.restaurant_id)
        if not restaurant:
            raise HTTPException(status_code=400, detail="Restaurant not found")

        # Always keep donation open for NGO acceptance; auto-match is suggestion-only.
        new["ngo_id"] = None
        new["status"] = "pending"

        suggest_lat = restaurant.latitude if _is_valid_coord(restaurant.latitude, restaurant.longitude) else None
        suggest_lng = restaurant.longitude if _is_valid_coord(restaurant.latitude, restaurant.longitude) else None
        if suggest_lat is None and _is_valid_coord(body.pickup_lat, body.pickup_lng):
            suggest_lat = body.pickup_lat
            suggest_lng = body.pickup_lng

        if suggest_lat is not None and suggest_lng is not None:
            try:
                suggested_ngo = suggested_ngo or _suggest_nearby_ngo(
                    suggest_lat,
                    suggest_lng,
                    radius_km=12,
                    max_keywords=1,
                    max_duration_sec=1.8,
                )
            except Exception as suggestion_exc:
                print(f"[Donation] Nearby NGO suggestion skipped: {suggestion_exc}")

        pickup_time_value = _parse_pickup_time(body.pickup_time)

        donation = Donation(
            id=donation_id,
            restaurant_id=body.restaurant_id,
            ngo_id=new["ngo_id"],
            food_quantity=body.food_quantity,
            food_type=body.food_type or "mixed",
            pickup_time=pickup_time_value,
            status=DonationStatus(new["status"]),
            notes=body.notes,
            created_at=created_at,
        )
        db.add(donation)

        training_row = Prediction(
            restaurant_id=body.restaurant_id,
            predicted_surplus=float(body.food_quantity),
            prediction_date=date.today(),
            day_of_week=created_at.weekday(),
            event_flag=0,
            weather_score=0.5,
            actual_surplus=float(body.food_quantity),
        )
        db.add(training_row)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Cloud save failed: {exc}")
    finally:
        db.close()

    return {
        "donation": new,
        "matched_ngo": None,
        "suggested_ngo": suggested_ngo,
        "open_for_ngo_acceptance": True,
    }


@router.post("/request", status_code=201)
def create_ngo_request(body: NGORequestCreate):
    global _next_id

    if body.requested_quantity <= 0:
        raise HTTPException(status_code=400, detail="requested_quantity must be greater than 0")

    db_for_id = SessionLocal()
    try:
        max_db_id = db_for_id.query(func.max(Donation.id)).scalar()
        if max_db_id is not None:
            _next_id = max(_next_id, int(max_db_id) + 1)
    except Exception:
        pass
    finally:
        db_for_id.close()

    created_at = datetime.now()
    pickup_time_value = None
    if body.needed_by:
        try:
            pickup_time_value = datetime.fromisoformat(body.needed_by)
        except Exception:
            raise HTTPException(status_code=400, detail="needed_by must be an ISO datetime string")

    db = SessionLocal()
    try:
        ngo = db.get(NGO, body.ngo_id)
        if not ngo:
            raise HTTPException(status_code=404, detail="NGO not found")

        restaurants = db.query(Restaurant).all()
        if not restaurants:
            raise HTTPException(status_code=400, detail="No restaurants available for matching")

        ngo_lat = ngo.latitude
        ngo_lng = ngo.longitude
        nearby_radius_km = 20.0
        fallback_limit = 25
        targets = []
        use_nearby_scope = _is_valid_coord(ngo_lat, ngo_lng)

        for restaurant in restaurants:
            rest_lat = restaurant.latitude
            rest_lng = restaurant.longitude
            if use_nearby_scope:
                if not _is_valid_coord(rest_lat, rest_lng):
                    continue
                distance_km = _haversine_km(ngo_lat, ngo_lng, rest_lat, rest_lng)
                if distance_km > nearby_radius_km:
                    continue
            else:
                distance_km = None

            targets.append({
                "restaurant": restaurant,
                "distance_km": distance_km,
                "predicted_surplus": None,
            })

        if not targets:
            raise HTTPException(status_code=400, detail="No nearby restaurants available for matching")

        if use_nearby_scope:
            targets.sort(key=lambda item: item["distance_km"] if item["distance_km"] is not None else 10_000)
        else:
            targets = sorted(targets, key=lambda item: item["restaurant"].id)[:fallback_limit]

        request_note = f"[NGO_REQUEST] {body.notes or 'Food request submitted by NGO'}"
        created_requests = []
        for target in targets:
            donation_id = _next_id
            restaurant = target["restaurant"]
            restaurant_name = restaurant.name or f"Restaurant #{restaurant.id}"

            new = {
                "id": donation_id,
                "restaurant_id": restaurant.id,
                "food_quantity": body.requested_quantity,
                "food_type": body.food_type or "mixed",
                "pickup_time": body.needed_by,
                "notes": request_note,
                "ngo_id": body.ngo_id,
                "status": "pending",
                "created_at": created_at.isoformat(),
                "restaurant_name": restaurant_name,
                "ngo_name": ngo.name,
                "distance_km": round(target["distance_km"], 2) if target["distance_km"] is not None else None,
                "predicted_surplus": target["predicted_surplus"],
            }

            _donations.append(new)
            created_requests.append(new)
            _next_id += 1

            donation = Donation(
                id=donation_id,
                restaurant_id=restaurant.id,
                ngo_id=body.ngo_id,
                food_quantity=body.requested_quantity,
                food_type=body.food_type or "mixed",
                pickup_time=pickup_time_value,
                status=DonationStatus.PENDING,
                notes=request_note,
                created_at=created_at,
            )
            db.add(donation)
        db.commit()

        return {
            "request": created_requests[0],
            "requests": created_requests,
            "targeted_restaurants": [
                {
                    "id": item["restaurant_id"],
                    "name": item["restaurant_name"],
                    "distance_km": item.get("distance_km"),
                    "predicted_surplus": item.get("predicted_surplus"),
                }
                for item in created_requests
            ],
            "target_count": len(created_requests),
            "scope": "nearby_restaurants" if use_nearby_scope else "fallback_restaurants_no_ngo_coordinates",
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Could not create NGO request: {exc}")
    finally:
        db.close()


@router.patch("/{donation_id}")
def update_donation(donation_id: int, body: DonationUpdate):
    donation = next((d for d in _donations if d["id"] == donation_id), None)
    if donation:
        if body.status:
            donation["status"] = body.status
        if body.ngo_id:
            donation["ngo_id"] = body.ngo_id
        if body.notes:
            donation["notes"] = body.notes

    db = SessionLocal()
    try:
        db_donation = db.get(Donation, donation_id)
        if not db_donation:
            if donation:
                return donation
            raise HTTPException(status_code=404, detail="Donation not found")
        if body.status:
            db_donation.status = DonationStatus(body.status)
        if body.ngo_id is not None:
            ngo = db.get(NGO, body.ngo_id)
            if not ngo:
                raise HTTPException(status_code=400, detail="NGO not found")
            db_donation.ngo_id = body.ngo_id
        if body.notes is not None:
            db_donation.notes = body.notes
        db.commit()
        db.refresh(db_donation)
        return {
            "id": db_donation.id,
            "restaurant_id": db_donation.restaurant_id,
            "ngo_id": db_donation.ngo_id,
            "food_quantity": db_donation.food_quantity,
            "food_type": db_donation.food_type,
            "pickup_time": db_donation.pickup_time.isoformat() if db_donation.pickup_time else None,
            "status": db_donation.status.value if hasattr(db_donation.status, "value") else str(db_donation.status),
            "notes": db_donation.notes,
            "created_at": db_donation.created_at.isoformat() if db_donation.created_at else None,
        }
    except HTTPException:
        db.rollback()
        raise
    finally:
        db.close()

    if donation:
        return donation
    raise HTTPException(status_code=404, detail="Donation not found")
