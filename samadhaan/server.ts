import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Enable high-limit JSON parsing for base64 images
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// Lazy initializer for Gemini API client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// 1. AI-Powered Issue Categorization & Analysis Route
app.post("/api/analyze-issue", async (req, res) => {
  try {
    const { imageBase64, mimeType, descriptionNotes } = req.body;
    const ai = getGeminiClient();

    let contents: any[] = [];
    if (imageBase64 && mimeType) {
      contents.push({
        inlineData: {
          mimeType: mimeType,
          data: imageBase64,
        },
      });
    }

    const notesPrompt = descriptionNotes
      ? `User notes about this issue: "${descriptionNotes}"`
      : "No extra user notes provided.";

    const prompt = `
      You are an expert municipal AI assistant that helps citizens report and categorize community issues.
      Based on the provided image and/or description notes, analyze the hyperlocal issue and output a structured JSON object containing:
      1. title: A concise, human-friendly title for the issue (e.g. "Severe Main Street Pothole").
      2. description: A clear, structured description of the hazard and why it needs immediate attention.
      3. category: Strictly one of these exact strings: "Pothole", "Water Leakage", "Damaged Streetlight", "Waste Management", "Public Infrastructure", "Other".
      4. severity: A prediction of safety risk, strictly one of: "Low", "Medium", "High", "Critical".
      5. suggestedAction: An immediate warning or safety instruction for citizens visiting or living near this hotspot.

      ${notesPrompt}
    `;

    contents.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            category: { 
              type: Type.STRING,
              description: "Strictly one of: 'Pothole', 'Water Leakage', 'Damaged Streetlight', 'Waste Management', 'Public Infrastructure', 'Other'"
            },
            severity: { 
              type: Type.STRING,
              description: "Strictly one of: 'Low', 'Medium', 'High', 'Critical'"
            },
            suggestedAction: { type: Type.STRING }
          },
          required: ["title", "description", "category", "severity", "suggestedAction"]
        }
      }
    });

    const resultText = response.text || "{}";
    const parsedResult = JSON.parse(resultText);

    res.json({ success: true, analysis: parsedResult });
  } catch (error: any) {
    console.error("Error in /api/analyze-issue:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. AI-Powered Predictive Insights & Hotspots Route
app.post("/api/predictive-insights", async (req, res) => {
  try {
    const { currentReports } = req.body;
    const ai = getGeminiClient();

    const reportsText = JSON.stringify(currentReports || []);

    const prompt = `
      You are a Senior Municipal Planning AI. Analyze the following reported community issues data and predict localized hazards, failures, or service gaps:
      ${reportsText}

      Your task is to generate:
      1. hotspotPredictions: An array of predicted failure clusters or locations at risk, identifying the category, predicted riskScore (0 to 100), predictedLocation description, reasoning based on reported data density, and proposed preventiveAction.
      2. systemReportSummary: A high-level executive summary of trends, highlighting which municipal categories need budget/manpower allocation this week.
      3. officialAnnouncementDraft: A polite public announcement template that community managers can use to update citizens about preventive maintenance.

      Output strictly valid JSON according to the schema.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hotspotPredictions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  riskScore: { type: Type.INTEGER },
                  predictedLocation: { type: Type.STRING },
                  reasoning: { type: Type.STRING },
                  preventiveAction: { type: Type.STRING }
                },
                required: ["category", "riskScore", "predictedLocation", "reasoning", "preventiveAction"]
              }
            },
            systemReportSummary: { type: Type.STRING },
            officialAnnouncementDraft: { type: Type.STRING }
          },
          required: ["hotspotPredictions", "systemReportSummary", "officialAnnouncementDraft"]
        }
      }
    });

    const resultText = response.text || "{}";
    const parsedResult = JSON.parse(resultText);

    res.json({ success: true, insights: parsedResult });
  } catch (error: any) {
    console.error("Error in /api/predictive-insights:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Integrate Vite Middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
