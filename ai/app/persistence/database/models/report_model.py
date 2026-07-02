import uuid

from sqlalchemy import Column, JSON, String

from app.persistence.database.base import Base, GUID, TimestampMixin

class ReportModel(Base, TimestampMixin):
    __tablename__ = "interview_reports"

    id = Column(GUID(), primary_key=True, default=lambda: str(uuid.uuid4()))
    interview_id = Column(GUID(), nullable=False, index=True)
    candidate_id = Column(GUID(), nullable=False)
    campaign_id = Column(String(255), nullable=False, index=True)
    role = Column(String(255), nullable=False)
    report_data = Column(JSON, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,  # include id if you want
            "interview_id": self.interview_id,
            "candidate_id": self.candidate_id,
            "campaign_id": self.campaign_id,
            "role": self.role,
            "report": self.report_data,
            "created_at": self.created_at,
        }

