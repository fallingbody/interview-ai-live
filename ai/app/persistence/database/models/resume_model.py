from sqlalchemy import Column, String, ForeignKey
from app.persistence.database.base import Base, GUID, TimestampMixin
from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from app.persistence.database.base import Base

class Resume(Base):
    __tablename__ = "resumes"

    id = Column(GUID(), primary_key=True, index=True)
    candidate_id = Column(GUID(), ForeignKey("users.id"), nullable=False)

    filename = Column(String, nullable=False)
    extracted_text = Column(Text, nullable=False)
    face_image_path = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )