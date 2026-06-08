import { GoogleGenerativeAI } from "@google/generative-ai";
import { AIEngine } from "../../../../shared/types/ai";
import { ChartConfig } from "../../../../shared/types/chart";
import { SYSTEM_INSTRUCTION, buildUserPrompt } from "../prompt";

export class GeminiEngine implements AIEngine {
  private model;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
    });
  }

  async resolve(nl: string, schemaSdl: string): Promise<ChartConfig> {
    const result = await this.model.generateContent(
      buildUserPrompt(nl, schemaSdl),
    );
    const raw = result.response.text().trim();

    const json = raw
      .replace(/^```json?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    try {
      console.log({ json });
      return JSON.parse(json) as ChartConfig;
    } catch {
      throw new Error(`Gemini returned malformed JSON: ${json.slice(0, 100)}`);
    }
  }
}
