import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import text

from app.api.deps import DbSession
from app.api.router import api_router
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.rate_limit import limiter, rate_limit_exceeded_handler

logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        description=(
            "REST API for managing team tasks and sprints.\n\n"
            "**Auth:** call `POST /api/v1/auth/login`, then click **Authorize** and paste the "
            "`access_token`. Demo accounts: `admin@demo.com` / `member@demo.com`, "
            "password `Password123!`.\n\n"
            "Every response uses the envelope "
            "`{success, data, meta, error}`."
        ),
    )

    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
    app.include_router(api_router, prefix=settings.api_prefix)

    @app.get("/", include_in_schema=False)
    def root() -> RedirectResponse:
        return RedirectResponse(url="/docs")

    @app.get("/health", tags=["health"], summary="Liveness probe")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health/ready", tags=["health"], summary="Readiness probe (checks the database)")
    def ready(db: DbSession) -> dict[str, str]:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}

    return app


app = create_app()
