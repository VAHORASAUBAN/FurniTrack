"""Shared column type aliases so every model uses the exact same precision.

Design doc §2.2: monetary columns are DECIMAL(15,2) and arrive as Python
Decimal (never float) because `asdecimal=True`. Quantities get 3 decimal
places for part-units; tax rates get 2 (0.00-999.99%).
"""
from sqlalchemy import Numeric
from sqlalchemy.dialects.mysql import BIGINT

Money = Numeric(15, 2, asdecimal=True)
Qty = Numeric(12, 3, asdecimal=True)
Rate = Numeric(5, 2, asdecimal=True)

# BIGINT UNSIGNED AUTO_INCREMENT, matching the design doc's DDL exactly —
# using MySQL's unsigned variant (not generic BigInteger) keeps Alembic
# autogenerate quiet against the actual column type in MySQL.
UBigInt = BIGINT(unsigned=True)
