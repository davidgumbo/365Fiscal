from sqlalchemy import Boolean, ForeignKey, Integer, String, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.common import TimestampMixin
from app.models.warehouse import Warehouse


# Many-to-many association table: which employees can use which till
pos_till_employees = Table(
    "pos_till_employees",
    Base.metadata,
    Column("till_id", Integer, ForeignKey("pos_tills.id", ondelete="CASCADE"), primary_key=True),
    Column("employee_id", Integer, ForeignKey("pos_employees.id", ondelete="CASCADE"), primary_key=True),
)


class POSTill(Base, TimestampMixin):
    """A POS till / register that employees can be assigned to."""
    __tablename__ = "pos_tills"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    warehouse_id: Mapped[int | None] = mapped_column(
        ForeignKey("warehouses.id"), nullable=True, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    company = relationship("Company")
    employees = relationship("POSEmployee", secondary=pos_till_employees, backref="tills", lazy="selectin")
    warehouse = relationship("Warehouse", lazy="joined")
