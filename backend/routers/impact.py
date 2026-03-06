from fastapi import APIRouter
from seed.mock_data import DONATIONS, IMPACT

router = APIRouter(prefix="/impact", tags=["Impact"])


def _calculate_live_impact():
    delivered = [d for d in DONATIONS if d["status"] in ("delivered", "picked_up")]
    meals = sum(d["food_quantity"] for d in delivered)
    # Rough conversions: 1 meal ≈ 0.35 kg food, 0.35 kg food ≈ 0.57 kg CO2
    waste_kg = round(meals * 0.35, 1)
    co2_kg = round(waste_kg * 1.6, 1)
    ngos = list({d["ngo_id"] for d in delivered if d.get("ngo_id")})
    restaurants = list({d["restaurant_id"] for d in delivered})
    return {
        "meals_rescued": meals + IMPACT["meals_rescued"],
        "food_waste_prevented_kg": waste_kg + IMPACT["food_waste_prevented_kg"],
        "co2_reduced_kg": co2_kg + IMPACT["co2_reduced_kg"],
        "ngos_supported": len(ngos) + IMPACT["ngos_supported"],
        "restaurants_participating": len(restaurants) + IMPACT["restaurants_participating"],
        "donations_this_week": len(delivered) + IMPACT["donations_this_week"],
        "trees_equivalent": round((co2_kg + IMPACT["co2_reduced_kg"]) / 21, 1),
    }


@router.get("")
def get_impact():
    return _calculate_live_impact()


@router.get("/timeline")
def get_timeline():
    """Return mock weekly breakdown for chart rendering."""
    from datetime import datetime, timedelta
    weeks = []
    base_meals = 20
    for i in range(8):
        week_start = (datetime.now() - timedelta(weeks=7 - i)).strftime("%b %d")
        meals = base_meals + i * 15 + (i % 3) * 5
        weeks.append({
            "week": week_start,
            "meals_rescued": meals,
            "co2_reduced": round(meals * 0.35 * 1.6, 1),
            "waste_prevented": round(meals * 0.35, 1),
        })
    return weeks
