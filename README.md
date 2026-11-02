# GlobalResume AI

GlobalResume AI is a multilingual resume enhancement application that helps job seekers improve, translate, and analyze their resumes using AI. It supports resume upload in PDF, DOCX, or TXT format and allows users to paste text directly for quick analysis.

## Features

- Upload a resume as PDF, DOCX, or TXT
- Paste resume content directly into the app
- Detect or select source language manually
- Translate the resume into English or major Indian languages
- Improve grammar, clarity, and wording for professional use
- Generate a polished professional summary
- Analyze strengths, weaknesses, and improvement suggestions
- Compare the resume against a job description and calculate a match score
- Copy or download the enhanced resume

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Python + FastAPI
- AI: Google Gemini
- Deployment: Vercel-ready serverless function support

## Project Structure

- `index.html` — main UI
- `style.css` — styling for the app
- `script.js` — frontend logic and API communication
- `server.py` — local backend API server
- `api/analyze.js` — serverless function for Vercel deployment
- `vercel.json` — Vercel configuration

## Local Setup

1. Clone the repository.
2. Create a virtual environment (optional but recommended).
3. Install dependencies:

```bash
pip install fastapi uvicorn python-docx pypdf google-genai
```

4. Set your Gemini API key:

Windows PowerShell:

```powershell
$env:GEMINI_API_KEY="your_api_key_here"
```

Linux/macOS:

```bash
export GEMINI_API_KEY="your_api_key_here"
```

5. Start the app:

```bash
python server.py
```

6. Open the application in your browser:

```text
http://localhost:8000
```

## Vercel Deployment

This project includes a Vercel-ready serverless API route in `api/analyze.js`.

Add the following environment variable in your Vercel project settings:

```text
GEMINI_API_KEY=your_api_key_here
```

## Notes

- The app is designed for AI-assisted resume improvement and analysis.
- Resume content is processed only during the active request.
- Some document parsing may vary depending on the structure and formatting of the uploaded file.

## License

This project is currently unlicensed and is shared as-is for demo and personal use.
