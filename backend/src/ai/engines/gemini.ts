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
      // Disable thinking budget — we need fast JSON, not deep reasoning.
      // Without this, 2.5 Flash thinking can easily exceed the 5s timeout.
      generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as any,
    });
  }

  async resolve(nl: string, schemaSdl: string): Promise<ChartConfig> {
    const result = await this.model.generateContent(
      buildUserPrompt(nl, schemaSdl),
    );
    const raw = result.response.text().trim();

    // Extract JSON — handle plain JSON, ```json fences, or prose before the fence
    const fenceMatch = raw.match(/```json?\n?([\s\S]*?)\n?```/);
    const json = (fenceMatch ? fenceMatch[1] : raw).trim();

    try {
      console.log({ json });
      return JSON.parse(json) as ChartConfig;
    } catch {
      throw new Error(`Gemini returned malformed JSON: ${json.slice(0, 100)}`);
    }
  }
}
