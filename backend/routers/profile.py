"""
Profile router — restaurant / NGO profile management + credential format verification
"""
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import func

from models import Donation, NGO, Restaurant, Review, SessionLocal, User
from services.google_maps import geocode_address_sync

router = APIRouter(prefix="/profile", tags=["Profile"])


def _safe_avg_review_rating(db, user_id: str) -> Optional[float]:
    try:
        value = db.query(func.avg(Review.rating)).filter(Review.reviewee_id == user_id).scalar()
        return float(value) if value is not None else None
    except Exception as exc:
        db.rollback()
        print(f"[Profile] Trust avg review fallback for user {user_id}: {exc}")
        return None


def _is_valid_coord(lat, lng) -> bool:
    if lat is None or lng is None:
        return False
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return False
    if abs(lat) < 0.0001 and abs(lng) < 0.0001:
        return False
    return True


# ── Validators ───────────────────────────────────────────
GSTIN_REGEX = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z]\d$")
CERTIFICATE_REGEX = re.compile(r"^[A-Z]{2,5}/\d{4,8}/\d{4}$")


class GSTINVerify(BaseModel):
    gstin: str


class CertVerify(BaseModel):
    certificate_number: str


class RestaurantUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    cuisine_type: Optional[str] = None
    phone: Optional[str] = None
    gstin: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class NGOUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    certificate_number: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


# ── Restaurant profile ───────────────────────────────────
@router.get("/restaurant/{user_id}")
def get_restaurant_profile(user_id: str):
    db = SessionLocal()
    try:
        rest = db.query(Restaurant).filter(Restaurant.user_id == user_id).first()
        if not rest:
            user_row = db.query(User).filter(User.id == user_id).first()
            if not user_row:
                raise HTTPException(status_code=404, detail="User not found")
            role_value = str(getattr(user_row.role, "value", user_row.role))
            if role_value not in {"restaurant", "provider"}:
                raise HTTPException(status_code=404, detail="Restaurant profile not found")

            rest = Restaurant(
                user_id=user_id,
                name=user_row.name or "Restaurant",
                address="(not set)",
                latitude=0.0,
                longitude=0.0,
                cuisine_type=None,
            )
            db.add(rest)
            db.commit()
            db.refresh(rest)
        user = db.query(User).filter(User.id == user_id).first()

        donations = db.query(Donation).filter(Donation.restaurant_id == rest.id).all()
        avg_review_rating = _safe_avg_review_rating(db, user_id)
        reliability_factor = float(rest.reliability_score) if rest.reliability_score is not None else 0.0
        trust_rating = round(avg_review_rating * reliability_factor, 1) if avg_review_rating is not None else None
        don_list = []
        for d in donations:
            don_list.append({
                "id": d.id,
                "food_quantity": d.food_quantity,
                "food_type": d.food_type,
                "status": d.status.value if hasattr(d.status, "value") else str(d.status),
                "ngo_name": d.ngo.name if d.ngo else "Unmatched",
                "created_at": d.created_at.isoformat() if d.created_at else None,
            })

        return {
            "restaurant": {
                "id": rest.id,
                "user_id": rest.user_id,
                "name": rest.name,
                "address": rest.address,
                "latitude": rest.latitude,
                "longitude": rest.longitude,
                "cuisine_type": rest.cuisine_type,
                "avg_daily_covers": rest.avg_daily_covers,
                "reliability_score": rest.reliability_score,
                "avg_review_rating": round(avg_review_rating, 2) if avg_review_rating is not None else None,
                "trust_rating": trust_rating,
                "gstin": rest.gstin,
                "created_at": rest.created_at.isoformat() if rest.created_at else None,
            },
            "user": {
                "email": user.email if user else None,
                "phone": user.phone if user else None,
            },
            "donations": don_list,
        }
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Restaurant profile load failed: {exc}")
    finally:
        db.close()


@router.patch("/restaurant/{user_id}")
def update_restaurant_profile(user_id: str, body: RestaurantUpdate):
    db = SessionLocal()
    try:
        rest = db.query(Restaurant).filter(Restaurant.user_id == user_id).first()
        if not rest:
            raise HTTPException(status_code=404, detail="Restaurant profile not found")

        if body.name is not None:
            rest.name = body.name
        address_text = body.address.strip() if isinstance(body.address, str) else body.address
        if address_text is not None:
            rest.address = address_text
        if body.cuisine_type is not None:
            rest.cuisine_type = body.cuisine_type
        if body.gstin is not None:
            rest.gstin = body.gstin
        if body.latitude is not None:
            rest.latitude = body.latitude
        if body.longitude is not None:
            rest.longitude = body.longitude

        # If only address is updated (without explicit coords), attempt server-side geocoding.
        if address_text and (body.latitude is None or body.longitude is None):
            geocoded = geocode_address_sync(address_text)
            geo_lat = geocoded.get("lat") if geocoded else None
            geo_lng = geocoded.get("lng") if geocoded else None
            if _is_valid_coord(geo_lat, geo_lng):
                rest.latitude = geo_lat
                rest.longitude = geo_lng
                formatted = geocoded.get("formatted_address")
                if formatted:
                    rest.address = formatted

        # Also update user phone if provided
        if body.phone is not None:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user.phone = body.phone

        db.commit()
        return {
            "status": "updated",
            "restaurant": {
                "id": rest.id,
                "address": rest.address,
                "latitude": rest.latitude,
                "longitude": rest.longitude,
            },
        }
    except HTTPException:
        db.rollback()
        raise
    finally:
        db.close()


