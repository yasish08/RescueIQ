from fastapi import APIRouter
from pydantic import BaseModel
from datetime import date
from ml.predictor import predict_surplus, predict_all_restaurants

router = APIRouter(prefix="/predict", tags=["Prediction"])


class PredictRequest(BaseModel):
    restaurant_id: int
    day_of_week: int | None = None  # 0=Mon … 6=Sun; defaults to today
    event_flag: int = 0             # 1 if special event nearby
    weather_score: float = 0.5      # 0 = bad, 1 = perfect weather


@router.post("")
def run_prediction(req: PredictRequest):
    dow = req.day_of_week if req.day_of_week is not None else date.today().weekday()
    return predict_surplus(req.restaurant_id, dow, req.event_flag, req.weather_score)


@router.get("/all")
def predict_all(day_of_week: int | None = None, event_flag: int = 0, weather_score: float = 0.5):
    dow = day_of_week if day_of_week is not None else date.today().weekday()
    return predict_all_restaurants(dow, event_flag, weather_score)
