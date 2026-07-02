


from sqlalchemy import Column, String

from app.persistence.database.base import Base, GUID, TimestampMixin


class UserModel(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(GUID(), primary_key=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
        }
