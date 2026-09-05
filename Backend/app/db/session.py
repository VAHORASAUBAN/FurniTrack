"""SQLAlchemy engine + session factory.

Design doc §6.1: `get_db` (in core/deps.py) is the ONLY place that calls
`session.commit()` in the whole codebase. Everything here just builds the
engine and the sessionmaker; no transaction logic lives in this module.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,   # survives MySQL's default 8h idle connection timeout
    pool_recycle=3600,
    echo=False,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)
