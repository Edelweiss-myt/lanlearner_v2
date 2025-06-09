
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { WordDefinition } from "../types"; // Removed ChatMessage, GroundingChunk
import { GEMINI_MODEL_TEXT } from "../constants";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY for Gemini is not set in environment variables. App functionality will be limited.");
}

const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : (null as any as GoogleGenAI);


export async function fetchWordDefinition(word: string): Promise<WordDefinition> {
  if (!API_KEY || !ai) return { error: "API 密钥未配置。无法查询释义。", definition: "", partOfSpeech: "", example: "" };
  try {
    const prompt = `请为英文单词 "${word}" 提供一个简明扼要的中文释义、中文词性（例如：名词、动词、形容词）以及一个相关的英文例句。请仅以 JSON 格式返回，结构如下：{"definition": "中文释义", "partOfSpeech": "中文词性", "example": "英文例句"}。如果找不到单词或无法定义，请返回 {"error": "Definition not found."}`;
    
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_TEXT,
      contents: [{role: 'user', parts: [{text: prompt}]}],
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    let jsonStr = (response.text || '').trim(); // Safely access response.text
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    
    const parsed = JSON.parse(jsonStr) as WordDefinition;
    if (parsed.error) {
        return { ...parsed, definition: "", partOfSpeech: "", example: "" };
    }
    return parsed;

  } catch (error) {
    console.error("Error fetching word definition:", error);
    let errorMessage = `无法获取单词 "${word}" 的释义。`;
    if (error instanceof Error) {
        if (error.message.includes('API key not valid')) {
             errorMessage = "API 密钥无效。请检查您的配置。";
        } else if (error.message.toLowerCase().includes('failed to fetch') || error.message.toLowerCase().includes('load failed') || error.message.toLowerCase().includes('networkerror')) {
            errorMessage = `查询释义失败。请检查您的网络连接并稍后重试。 (${error.message})`;
        } else if (error.message.includes('content requires a role')) {
            errorMessage = "请求格式错误，请联系开发者。";
        } else {
            errorMessage += ` 详情: ${error.message}`;
        }
    } else {
        errorMessage = `查询释义时发生未知错误。请检查网络并重试。`;
    }
    return {
      definition: "",
      partOfSpeech: "",
      example: "",
      error: errorMessage,
    };
  }
}

// convertChatHistoryToContents function removed
// generateChatResponse function removed
// generateChatResponseStream function removed
