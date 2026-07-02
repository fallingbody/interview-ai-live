from marshmallow import Schema, fields


class InterviewReportSchema(Schema):
    interview_id = fields.UUID(required=True)
    candidate_id = fields.UUID(required=True)
    role = fields.Str(required=True)

    overall_score = fields.Float(required=True)
    strengths = fields.List(fields.Str(), required=True)
    weaknesses = fields.List(fields.Str(), required=True)
    recommendations = fields.List(fields.Str(), required=True)

    detailed_feedback = fields.Dict(required=True)
    created_at = fields.DateTime(required=True)
