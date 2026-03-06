"""
NLP Parser — extracts {quantity, time, food_type} from natural language input.
Primary: Ollama Llama3   Fallback: regex
"""
import re
import json
import httpx
from database import OLLAMA_BASE_URL, OLLAMA_MODEL

_SYSTEM_PROMPT = """You are a food donation assistant. Extract structured data from the user's message.
Return ONLY valid JSON with keys: quantity (integer), time (string HH:MM or null), food_type (string or null).
Examples:
  "We have 40 meals ready by 8 PM" → {"quantity": 40, "time": "20:00", "food_type": null}
  "Around 25 plates of biryani available at 7:30" → {"quantity": 25, "time": "19:30", "food_type": "biryani"}
  "Leftover pizzas, about 15" → {"quantity": 15, "time": null, "food_type": "pizza"}
"""


def _regex_fallback(text: str) -> dict:
    """Rule-based extraction when Ollama is unavailable."""
    quantity = None
    time_str = None
    food_type = None

    # quantity: number near keywords
    qty_match = re.search(r"(?:around|about|roughly|~)?\s*(\d+)\s*(?:meals?|plates?|portions?|servings?|items?|pizzas?|pieces?)?", text, re.I)
    if qty_match:
        quantity = int(qty_match.group(1))

    # time: 8 PM, 20:00, 7:30 PM
    time_match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)?", text, re.I)
    if time_match:
        hour = int(time_match.group(1))
        minute = int(time_match.group(2)) if time_match.group(2) else 0
        meridiem = time_match.group(3)
        if meridiem and meridiem.lower() == "pm" and hour < 12:
            hour += 12
        elif meridiem and meridiem.lower() == "am" and hour == 12:
            hour = 0
        time_str = f"{hour:02d}:{minute:02d}"

    # food_type: common foods
    food_keywords = ["rice", "biryani", "pizza", "roti", "dal", "curry", "sandwich",
                     "idli", "dosa", "bread", "pasta", "salad", "soup", "wrap"]
    for food in food_keywords:
        if food in text.lower():
            food_type = food
            break

    return {"quantity": quantity, "time": time_str, "food_type": food_type}


async def parse_donation_text(text: str) -> dict:
    """Parse free-text donation description using Ollama Llama3 with regex fallback."""
    prompt = f"{_SYSTEM_PROMPT}\n\nUser message: {text}\n\nJSON:"

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json",
                },
            )
            if response.status_code == 200:
                data = response.json()
                raw = data.get("response", "{}")
                parsed = json.loads(raw)
                return {
                    "quantity": parsed.get("quantity"),
                    "time": parsed.get("time"),
                    "food_type": parsed.get("food_type"),
                    "source": "llama3",
                }
    except Exception as e:
        print(f"[NLP] Ollama unavailable ({e}), falling back to regex.")

    result = _regex_fallback(text)
    result["source"] = "regex"
    return result
