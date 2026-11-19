"""Domain errors and the exception handlers that turn every failure into the standard envelope."""

import logging
from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Base class for expected errors. Subclasses set the HTTP status and a stable error code."""

    status_code: int = 400
    code: str = "bad_request"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        details: Any = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code or self.code
        self.details = details
        self.headers = headers


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"


class ConflictError(AppError):
    status_code = 409
    code = "conflict"


class AuthenticationError(AppError):
    status_code = 401
    code = "unauthorized"

    def __init__(self, message: str = "Not authenticated", **kwargs: Any) -> None:
        kwargs.setdefault("headers", {"WWW-Authenticate": "Bearer"})
        super().__init__(message, **kwargs)


class PermissionDeniedError(AppError):
    status_code = 403
    code = "forbidden"


class InvalidFieldError(AppError):
    """A well-formed value that fails a business rule (e.g. an assignee that doesn't exist).

    Uses the same code and `details` shape as request validation errors, so clients can
    attach the message to the offending form field.
    """

    status_code = 422
    code = "validation_error"

    def __init__(self, field: str, message: str) -> None:
        super().__init__(
            "Request validation failed",
            details=[
                {"field": field, "location": "body", "message": message, "type": "value_error"}
            ],
        )


def error_response(
    status_code: int,
    code: str,
    message: str,
    details: Any = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    body = {
        "success": False,
        "data": None,
        "meta": None,
        "error": {"code": code, "message": message, "details": details},
    }
    return JSONResponse(jsonable_encoder(body), status_code=status_code, headers=headers)


def _status_code_slug(status_code: int) -> str:
    try:
        return HTTPStatus(status_code).phrase.lower().replace(" ", "_").replace("-", "_")
    except ValueError:
        return "error"


async def handle_app_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, AppError)
    return error_response(exc.status_code, exc.code, exc.message, exc.details, exc.headers)


async def handle_http_exception(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    message = exc.detail if isinstance(exc.detail, str) else HTTPStatus(exc.status_code).phrase
    return error_response(
        exc.status_code, _status_code_slug(exc.status_code), message, headers=exc.headers
    )


async def handle_validation_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    details = [
        {
            # loc looks like ("body", "email") or ("query", "page"); report the field path and
            # where it came from separately so clients can attach messages to form fields.
            "field": ".".join(str(part) for part in error["loc"][1:]) or error["loc"][0],
            "location": error["loc"][0],
            "message": error["msg"],
            "type": error["type"],
        }
        for error in exc.errors()
    ]
    return error_response(422, "validation_error", "Request validation failed", details)


async def handle_integrity_error(_: Request, exc: Exception) -> JSONResponse:
    # Services check uniqueness up front; this is the safety net for races between requests.
    logger.warning("Integrity error: %s", exc)
    return error_response(409, "conflict", "The request conflicts with existing data")


async def handle_unexpected_error(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error", exc_info=exc)
    return error_response(500, "internal_error", "An unexpected error occurred")


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, handle_app_error)
    app.add_exception_handler(StarletteHTTPException, handle_http_exception)
    app.add_exception_handler(RequestValidationError, handle_validation_error)
    app.add_exception_handler(IntegrityError, handle_integrity_error)
    app.add_exception_handler(Exception, handle_unexpected_error)
