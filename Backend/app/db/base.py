"""Declarative base shared by every ORM model.

A naming convention is attached so Alembic autogenerate produces stable,
predictable constraint names instead of MySQL's auto-generated ones (which
differ across environments and make migration diffs unreadable). Models that
need a specific name per the design doc (e.g. `ck_je_balanced`) pass it
explicitly on the constraint; everything else falls back to this convention.
"""
from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    # Identity pass-through: unlike uq/fk/pk, SQLAlchemy re-wraps an
    # already-given CheckConstraint name through this template instead of
    # using it verbatim (e.g. "ck_budget_dates" -> "ck_budget_ck_budget_dates").
    # Every CheckConstraint in this codebase is explicitly named to match the
    # design doc's DDL, so this key only needs to pass that name through.
    "ck": "%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
