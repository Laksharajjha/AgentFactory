import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
from fastapi import WebSocket
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AgentEventModel
from app.schemas import EventTypeLiteral

logger = logging.getLogger("project_forge.events")


class EventBus:
    """Tenant-isolated persistent event log and real-time WebSocket broadcaster with sequence tracking."""

    def __init__(self) -> None:
        # Maps workforce_id -> set of (websocket, workspace_id)
        self._connections: Dict[str, Set[Tuple[WebSocket, str]]] = {}
        self._lock = asyncio.Lock()

    async def connect(
        self,
        workforce_id: str,
        websocket: WebSocket,
        workspace_id: str,
    ) -> None:
        await websocket.accept()
        async with self._lock:
            if workforce_id not in self._connections:
                self._connections[workforce_id] = set()
            self._connections[workforce_id].add((websocket, workspace_id))

    async def disconnect(self, workforce_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            if workforce_id in self._connections:
                self._connections[workforce_id] = {
                    (ws, wid) for (ws, wid) in self._connections[workforce_id] if ws is not websocket
                }

    async def emit(
        self,
        session: AsyncSession,
        workforce_id: str,
        event_type: EventTypeLiteral,
        entity_id: str,
        payload: Dict[str, Any],
        workspace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        seq_res = await session.execute(
            select(func.max(AgentEventModel.sequence)).where(
                AgentEventModel.workforce_id == workforce_id
            )
        )
        max_seq = seq_res.scalar_one_or_none() or 0
        next_seq = max_seq + 1
        now = datetime.now(timezone.utc)
        event_id = f"evt_{uuid.uuid4().hex[:12]}"

        event_row = AgentEventModel(
            id=event_id,
            sequence=next_seq,
            workforce_id=workforce_id,
            event_type=event_type,
            entity_id=entity_id,
            payload=payload,
            created_at=now,
        )
        session.add(event_row)
        await session.commit()

        event_dict = {
            "type": "WORLD_EVENT",
            "event_id": event_id,
            "sequence": next_seq,
            "workforce_id": workforce_id,
            "event_type": event_type,
            "entity_id": entity_id,
            "payload": payload,
            "timestamp": now.isoformat(),
        }

        await self.broadcast(workforce_id, event_dict, workspace_id=workspace_id)
        return event_dict

    async def broadcast(
        self,
        workforce_id: str,
        message: Dict[str, Any],
        workspace_id: Optional[str] = None,
    ) -> None:
        targets: List[WebSocket] = []
        async with self._lock:
            for ws, bound_ws_id in self._connections.get(workforce_id, set()):
                if workspace_id is None or bound_ws_id == workspace_id:
                    targets.append(ws)

        dead: List[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)

        if dead:
            async with self._lock:
                if workforce_id in self._connections:
                    self._connections[workforce_id] = {
                        (ws, wid) for (ws, wid) in self._connections[workforce_id] if ws not in dead
                    }


event_bus = EventBus()
