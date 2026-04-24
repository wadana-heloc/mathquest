"""
MathQuest - User model (SQLAlchemy stub)
========================================

Status: NOT IN ACTIVE USE.

The database is currently managed entirely through Supabase with raw SQL
migrations under ``supabase/migrations/``. This module exists as a
forward-looking, executable specification of ``public.users`` for the day
the Python backend is introduced.

When the Python backend is stood up, this module should:

* Bind to the same Postgres database (via ``DATABASE_URL``) that Supabase
  already manages. Do NOT create a second database.
* Treat Supabase migrations as the source of truth for schema. If Alembic
  is introduced here, start from an empty baseline that matches the
  Supabase-managed schema; avoid ``--autogenerate`` as a one-way door.
* Never write to ``auth.users`` directly. Use the Supabase Admin API
  (service_role key) for user provisioning from the server. The
  ``on_auth_user_created`` trigger will populate ``public.users``.
* Remember that RLS is enforced at the database level. If you connect
  with the service_role credentials you bypass RLS; connect as the
  ``authenticated`` role (or use Supabase's REST layer) when acting on
  behalf of an end user.

See: ``supabase/migrations/0001_create_users.sql`` and
``supabase/README.md`` for the authoritative schema and policies.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import CheckConstraint, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Placeholder declarative base.

    When the real backend lands, replace this with the project-wide Base
    (likely defined in ``backend/db.py``) so all models share one
    registry.
    """


class UserRole(str, enum.Enum):
    """Mirrors the CHECK constraint on ``public.users.role``.

    Stored in Postgres as plain TEXT (not a PG ENUM) to match the ERD and
    keep the CHECK constraint simple to evolve.
    """

    PARENT = "parent"
    CHILD = "child"


class User(Base):
    """1:1 with ``auth.users``. See ``public.users`` in Supabase.

    Invariants (enforced by DB constraints, do not rely on Python):

    * ``role='child'``  -> ``parent_id`` IS NOT NULL.
    * ``role='parent'`` -> ``parent_id`` IS NULL.
    * ``id`` matches an existing ``auth.users.id``; deleting the auth
      row cascades to this row.
    """

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role in ('parent', 'child')",
            name="users_role_check",
        ),
        CheckConstraint(
            "(role = 'child'  and parent_id is not null) "
            "or (role = 'parent' and parent_id is null)",
            name="users_parent_consistency",
        ),
        CheckConstraint(
            "char_length(display_name) between 1 and 80",
            name="users_display_name_length",
        ),
        Index("users_role_idx", "role"),
        Index("users_parent_id_idx", "parent_id"),
        Index("users_created_at_idx", "created_at"),
        Index("users_last_active_at_idx", "last_active_at"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        doc="Matches auth.users.id. Populated by the handle_new_user trigger.",
    )
    email: Mapped[str] = mapped_column(
        String,
        nullable=False,
        unique=True,
        doc="Synced from auth.users.email at signup.",
    )
    role: Mapped[str] = mapped_column(
        String,
        nullable=False,
        doc="'parent' or 'child'. See UserRole.",
    )
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.users.id", ondelete="SET NULL"),
        nullable=True,
        doc="Self-reference: the parent user that owns this child account.",
    )
    display_name: Mapped[str] = mapped_column(
        String,
        nullable=False,
        doc="Human-readable name shown in the UI. Captured from the signup form for parents; from the admin create-child call for children.",
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
    )
    last_active_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
    )

    parent: Mapped[Optional["User"]] = relationship(
        "User",
        remote_side="User.id",
        back_populates="children",
        foreign_keys=[parent_id],
    )
    children: Mapped[List["User"]] = relationship(
        "User",
        back_populates="parent",
        foreign_keys=[parent_id],
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} role={self.role} email={self.email!r}>"
