"""The response envelope shared by every endpoint.

Success:  {"success": true,  "data": ..., "meta": {...} | null, "error": null}
Failure:  {"success": false, "data": null, "meta": null, "error": {"code", "message", "details"}}
"""

from math import ceil
from typing import Any

from pydantic import BaseModel, Field


class PageMeta(BaseModel):
    page: int = Field(examples=[1])
    page_size: int = Field(examples=[20])
    total: int = Field(examples=[57])
    total_pages: int = Field(examples=[3])

    @classmethod
    def build(cls, *, page: int, page_size: int, total: int) -> "PageMeta":
        return cls(page=page, page_size=page_size, total=total, total_pages=ceil(total / page_size))


class ErrorBody(BaseModel):
    code: str = Field(examples=["validation_error"])
    message: str = Field(examples=["Request validation failed"])
    details: Any = None


class ApiResponse[T](BaseModel):
    success: bool = True
    data: T
    meta: PageMeta | None = None
    error: ErrorBody | None = None


class ErrorResponse(BaseModel):
    success: bool = False
    data: None = None
    meta: None = None
    error: ErrorBody


def ok[T](data: T, meta: PageMeta | None = None) -> ApiResponse[T]:
    return ApiResponse[T](data=data, meta=meta)


# Documented on every router so the OpenAPI spec shows the error envelope.
ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    400: {"model": ErrorResponse, "description": "Bad request"},
    401: {"model": ErrorResponse, "description": "Missing, invalid or expired token"},
    403: {"model": ErrorResponse, "description": "Authenticated but not allowed"},
    404: {"model": ErrorResponse, "description": "Resource not found"},
    409: {"model": ErrorResponse, "description": "Conflicts with existing data"},
    422: {"model": ErrorResponse, "description": "Validation failed"},
}
