from fastapi import APIRouter, UploadFile, File
from app.utils import resume_parser

router = APIRouter()

@router.post("/upload_resume")
async def upload_resume(file: UploadFile = File(...)):
    content = await file.read()
    parsed_text = resume_parser.parse_resume(content)
    # In a real app, you would save this to a database against a user session
    return {"resume_text": parsed_text}
