
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
        error: "GEMINI_API_KEY is missing in Vercel."
      });
    }

    const {
      resume,
      jobDescription,
      resumeLanguage,
      outputLanguage,
      feedbackLanguage,
      action
    } = req.body || {};

    if (!resume || typeof resume !== "string" || resume.trim().length < 30) {
      return res.status(400).json({
        error: "Please provide valid resume content."
      });
    }

    const prompt = `
You are an expert resume analyzer and career coach.

Analyze this resume:

${resume}

JOB DESCRIPTION:
${jobDescription || "Not provided"}

RESUME LANGUAGE: ${resumeLanguage || "Auto Detect"}
OUTPUT LANGUAGE: ${outputLanguage || "English"}
FEEDBACK LANGUAGE: ${feedbackLanguage || "English"}
ACTION: ${action || "Complete Resume Improvement"}

Return only valid JSON using this structure:
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

Rules:
- Do not invent qualifications or experience.
- Give specific suggestions.
- Use a match score from 0 to 100.
- Return valid JSON only.
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          model: "gemini-3.8-flash",
          input: prompt,
          store: false
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
      data.output_text ||
      data.steps
        ?.filter(step => step.type === "model_output")
        .flatMap(step => step.content || [])
        .filter(item => item.type === "text")
        .map(item => item.text)
        .join("\n");

    if (!resultText) {
      return res.status(502).json({
        error: "Gemini returned an empty response."
      });
    }

    const cleanedText = resultText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    const result = JSON.parse(cleanedText);

    return res.status(200).json(result);

  } catch (error) {
    console.error("Gemini error:", error);

    return res.status(500).json({
      error: error.message || "Resume analysis failed."
    });
  }
}
