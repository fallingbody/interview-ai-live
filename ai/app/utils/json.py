import json
from datetime import datetime
from uuid import UUID
from typing import Any
from sqlalchemy.orm import class_mapper
import json


class EnhancedJSONEncoder(json.JSONEncoder):
    def default(self, obj: Any):
        if isinstance(obj, UUID):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


def safe_json_dumps(data: Any) -> str:
    return json.dumps(data, cls=EnhancedJSONEncoder)


def safe_json_loads(data: str) -> Any:
    return json.loads(data)



def to_dict(model):
    return {c.key: getattr(model, c.key) for c in class_mapper(model.__class__).columns}

