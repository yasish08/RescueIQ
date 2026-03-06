from fastapi import APIRouter
from datetime import datetime, timedelta
from collections import defaultdict
from models import Donation, DonationStatus, SessionLocal

router = APIRouter(prefix="/impact", tags=["Impact"])


def _calculate_live_impact():
    db = SessionLocal()
    try:
        delivered = (
            db.query(Donation)
            .filter(Donation.status.in_([DonationStatus.DELIVERED, DonationStatus.PICKED_UP]))
            .all()
        )
    finally:
        db.close()

    meals = sum(int(d.food_quantity or 0) for d in delivered)
    waste_kg = round(meals * 0.35, 1)
    co2_kg = round(waste_kg * 1.6, 1)
    ngos = {d.ngo_id for d in delivered if d.ngo_id}
    restaurants = {d.restaurant_id for d in delivered if d.restaurant_id}

    week_start = datetime.now() - timedelta(days=7)
    donations_this_week = sum(1 for d in delivered if d.created_at and d.created_at >= week_start)

    return {
        "meals_rescued": meals,
        "food_waste_prevented_kg": waste_kg,
        "co2_reduced_kg": co2_kg,
        "ngos_supported": len(ngos),
        "restaurants_participating": len(restaurants),
        "donations_this_week": donations_this_week,
        "trees_equivalent": round(co2_kg / 21, 1),
    }


@router.get("")
def get_impact():
    return _calculate_live_impact()


@router.get("/timeline")
def get_timeline():
    """Return weekly breakdown based on delivered/picked-up donations from DB."""
    db = SessionLocal()
    try:
        delivered = (
            db.query(Donation)
            .filter(Donation.status.in_([DonationStatus.DELIVERED, DonationStatus.PICKED_UP]))
            .all()
        )
    finally:
        db.close()

    weekly_meals = defaultdict(float)
    for donation in delivered:
        created_at = donation.created_at or datetime.now()
        week_anchor = (created_at - timedelta(days=created_at.weekday())).date()
        weekly_meals[week_anchor] += float(donation.food_quantity or 0)

    weeks = []
    now = datetime.now()
    for i in range(8):
        week_date = (now - timedelta(weeks=7 - i))
        week_anchor = (week_date - timedelta(days=week_date.weekday())).date()
        meals = round(float(weekly_meals.get(week_anchor, 0.0)), 1)
        weeks.append({
            "week": week_anchor.strftime("%b %d"),
            "meals_rescued": meals,
            "co2_reduced": round(meals * 0.35 * 1.6, 1),
            "waste_prevented": round(meals * 0.35, 1),
        })
    return weeks
