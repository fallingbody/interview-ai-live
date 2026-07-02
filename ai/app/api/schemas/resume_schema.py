
from marshmallow import Schema, fields, validates, ValidationError
from werkzeug.datastructures import FileStorage


class ResumeUploadSchema(Schema):
    file = fields.Raw(required=True)
    name = fields.Str(required=True)
    email = fields.Email(required=True)
    candidate_image = fields.Raw(required=False, allow_none=True)
    candidate_image_vector = fields.Str(required=False, allow_none=True)

    @validates("file")
    def validate_file(self, value, **kwargs):
        if not isinstance(value, FileStorage):
            raise ValidationError("Invalid resume file")

        if value.filename == "":
            raise ValidationError("Resume file must have a filename")

        allowed_extensions = {"pdf", "docx"}
        ext = value.filename.rsplit(".", 1)[-1].lower()

        if ext not in allowed_extensions:
            raise ValidationError(
                f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
            )




