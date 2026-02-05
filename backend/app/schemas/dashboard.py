from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class DashboardMetrics(BaseModel):
    active_companies: int
    avg_certificate_days: int
    companies_with_errors: int
    devices_online: int
    devices_total: int


class TrendPoint(BaseModel):
    label: str
    value: int


class Trends(BaseModel):
    invoices: list[TrendPoint]
    quotations: list[TrendPoint]


class DeviceHealth(BaseModel):
    online: int
    attention: int


class CompanyStatus(BaseModel):
    company_id: int
    company_name: str
    device_count: int
    devices_online: int
    open_day_status: str
    close_status: str
    last_fiscal_day_no: int
    last_sync: Optional[datetime]
    certificate_status: str
    certificate_days_remaining: Optional[int]


class DashboardSummary(BaseModel):
    metrics: DashboardMetrics
    trends: Trends
    device_health: DeviceHealth
    company_status: list[CompanyStatus]

    @classmethod
    def empty(cls) -> "DashboardSummary":
        return cls(
            metrics=DashboardMetrics(
                active_companies=0,
                avg_certificate_days=0,
                companies_with_errors=0,
                devices_online=0,
                devices_total=0,
            ),
            trends=Trends(invoices=[], quotations=[]),
            device_health=DeviceHealth(online=0, attention=0),
            company_status=[],
        )
