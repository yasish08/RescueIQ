import os
from datetime import date

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from ml.predictor import predict_surplus, retrain_model
from models import Prediction, Restaurant, SessionLocal


_scheduler: BackgroundScheduler | None = None


def _daily_predict_job() -> None:
    db = SessionLocal()
    try:
        today = date.today()
        day_of_week = today.weekday()
        event_flag = int(os.getenv("DAILY_PREDICT_EVENT_FLAG", "0"))
        weather_score = float(os.getenv("DAILY_PREDICT_WEATHER_SCORE", "0.5"))

        restaurants = db.query(Restaurant).all()
        updated = 0
        for restaurant in restaurants:
            result = predict_surplus(
                restaurant_id=restaurant.id,
                day_of_week=day_of_week,
                event_flag=event_flag,
                weather_score=weather_score,
            )

            existing = (
                db.query(Prediction)
                .filter(Prediction.restaurant_id == restaurant.id, Prediction.prediction_date == today)
                .order_by(Prediction.created_at.desc())
                .first()
            )
            if existing:
                existing.predicted_surplus = result["predicted_surplus"]
                existing.day_of_week = day_of_week
                existing.event_flag = event_flag
                existing.weather_score = weather_score
            else:
                db.add(
                    Prediction(
                        restaurant_id=restaurant.id,
                        predicted_surplus=result["predicted_surplus"],
                        prediction_date=today,
                        day_of_week=day_of_week,
                        event_flag=event_flag,
                        weather_score=weather_score,
                        actual_surplus=None,
                    )
                )
            updated += 1

        db.commit()
        print(f"[Scheduler] Daily predictions refreshed for {updated} restaurants")
    except Exception as exc:
        db.rollback()
        print(f"[Scheduler] Daily prediction job failed: {exc}")
    finally:
        db.close()


def _weekly_retrain_job() -> None:
    try:
        retrain_model()
        print("[Scheduler] Weekly model retrain completed")
    except Exception as exc:
        print(f"[Scheduler] Weekly retrain job failed: {exc}")


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return

    if os.getenv("ENABLE_BACKGROUND_SCHEDULER", "true").lower() != "true":
        print("[Scheduler] Background scheduler disabled via env")
        return

    timezone = os.getenv("SCHEDULER_TIMEZONE", "Asia/Kolkata")
    daily_hour = int(os.getenv("DAILY_PREDICT_HOUR", "8"))
    daily_minute = int(os.getenv("DAILY_PREDICT_MINUTE", "0"))
    weekly_day = os.getenv("WEEKLY_RETRAIN_DAY", "sun").lower()
    weekly_hour = int(os.getenv("WEEKLY_RETRAIN_HOUR", "2"))
    weekly_minute = int(os.getenv("WEEKLY_RETRAIN_MINUTE", "0"))

    _scheduler = BackgroundScheduler(timezone=timezone)
    _scheduler.add_job(
        _daily_predict_job,
        CronTrigger(hour=daily_hour, minute=daily_minute, timezone=timezone),
        id="daily_predict_job",
        replace_existing=True,
    )
    _scheduler.add_job(
        _weekly_retrain_job,
        CronTrigger(day_of_week=weekly_day, hour=weekly_hour, minute=weekly_minute, timezone=timezone),
        id="weekly_retrain_job",
        replace_existing=True,
    )
    _scheduler.start()
    print(
        "[Scheduler] Started "
        f"(daily predict at {daily_hour:02d}:{daily_minute:02d}, "
        f"weekly retrain {weekly_day} {weekly_hour:02d}:{weekly_minute:02d}, timezone={timezone})"
    )


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is None:
        return

    _scheduler.shutdown(wait=False)
    _scheduler = None
    print("[Scheduler] Stopped")
