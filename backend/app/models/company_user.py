from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.common import TimestampMixin


class CompanyUser(Base, TimestampMixin):
    __tablename__ = "company_users"
    __table_args__ = (UniqueConstraint("company_id", "user_id", name="uq_company_user"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(50), default="read_only")  # Maps to Role.name
    role_id: Mapped[int | None] = mapped_column(ForeignKey("roles.id"), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_company_admin: Mapped[bool] = mapped_column(Boolean, default=False)  # Shortcut flag

    company = relationship("Company", back_populates="users")
    user = relationship("User", back_populates="company_links")
    role_obj = relationship("Role", back_populates="company_users")