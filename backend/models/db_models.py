from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Optional
from uuid import uuid4

from sqlalchemy import Boolean, Date, DateTime, Enum as SqlEnum, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class UserRole(str, Enum):
    RESTAURANT = "restaurant"
    PROVIDER = "provider"
    NGO = "ngo"
    ADMIN = "admin"


class DonationStatus(str, Enum):
    PENDING = "pending"
    MATCHED = "matched"
    ACCEPTED = "accepted"
    PICKED_UP = "picked_up"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SqlEnum(UserRole, values_callable=lambda enum: [member.value for member in enum]),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    restaurant_profile: Mapped[Optional[Restaurant]] = relationship(back_populates="user", uselist=False)
    ngo_profile: Mapped[Optional[NGO]] = relationship(back_populates="user", uselist=False)


class Restaurant(Base):
    __tablename__ = "restaurants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), unique=True, nullable=True)
    name: Mapped[str] = mapped_column(String(140), nullable=False)
    address: Mapped[str] = mapped_column(String(300), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    cuisine_type: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    avg_daily_covers: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    reliability_score: Mapped[float] = mapped_column(Float, default=0.8, nullable=False)
    gstin: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user: Mapped[Optional[User]] = relationship(back_populates="restaurant_profile")
    donations: Mapped[list[Donation]] = relationship(back_populates="restaurant")
    predictions: Mapped[list[Prediction]] = relationship(back_populates="restaurant")


class NGO(Base):
    __tablename__ = "ngos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), unique=True, nullable=True)
    name: Mapped[str] = mapped_column(String(140), nullable=False)
    address: Mapped[str] = mapped_column(String(300), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    current_load: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    urgency_score: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    reliability_score: Mapped[float] = mapped_column(Float, default=0.8, nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    certificate_number: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user: Mapped[Optional[User]] = relationship(back_populates="ngo_profile")
    donations: Mapped[list[Donation]] = relationship(back_populates="ngo")


class Donation(Base):
    __tablename__ = "donations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id"), nullable=False)
    ngo_id: Mapped[Optional[int]] = mapped_column(ForeignKey("ngos.id"), nullable=True)
    food_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    food_type: Mapped[str] = mapped_column(String(120), default="mixed", nullable=False)
    pickup_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[DonationStatus] = mapped_column(
        SqlEnum(DonationStatus, values_callable=lambda enum: [member.value for member in enum]),
        default=DonationStatus.PENDING,
        nullable=False,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    restaurant: Mapped[Restaurant] = relationship(back_populates="donations")
    ngo: Mapped[Optional[NGO]] = relationship(back_populates="donations")
    pickup_log: Mapped[Optional[PickupLog]] = relationship(back_populates="donation", uselist=False)
    impact_metric: Mapped[Optional[ImpactMetric]] = relationship(back_populates="donation", uselist=False)


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id"), nullable=False)
    predicted_surplus: Mapped[float] = mapped_column(Float, nullable=False)
    prediction_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    day_of_week: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    event_flag: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    weather_score: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    actual_surplus: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    restaurant: Mapped[Restaurant] = relationship(back_populates="predictions")


class PickupLog(Base):
    __tablename__ = "pickup_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    donation_id: Mapped[int] = mapped_column(ForeignKey("donations.id"), unique=True, nullable=False)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    driver_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    donation: Mapped[Donation] = relationship(back_populates="pickup_log")


class ImpactMetric(Base):
    __tablename__ = "impact_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    donation_id: Mapped[int] = mapped_column(ForeignKey("donations.id"), unique=True, nullable=False)
    meals_rescued: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    food_waste_prevented_kg: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    co2_reduced_kg: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    donation: Mapped[Donation] = relationship(back_populates="impact_metric")


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reviewer_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    reviewee_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    donation_id: Mapped[Optional[int]] = mapped_column(ForeignKey("donations.id"), nullable=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
