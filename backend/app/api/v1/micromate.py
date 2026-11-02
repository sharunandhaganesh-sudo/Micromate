from typing import Optional, List
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.services.micromate_service import micromate_service

router = APIRouter(prefix="/micromate", tags=["MicroMate Assistant"])

class MicroMateChatRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=1000)
    language: str = Field("en", pattern="^(en|ta|hi)$")
    station_id: Optional[str] = None

@router.get("/status")
def get_micromate_status(
    station_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Returns MicroMate's current emotional state, active alerts, and speech cue
    based on real-time station conditions.
    """
    context = micromate_service.get_current_context(db, station_id)
    return {
        "name": "MicroMate",
        "nickname": "Micro",
        "role": "Weather Monitoring Assistant",
        "theme": "Smart • Friendly • Helpful",
        "emotion": context["micromate"]["emotion"],
        "state": context["micromate"]["state"],
        "speech_cue": context["micromate"]["speech_cue"],
        "context": context
    }

@router.post("/chat")
def chat_with_micromate(
    req: MicroMateChatRequest,
    db: Session = Depends(get_db)
):
    """
    Conversational query interface for MicroMate.
    Returns smart context-aware responses in English, Tamil, or Hindi.
    """
    response = micromate_service.process_query(
        db=db,
        prompt=req.prompt,
        language=req.language,
        station_id=req.station_id
    )
    return response
