from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.models import EventRule, User, AuditLog
from backend.app.schemas.schemas import EventRuleCreate, EventRuleUpdate, EventRuleResponse
from backend.app.api.deps import require_operator

router = APIRouter(prefix="/rules", tags=["Rules"])

@router.get("", response_model=List[EventRuleResponse])
def list_rules(db: Session = Depends(get_db)):
    rules = db.query(EventRule).order_by(EventRule.created_at.asc()).all()
    return [EventRuleResponse.model_validate(r) for r in rules]

@router.post("", response_model=EventRuleResponse)
def create_rule(
    rule_in: EventRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator)
):
    existing = db.query(EventRule).filter(EventRule.rule_code == rule_in.rule_code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Rule with code '{rule_in.rule_code}' already exists")

    rule = EventRule(**rule_in.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)

    audit = AuditLog(
        user_id=current_user.id,
        action="CREATE_RULE",
        entity_type="RULE",
        entity_id=rule.id,
        details=f"Detection rule '{rule.name}' created with threshold {rule.threshold} {rule.unit}"
    )
    db.add(audit)
    db.commit()

    return EventRuleResponse.model_validate(rule)

@router.patch("/{rule_id}", response_model=EventRuleResponse)
def update_rule(
    rule_id: str,
    rule_in: EventRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator)
):
    rule = db.query(EventRule).filter(EventRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    for f, v in rule_in.model_dump(exclude_unset=True).items():
        setattr(rule, f, v)

    rule.version += 1
    db.commit()
    db.refresh(rule)

    audit = AuditLog(
        user_id=current_user.id,
        action="UPDATE_RULE",
        entity_type="RULE",
        entity_id=rule.id,
        details=f"Detection rule '{rule.name}' updated to version {rule.version}"
    )
    db.add(audit)
    db.commit()

    return EventRuleResponse.model_validate(rule)
