"""
XGBoost Surplus Prediction Model
Trains on historical restaurant data and predicts food surplus in meals.
"""
import numpy as np
import pandas as pd
from xgboost import XGBRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error

from models import Donation, Prediction, Restaurant, SessionLocal

_model = None
_feature_cols = ["restaurant_id", "day_of_week", "event_flag", "weather_score", "avg_daily_covers"]


def _get_restaurants_runtime() -> list[dict]:
    db = SessionLocal()
    try:
        rows = db.query(Restaurant).all()
        return [
            {
                "id": row.id,
                "name": row.name,
                "avg_daily_covers": int(row.avg_daily_covers),
            }
            for row in rows
        ]
    except Exception:
        return []
    finally:
        db.close()


def _bootstrap_from_restaurants() -> pd.DataFrame:
    restaurants = _get_restaurants_runtime()
    if not restaurants:
        return pd.DataFrame()

    records = []
    for restaurant in restaurants:
        covers = int(restaurant.get("avg_daily_covers", 70) or 70)
        baseline_surplus = max(1.0, round(covers * 0.12, 1))
        for day in range(7):
            records.append(
                {
                    "restaurant_id": restaurant["id"],
                    "day_of_week": day,
                    "event_flag": 0,
                    "weather_score": 0.5,
                    "avg_daily_covers": covers,
                    "actual_surplus": baseline_surplus,
                }
            )
    return pd.DataFrame(records)


def _build_training_dataframe() -> pd.DataFrame:
    db = SessionLocal()
    try:
        rows = (
            db.query(Prediction, Restaurant.avg_daily_covers)
            .join(Restaurant, Prediction.restaurant_id == Restaurant.id)
            .filter(Prediction.actual_surplus.isnot(None))
            .all()
        )
        if rows:
            cloud_records = []
            for prediction, avg_daily_covers in rows:
                cloud_records.append(
                    {
                        "restaurant_id": prediction.restaurant_id,
                        "day_of_week": prediction.day_of_week if prediction.day_of_week is not None else prediction.prediction_date.weekday(),
                        "event_flag": prediction.event_flag,
                        "weather_score": prediction.weather_score,
                        "avg_daily_covers": avg_daily_covers,
                        "actual_surplus": prediction.actual_surplus,
                    }
                )
            return pd.DataFrame(cloud_records)

        donation_rows = (
            db.query(Donation, Restaurant.avg_daily_covers)
            .join(Restaurant, Donation.restaurant_id == Restaurant.id)
            .all()
        )
        if donation_rows:
            donation_records = []
            for donation, avg_daily_covers in donation_rows:
                reference_time = donation.pickup_time or donation.created_at
                day_of_week = reference_time.weekday() if reference_time else 0
                donation_records.append(
                    {
                        "restaurant_id": donation.restaurant_id,
                        "day_of_week": day_of_week,
                        "event_flag": 0,
                        "weather_score": 0.5,
                        "avg_daily_covers": avg_daily_covers,
                        "actual_surplus": float(donation.food_quantity or 0),
                    }
                )
            return pd.DataFrame(donation_records)
    except Exception as exc:
        print(f"[ML] Training data load fallback activated: {exc}")
    finally:
        db.close()

    return _bootstrap_from_restaurants()


def _train_model():
    global _model
    df = _build_training_dataframe()
    if df.empty:
        raise RuntimeError("No training data available. Add restaurants/donations first.")

    if len(df) < 5:
        restaurants_df = _bootstrap_from_restaurants()
        if not restaurants_df.empty:
            df = pd.concat([df, restaurants_df], ignore_index=True)

    X = df[_feature_cols]
    y = df["actual_surplus"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    _model = XGBRegressor(
        n_estimators=150,
        max_depth=4,
        learning_rate=0.1,
        subsample=0.8,
        random_state=42,
        verbosity=0,
    )
    _model.fit(X_train, y_train)

    preds = _model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    print(f"[ML] XGBoost trained ✓  MAE = {mae:.2f} meals")
    return _model


def get_model() -> XGBRegressor:
    global _model
    if _model is None:
        _model = _train_model()
    return _model


def retrain_model() -> XGBRegressor:
    global _model
    _model = None
    return get_model()


def _get_avg_daily_covers(restaurant_id: int) -> int:
    restaurants = _get_restaurants_runtime()
    match = next((restaurant for restaurant in restaurants if restaurant["id"] == restaurant_id), None)
    if match:
        return int(match["avg_daily_covers"])

    db = SessionLocal()
    try:
        restaurant = db.get(Restaurant, restaurant_id)
        if restaurant:
            return int(restaurant.avg_daily_covers)
    except Exception:
        pass
    finally:
        db.close()

    return 70


def _get_restaurant_name(restaurant_id: int) -> str:
    restaurants = _get_restaurants_runtime()
    match = next((restaurant for restaurant in restaurants if restaurant["id"] == restaurant_id), None)
    if match:
        return match.get("name", f"Restaurant #{restaurant_id}")
    return f"Restaurant #{restaurant_id}"


def predict_surplus(restaurant_id: int, day_of_week: int, event_flag: int = 0, weather_score: float = 0.5) -> dict:
    """
    Predict surplus meals for a given restaurant and context.
    Returns predicted surplus, confidence band, and whether it crosses threshold.
    """
    model = get_model()

    avg_covers = _get_avg_daily_covers(restaurant_id)

    features = pd.DataFrame([{
        "restaurant_id": restaurant_id,
        "day_of_week": day_of_week,
        "event_flag": event_flag,
        "weather_score": weather_score,
        "avg_daily_covers": avg_covers,
    }])

    raw_pred = float(model.predict(features)[0])
    predicted = round(max(0.0, raw_pred), 1)

    # simple confidence band (±20%)
    low = round(max(0.0, predicted * 0.8), 1)
    high = round(predicted * 1.2, 1)

    return {
        "restaurant_id": restaurant_id,
        "restaurant_name": _get_restaurant_name(restaurant_id),
        "predicted_surplus": predicted,
        "confidence_low": low,
        "confidence_high": high,
        "exceeds_threshold": predicted >= 10.0,
        "recommendation": (
            f"Expected surplus tonight: {predicted} meals. Consider donating!"
            if predicted >= 10.0
            else f"Low surplus expected ({predicted} meals). No action needed."
        ),
    }


def predict_all_restaurants(day_of_week: int, event_flag: int = 0, weather_score: float = 0.5) -> list:
    """Run predictions for all restaurants."""
    restaurants = _get_restaurants_runtime()
    return [
        predict_surplus(r["id"], day_of_week, event_flag, weather_score)
        for r in restaurants
    ]
