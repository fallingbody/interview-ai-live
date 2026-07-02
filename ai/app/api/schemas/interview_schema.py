from marshmallow import Schema, fields, validates, ValidationError


class StartInterviewSchema(Schema):
    candidate_id = fields.UUID(required=True)
    resume_id = fields.UUID(required=True)
    campaign_id = fields.Str(required=True)
    role = fields.Str(required=True)

    @validates("role")
    def validate_role(self, value, **kwargs):
        if not value.strip():
            raise ValidationError("Role cannot be empty")


class HandleInterviewSchema(Schema):
    interview_id = fields.UUID(required=True)
    answer = fields.Str(required=True, allow_none=False)

    @validates("answer")
    def validate_answer(self, value, **kwargs):
        if value is None:
            raise ValidationError("Answer is required")

