from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.matching import match_ngo, get_all_ngos

router = APIRouter(prefix="/ngos", tags=["NGOs"])


class MatchRequest(BaseModel):
    restaurant_id: int
    food_quantity: int


@router.get("")
def list_ngos():
    return get_all_ngos()


@router.get("/{ngo_id}")
def get_ngo(ngo_id: int):
    ngos = get_all_ngos()
    ngo = next((n for n in ngos if n["id"] == ngo_id), None)
    if not ngo:
        raise HTTPException(status_code=404, detail="NGO not found")
    return ngo


@router.post("/match")
def find_best_ngo(body: MatchRequest):
    try:
        result = match_ngo(body.restaurant_id, body.food_quantity)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
