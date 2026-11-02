from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.app.core.database import get_db

router = APIRouter(tags=["Health"])

@router.get("/health/live")
def liveness():
    return {"status": "alive", "timestamp": "ok"}

@router.get("/health/ready")
def readiness(db: Session = Depends(get_db)):
    try:
        # Check database connectivity
        db.execute(text("SELECT 1"))
        return {
            "status": "ready",
            "database": "connected",
            "dependencies": {
                "database": "healthy",
                "ingestor": "healthy"
            }
        }
    except Exception as e:
        return Response(
            content='{"status": "degraded", "database": "unavailable"}',
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            media_type="application/json"
        )