# ── NGO profile ──────────────────────────────────────────
@router.get("/ngo/{user_id}")
def get_ngo_profile(user_id: str):
    db = SessionLocal()
    try:
        ngo = db.query(NGO).filter(NGO.user_id == user_id).first()
        if not ngo:
            user_row = db.query(User).filter(User.id == user_id).first()
            if not user_row:
                raise HTTPException(status_code=404, detail="User not found")
            if str(getattr(user_row.role, "value", user_row.role)) != "ngo":
                raise HTTPException(status_code=404, detail="NGO profile not found")

            ngo = NGO(
                user_id=user_id,
                name=user_row.name or "NGO",
                address="(not set)",
                latitude=0.0,
                longitude=0.0,
            )
            db.add(ngo)
            db.commit()
            db.refresh(ngo)

        user = db.query(User).filter(User.id == user_id).first()

        donations = db.query(Donation).filter(Donation.ngo_id == ngo.id).all()
        avg_review_rating = _safe_avg_review_rating(db, user_id)
        reliability_factor = float(ngo.reliability_score) if ngo.reliability_score is not None else 0.0
        trust_rating = round(avg_review_rating * reliability_factor, 1) if avg_review_rating is not None else None
        don_list = []
        for d in donations:
            don_list.append({
                "id": d.id,
                "food_quantity": d.food_quantity,
                "food_type": d.food_type,
                "status": d.status.value if hasattr(d.status, "value") else str(d.status),
                "restaurant_name": d.restaurant.name if d.restaurant else "Unknown",
                "created_at": d.created_at.isoformat() if d.created_at else None,
            })

        return {
            "ngo": {
                "id": ngo.id,
                "user_id": ngo.user_id,
                "name": ngo.name,
                "address": ngo.address,
                "latitude": ngo.latitude,
                "longitude": ngo.longitude,
                "capacity": ngo.capacity,
                "current_load": ngo.current_load,
                "urgency_score": ngo.urgency_score,
                "reliability_score": ngo.reliability_score,
                "avg_review_rating": round(avg_review_rating, 2) if avg_review_rating is not None else None,
                "trust_rating": trust_rating,
                "phone": ngo.phone,
                "certificate_number": ngo.certificate_number,
                "created_at": ngo.created_at.isoformat() if ngo.created_at else None,
            },
            "user": {
                "email": user.email if user else None,
                "phone": user.phone if user else None,
            },
            "donations": don_list,
        }
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"NGO profile load failed: {exc}")
    finally:
        db.close()


@router.patch("/ngo/{user_id}")
def update_ngo_profile(user_id: str, body: NGOUpdate):
    db = SessionLocal()
    try:
        ngo = db.query(NGO).filter(NGO.user_id == user_id).first()
        if not ngo:
            raise HTTPException(status_code=404, detail="NGO profile not found")

        if body.name is not None:
            ngo.name = body.name
        address_text = body.address.strip() if isinstance(body.address, str) else body.address
        if address_text is not None:
            ngo.address = address_text
        if body.certificate_number is not None:
            ngo.certificate_number = body.certificate_number
        if body.latitude is not None:
            ngo.latitude = body.latitude
        if body.longitude is not None:
            ngo.longitude = body.longitude

        if address_text and (body.latitude is None or body.longitude is None):
            geocoded = geocode_address_sync(address_text)
            geo_lat = geocoded.get("lat") if geocoded else None
            geo_lng = geocoded.get("lng") if geocoded else None
            if _is_valid_coord(geo_lat, geo_lng):
                ngo.latitude = geo_lat
                ngo.longitude = geo_lng
                formatted = geocoded.get("formatted_address")
                if formatted:
                    ngo.address = formatted

        if body.phone is not None:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user.phone = body.phone

        db.commit()
        return {
            "status": "updated",
            "ngo": {
                "id": ngo.id,
                "address": ngo.address,
                "latitude": ngo.latitude,
                "longitude": ngo.longitude,
            },
        }
    except HTTPException:
        db.rollback()
        raise
    finally:
        db.close()


# ── Credential format verification ───────────────────────
@router.post("/verify-gstin")
def verify_gstin(body: GSTINVerify):
    gstin = body.gstin.strip().upper()
    fmt_valid = bool(GSTIN_REGEX.match(gstin))
    return {
        "gstin": gstin,
        "format_valid": fmt_valid,
        "verified": fmt_valid,
        "message": "✅ GSTIN format valid" if fmt_valid else "❌ Invalid GSTIN format",
    }


@router.post("/verify-certificate")
def verify_certificate(body: CertVerify):
    cert = body.certificate_number.strip().upper()
    fmt_valid = bool(CERTIFICATE_REGEX.match(cert))
    return {
        "certificate_number": cert,
        "format_valid": fmt_valid,
        "verified": fmt_valid,
        "message": "✅ Certificate format valid" if fmt_valid else "❌ Invalid certificate format",
    }
