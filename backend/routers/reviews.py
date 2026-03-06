"""
Reviews router — trust / review system between restaurants and NGOs
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from models import Review, SessionLocal, User

router = APIRouter(prefix="/reviews", tags=["Reviews"])


class ReviewCreate(BaseModel):
    reviewer_id: str
    reviewee_id: str
    donation_id: Optional[int] = None
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None


@router.post("", status_code=201)
def create_review(body: ReviewCreate):
    db = None
    try:
        db = SessionLocal()
        # Validate users exist
        reviewer = db.query(User).filter(User.id == body.reviewer_id).first()
        if not reviewer:
            raise HTTPException(status_code=400, detail="Reviewer not found")
        reviewee = db.query(User).filter(User.id == body.reviewee_id).first()
        if not reviewee:
            raise HTTPException(status_code=400, detail="Reviewee not found")

        review = Review(
            reviewer_id=body.reviewer_id,
            reviewee_id=body.reviewee_id,
            donation_id=body.donation_id,
            rating=body.rating,
            comment=body.comment,
        )
        db.add(review)
        db.commit()
        db.refresh(review)

        return {
            "id": review.id,
            "reviewer_id": review.reviewer_id,
            "reviewee_id": review.reviewee_id,
            "donation_id": review.donation_id,
            "rating": review.rating,
            "comment": review.comment,
            "created_at": review.created_at.isoformat() if review.created_at else None,
            "reviewer_name": reviewer.name,
        }
    except HTTPException:
        if db:
            db.rollback()
        raise
    except Exception as exc:
        if db:
            db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        if db:
            db.close()


@router.get("")
def list_reviews(user_id: Optional[str] = None):
    db = None
    try:
        db = SessionLocal()
        query = db.query(Review)
        if user_id:
            query = query.filter(Review.reviewee_id == user_id)
        rows = query.order_by(Review.created_at.desc()).all()

        result = []
        for r in rows:
            reviewer = db.query(User).filter(User.id == r.reviewer_id).first()
            result.append({
                "id": r.id,
                "reviewer_id": r.reviewer_id,
                "reviewer_name": reviewer.name if reviewer else "Unknown",
                "reviewee_id": r.reviewee_id,
                "donation_id": r.donation_id,
                "rating": r.rating,
                "comment": r.comment,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            })
        return result
    except Exception as exc:
        if db:
            db.rollback()
        print(f"[Reviews] list fallback for user_id={user_id}: {exc}")
        return []
    finally:
        if db:
            db.close()
