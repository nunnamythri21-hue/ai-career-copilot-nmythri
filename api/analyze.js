
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Gemini API key is missing in Vercel settings."
      });
    }

    const {
      resume,
      jobDescription,
      resumeLanguage,
      outputLanguage,
      feedbackLanguage,
      action
    } = req.body;

    if (!resume || resume.trim().length < 30) {
      return res.status(400).json({
        error: "Please provide valid resume content."
      });
    }

    const prompt = `
You are an expert AI resume analyzer and career coach.

Analyze the following resume.

RESUME:
${resume}

JOB DESCRIPTION:
${jobDescription || "Not provided"}

RESUME LANGUAGE: ${resumeLanguage || "Auto Detect"}
OUTPUT LANGUAGE: ${outputLanguage || "English"}
FEEDBACK LANGUAGE: ${feedbackLanguage || "English"}
ACTION: ${action || "Complete Resume Improvement"}

Rules:
- Never invent qualifications or work experience.
- Give specific and useful feedback.
- Compare against the job description when provided.
- Return only valid JSON.

Required JSON structure:
{
  "detected_language": "string",
  "professional_summary": "string",
  "improved_resume": "string",
  "translated_resume": "string",
  "strengths": ["string"],
  "grammar_corrections": ["string"],
  "suggestions": ["string"],
  "match_score": 0
}
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
      encodeURIComponent(apiKey),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json"
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Gemini API request failed."
      });
    }

    const resultText =
      data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!resultText) {
      return res.status(502).json({
        error: "Gemini returned an empty response."
      });
    }

    let result;

    try {
      result = JSON.parse(resultText);
    } catch {
      return res.status(502).json({
        error: "Gemini returned invalid JSON. Please try again."
      });
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error("Resume analysis error:", error);

    return res.status(500).json({
      error: error.message || "Internal server error."
    });
  }
}
