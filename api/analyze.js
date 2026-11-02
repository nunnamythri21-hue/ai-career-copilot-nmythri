
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed. Please use POST."
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY is missing. Add it in Vercel Settings > Environment Variables."
      });
    }

    const body = req.body || {};
    const {
      resume,
      jobDescription = "",
      resumeLanguage = "Auto Detect",
      outputLanguage = "English",
      feedbackLanguage = "English",
      action = "Complete Resume Improvement"
    } = body;

    if (typeof resume !== "string" || resume.trim().length < 30) {
      return res.status(400).json({
        success: false,
        error: "Please provide resume content containing at least 30 characters."
      });
    }

    const prompt = `
You are an expert resume analyzer and career coach.

Analyze the following resume carefully.

RESUME:
${resume}

JOB DESCRIPTION:
${jobDescription || "Not provided"}

RESUME LANGUAGE: ${resumeLanguage}
OUTPUT LANGUAGE: ${outputLanguage}
FEEDBACK LANGUAGE: ${feedbackLanguage}
REQUESTED ACTION: ${action}

Return ONLY one valid JSON object with exactly these fields:
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
- Do not invent qualifications, skills, education, or work experience.
- Preserve the candidate's real information.
- Give practical and specific improvement suggestions.
- Give a match score from 0 to 100.
- If no job description is supplied, do not pretend to calculate a job match.
- Use the requested output language for the improved resume.
- Use the requested feedback language for explanations.
- Return valid JSON only. Do not include Markdown code fences.
`;

    const model = "gemini-2.5-flash";
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json"
          }
        })
      }
    );

    const responseText = await geminiResponse.text();

    let geminiData;
    try {
      geminiData = JSON.parse(responseText);
    } catch {
      console.error("Gemini returned a non-JSON response:", responseText.slice(0, 1000));
      return res.status(502).json({
        success: false,
        error: "Gemini returned an unexpected response. Please check the Gemini API configuration."
      });
    }

    if (!geminiResponse.ok) {
      console.error("Gemini API error:", geminiData);
      return res.status(502).json({
        success: false,
        error: geminiData.error?.message || `Gemini API request failed with status ${geminiResponse.status}.`
      });
    }

    const resultText =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!resultText) {
      console.error("Gemini response had no output text:", geminiData);
      return res.status(502).json({
        success: false,
        error: "Gemini did not return any analysis text."
      });
    }

    const cleanedText = resultText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let result;
    try {
      result = JSON.parse(cleanedText);
    } catch {
      console.error("Gemini output was not valid JSON:", cleanedText);
      return res.status(502).json({
        success: false,
        error: "Gemini returned analysis in an unexpected format. Please try again."
      });
    }

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error("Resume Analyzer API error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error while analyzing the resume."
    });
  }
}
