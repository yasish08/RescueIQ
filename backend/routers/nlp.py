from fastapi import APIRouter
from pydantic import BaseModel
from ml.nlp import parse_donation_text

router = APIRouter(prefix="/nlp", tags=["NLP"])


class ParseRequest(BaseModel):
    text: str


@router.post("/parse")
async def parse_text(body: ParseRequest):
    result = await parse_donation_text(body.text)
    return result
