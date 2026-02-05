from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.common import TimestampMixin


class Company(Base, TimestampMixin):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    address: Mapped[str] = mapped_column(String(500), default="")
    email: Mapped[str] = mapped_column(String(255), default="")
    phone: Mapped[str] = mapped_column(String(50), default="")
    tin: Mapped[str] = mapped_column(String(50), default="")
    vat: Mapped[str] = mapped_column(String(50), default="")

    users = relationship("CompanyUser", back_populates="company")
    devices = relationship("Device", back_populates="company")
    products = relationship("Product", back_populates="company")
    warehouses = relationship("Warehouse", back_populates="company")
    contacts = relationship("Contact", back_populates="company")
    quotations = relationship("Quotation", back_populates="company")
    invoices = relationship("Invoice", back_populates="company")
    tax_settings = relationship("TaxSetting", back_populates="company")
    certificates = relationship("CompanyCertificate", back_populates="company")
    stock_moves = relationship("StockMove", back_populates="company")
    settings = relationship("CompanySettings", back_populates="company", uselist=False)
