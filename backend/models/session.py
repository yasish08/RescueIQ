import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from .base import Base


def get_postgres_url() -> str:
    """Return the PostgreSQL connection URL from DATABASE_URL env var."""
    url = os.getenv("DATABASE_URL", "")
    if not url:
        raise RuntimeError(
            "DATABASE_URL environment variable is not set. "
            "Set it to your Supabase/PostgreSQL connection string."
        )
    # SQLAlchemy requires postgresql+psycopg2:// scheme
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


engine = create_engine(
    get_postgres_url(),
    pool_pre_ping=True,
    future=True,
    # Supabase pooler (port 5432) uses session mode — keep pool size modest
    pool_size=5,
    max_overflow=10,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def _ensure_schema_compatibility() -> None:
    statements = [
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN
                ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'provider';
            END IF;
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
                ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'provider';
            END IF;
        END$$;
        """,
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'users'
            ) THEN
                IF EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'users_role_check'
                      AND conrelid = 'public.users'::regclass
                ) THEN
                    ALTER TABLE public.users DROP CONSTRAINT users_role_check;
                END IF;
                ALTER TABLE public.users
                ADD CONSTRAINT users_role_check
                CHECK (role::text = ANY (ARRAY['restaurant', 'provider', 'ngo', 'admin']));
            END IF;
        END$$;
        """,
        "ALTER TABLE IF EXISTS restaurants ADD COLUMN IF NOT EXISTS gstin VARCHAR(20);",
        "ALTER TABLE IF EXISTS restaurants ADD COLUMN IF NOT EXISTS user_id VARCHAR(36);",
        "ALTER TABLE IF EXISTS ngos ADD COLUMN IF NOT EXISTS certificate_number VARCHAR(30);",
        "ALTER TABLE IF EXISTS ngos ADD COLUMN IF NOT EXISTS user_id VARCHAR(36);",
        "ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS phone VARCHAR(30);",
        "ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE IF EXISTS reviews ADD COLUMN IF NOT EXISTS reviewer_id VARCHAR(36);",
        "ALTER TABLE IF EXISTS reviews ADD COLUMN IF NOT EXISTS reviewee_id VARCHAR(36);",
        "ALTER TABLE IF EXISTS reviews ADD COLUMN IF NOT EXISTS donation_id INTEGER;",
        "ALTER TABLE IF EXISTS reviews ADD COLUMN IF NOT EXISTS rating INTEGER;",
        "ALTER TABLE IF EXISTS reviews ADD COLUMN IF NOT EXISTS comment TEXT;",
        "ALTER TABLE IF EXISTS reviews ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();",
    ]
    with engine.begin() as conn:
        for sql in statements:
            conn.execute(text(sql))


def sync_postgres_sequences() -> None:
    statements = [
        "SELECT setval(pg_get_serial_sequence('restaurants','id'), COALESCE((SELECT MAX(id) FROM restaurants), 0) + 1, false);",
        "SELECT setval(pg_get_serial_sequence('ngos','id'), COALESCE((SELECT MAX(id) FROM ngos), 0) + 1, false);",
        "SELECT setval(pg_get_serial_sequence('donations','id'), COALESCE((SELECT MAX(id) FROM donations), 0) + 1, false);",
        "SELECT setval(pg_get_serial_sequence('predictions','id'), COALESCE((SELECT MAX(id) FROM predictions), 0) + 1, false);",
        "SELECT setval(pg_get_serial_sequence('reviews','id'), COALESCE((SELECT MAX(id) FROM reviews), 0) + 1, false);",
        "SELECT setval(pg_get_serial_sequence('pickup_logs','id'), COALESCE((SELECT MAX(id) FROM pickup_logs), 0) + 1, false);",
        "SELECT setval(pg_get_serial_sequence('impact_metrics','id'), COALESCE((SELECT MAX(id) FROM impact_metrics), 0) + 1, false);",
    ]
    with engine.begin() as conn:
        for sql in statements:
            conn.execute(text(sql))


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _ensure_schema_compatibility()
    sync_postgres_sequences()
