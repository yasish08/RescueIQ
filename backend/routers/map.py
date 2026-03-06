from fastapi import APIRouter
from models import SessionLocal, Restaurant, NGO, Donation, DonationStatus

router = APIRouter(prefix="/map", tags=["Map"])


def _is_valid_coord(lat, lng) -> bool:
    if lat is None or lng is None:
        return False
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return False
    if abs(lat) < 0.0001 and abs(lng) < 0.0001:
        return False
    return True


@router.get("/pins")
def get_map_pins():
    db = SessionLocal()
    try:
        restaurants = db.query(Restaurant).all()
        ngos = db.query(NGO).all()

        if restaurants or ngos:
            restaurant_pins = [
                {
                    "type": "restaurant",
                    "id": r.id,
                    "name": r.name,
                    "lat": r.latitude,
                    "lng": r.longitude,
                    "address": r.address,
                    "cuisine_type": r.cuisine_type,
                }
                for r in restaurants
                if _is_valid_coord(r.latitude, r.longitude)
            ]

            ngo_pins = [
                {
                    "type": "ngo",
                    "id": n.id,
                    "name": n.name,
                    "lat": n.latitude,
                    "lng": n.longitude,
                    "address": n.address,
                    "capacity": n.capacity,
                    "current_load": n.current_load,
                    "phone": n.phone,
                }
                for n in ngos
                if _is_valid_coord(n.latitude, n.longitude)
            ]

            return {"restaurants": restaurant_pins, "ngos": ngo_pins}
    except Exception:
        pass
    finally:
        db.close()

    return {"restaurants": [], "ngos": []}


@router.get("/routes")
def get_active_routes():
    """Return accepted donation routes (restaurant → NGO) for map polylines."""
    db = SessionLocal()
    try:
        rows = db.query(Donation).filter(Donation.status == DonationStatus.ACCEPTED).all()
        if rows:
            routes = []
            for d in rows:
                rest = d.restaurant
                ngo = d.ngo
                if rest and ngo and _is_valid_coord(rest.latitude, rest.longitude) and _is_valid_coord(ngo.latitude, ngo.longitude):
                    routes.append({
                        "donation_id": d.id,
                        "status": d.status.value if hasattr(d.status, "value") else str(d.status),
                        "from": {"lat": rest.latitude, "lng": rest.longitude, "name": rest.name},
                        "to": {"lat": ngo.latitude, "lng": ngo.longitude, "name": ngo.name},
                        "quantity": d.food_quantity,
                    })
            return routes
    except Exception:
        pass
    finally:
        db.close()

    return []
