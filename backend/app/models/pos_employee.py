"""POS Employee model for cashier/operator management with login PINs."""
from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.common import TimestampMixin


class POSEmployee(Base, TimestampMixin):
    """A POS employee (cashier/operator) with a login PIN for POS access."""
    __tablename__ = "pos_employees"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(255), default="")
    pin: Mapped[str] = mapped_column(String(10), default="")  # 4-6 digit PIN stored as string
    role: Mapped[str] = mapped_column(String(50), default="cashier")  # cashier, manager, admin
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    company = relationship("Company")
    user = relationship("User")
