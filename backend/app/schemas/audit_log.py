"""Audit log schemas for API."""
from datetime import datetime
from pydantic import BaseModel
from typing import Optional, List, Any


class AuditLogRead(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_email: str = ""
    company_id: Optional[int] = None
    company_name: str = ""
    action: str
    resource_type: str
    resource_id: Optional[int] = None
    resource_reference: str = ""
    old_values: str = "{}"
    new_values: str = "{}"
    changes_summary: str = ""
    ip_address: str = ""
    user_agent: str = ""
    request_id: str = ""
    status: str = "success"
    error_message: str = ""
    action_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogFilter(BaseModel):
    company_id: Optional[int] = None
    user_id: Optional[int] = None
    action: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[int] = None
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    search: Optional[str] = None
    limit: int = 50
    offset: int = 0


class AuditLogSummary(BaseModel):
    total_actions: int
    actions_by_type: dict
    actions_by_user: dict
    recent_errors: List[AuditLogRead]
