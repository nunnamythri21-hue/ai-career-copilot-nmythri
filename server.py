
import os
import json
from io import BytesIO

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from google import genai
from pypdf import PdfReader
from docx import Document


app = FastAPI(title="GlobalResume AI")

MODEL = "gemini-3.8-flash"
API_KEY = os.getenv("GEMINI_API_KEY")


def extract_resume(filename, content):
    extension = os.path.splitext(filename)[1].lower()

    try:
        if extension == ".txt":
            return content.decode("utf-8-sig", errors="replace")

        if extension == ".pdf":
            reader = PdfReader(BytesIO(content))

            if reader.is_encrypted:
                raise ValueError("Password-protected PDFs are not supported.")

            return "\n".join(
                page.extract_text() or ""
                for page in reader.pages
            )

        if extension == ".docx":
            doc = Document(BytesIO(content))

            paragraphs = [
                p.text for p in doc.paragraphs if p.text.strip()
            ]

            # Include text from tables too.
            for table in doc.tables:
                for row in table.rows:
                    paragraphs.append(
                        " | ".join(cell.text for cell in row.cells)
                    )

            return "\n".join(paragraphs)

        raise ValueError("Only PDF, DOCX and TXT files are supported.")

    except ValueError:
        raise

    except Exception:
        raise ValueError(
            "Could not read the file. Please upload a valid PDF, DOCX or TXT."
        )


def clean_json_response(text):
    text = text.strip()

    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        if text.endswith("```"):
            text = text[:-3]

    return text.strip()


@app.post("/api/analyze")
async def analyze_resume(
    resume_file: UploadFile = File(None),
    resume_text: str = Form(""),
    source_language: str = Form("Auto Detect"),
    output_language: str = Form("English"),
    feedback_language: str = Form("English"),
    job_description: str = Form(""),
    action: str = Form("complete")
):
    if not API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Gemini API key is missing. Set GEMINI_API_KEY in PowerShell."
        )

    if resume_file and resume_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Upload a file or paste resume text, not both."
        )

    if resume_file:
        if not resume_file.filename:
            raise HTTPException(
                status_code=400,
                detail="Please choose a resume file."
            )

        content = await resume_file.read()

        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(
                status_code=400,
                detail="File must be smaller than 5 MB."
            )

        try:
            resume = extract_resume(
                resume_file.filename,
                content
            )
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error))

    else:
        resume = resume_text.strip()

    if len(resume.strip()) < 30:
        raise HTTPException(
            status_code=400,
            detail="Not enough resume text. Please provide more content."
        )

    if len(resume) > 50000:
        raise HTTPException(
            status_code=400,
            detail="Resume text is too long. Please keep it below 50,000 characters."
        )

    if len(job_description) > 15000:
        raise HTTPException(
            status_code=400,
            detail="Job description is too long."
        )

    if action not in [
        "complete", "translate", "grammar", "analyze", "summary"
    ]:
        raise HTTPException(
            status_code=400,
            detail="Invalid AI action."
        )

    action_instructions = {
        "complete": "Translate, improve grammar, professionally rewrite and analyze the resume.",
        "translate": "Translate the complete resume into the requested output language while preserving its meaning.",
        "grammar": "Correct grammar, spelling, sentence structure and clarity while preserving the original language.",
        "analyze": "Analyze the resume, identify strengths, weaknesses and practical improvements.",
        "summary": "Create a professional resume summary based only on the supplied information."
    }

    prompt = f"""
You are GlobalResume AI, an expert multilingual resume writer
and career assistant.

TASK:
{action_instructions[action]}

SOURCE LANGUAGE:
{source_language}

OUTPUT LANGUAGE:
{output_language}

FEEDBACK LANGUAGE:
{feedback_language}

JOB DESCRIPTION:
{job_description if job_description.strip() else "No job description supplied. Do not calculate a job match score."}

RESUME:
{resume}

INSTRUCTIONS:
1. Detect the actual language of the resume.
2. Preserve the candidate's real qualifications and meaning.
3. Never invent degrees, skills, work experience, dates, awards or achievements.
4. Translate naturally and professionally.
5. Correct grammar and improve clarity.
6. Make the improved resume suitable for professional job applications.
7. Give feedback in the requested feedback language.
8. If no job description is supplied, set match_score to null.
9. If a job description is supplied, provide an estimated match score from 0 to 100.
10. Keep the translated resume in the requested output language.
11. Keep the improved resume in the requested output language.
12. If the original resume is already in the output language, still improve its wording.
13. Do not include private contact information in your feedback unless it is necessary.

RETURN ONLY VALID JSON with this exact structure:

{{
  "detected_language": "Detected language name",
  "professional_summary": "Professional summary in the requested output language",
  "improved_resume": "Complete improved resume in the requested output language",
  "translated_resume": "Translated resume in the requested output language",
  "strengths": [
    "Strength in the feedback language"
  ],
  "grammar_corrections": [
    "Explanation of a grammar or clarity improvement in the feedback language"
  ],
  "suggestions": [
    "Practical improvement suggestion in the feedback language"
  ],
  "match_score": 75
}}

Use null for match_score when no job description is supplied.
Return arrays even if they are empty.
"""

    try:
        client = genai.Client(api_key=API_KEY)

        response = client.models.generate_content(
            model=MODEL,
            contents=prompt,
            config={
                "response_mime_type": "application/json"
            }
        )

        result = json.loads(clean_json_response(response.text or ""))

        score = result.get("match_score")

        if score is not None:
            score = max(0, min(100, int(score)))

        return {
            "detected_language": str(
                result.get("detected_language", "Unknown")
            ),
            "professional_summary": str(
                result.get("professional_summary", "")
            ),
            "improved_resume": str(
                result.get("improved_resume", "")
            ),
            "translated_resume": str(
                result.get("translated_resume", "")
            ),
            "strengths": result.get("strengths", []),
            "grammar_corrections": result.get(
                "grammar_corrections", []
            ),
            "suggestions": result.get("suggestions", []),
            "match_score": score
        }

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail="Gemini returned an invalid response. Please try again."
        )

    except Exception as error:
        print("Gemini error:", str(error))
        raise HTTPException(
            status_code=502,
            detail="Gemini request failed. Check your API key, model access and internet connection."
        )


@app.get("/")
def home():
    return FileResponse("index.html")


app.mount("/", StaticFiles(directory=".", html=True), name="static")
