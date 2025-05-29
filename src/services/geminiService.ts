import { GoogleGenAI, GenerateContentResponse, Content } from "@google/genai";
import { WordDefinition, ChatMessage, GroundingChunk } from "../types"; // Adjusted path for src/
import { GEMINI_MODEL_TEXT } from "../constants"; // Adjusted path for src/

// For Vite, environment variables must be prefixed with VITE_
// Access them via import.meta.env
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.error("API_KEY for Gemini (VITE_GEMINI_API_KEY) is not set in environment variables. App functionality will be limited.");
}

// Initialize AI client conditionally
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

    let jsonStr = (response.text ?? '').trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    
    const parsed = JSON.parse(jsonStr || '{}') as WordDefinition; // Provide default empty object for parse if jsonStr is empty
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


function convertChatHistoryToContents(history: ChatMessage[]): Content[] {
    const contents: Content[] = [];
    history.forEach(msg => {
        if (msg.text || msg.sender === 'user') { 
            contents.push({
                role: msg.sender === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text || "" }] 
            });
        }
    });
    return contents;
}


export async function generateChatResponse(
  prompt: string,
  history: ChatMessage[]
): Promise<{ text: string, sources?: GroundingChunk[]}> {
  if (!API_KEY || !ai) return { text: "API 密钥未配置。聊天功能不可用。" };
  
  const chatHistory = convertChatHistoryToContents(history);
  const currentMessage: Content = { role: 'user', parts: [{text: prompt}] };

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: GEMINI_MODEL_TEXT,
        contents: [...chatHistory, currentMessage],
        config: {
            tools: [{ googleSearch: {} }], 
            temperature: 0.7,
        },
    });

    const text = response.text ?? '';
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;
    
    return { text, sources };

  } catch (error) {
    console.error("Error generating chat response:", error);
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
        if (error.message.includes('API key not valid')) {
            throw new Error("API 密钥无效。AI 聊天服务当前不可用。");
        }
         if (error.message.toLowerCase().includes('failed to fetch') || error.message.toLowerCase().includes('load failed') || error.message.toLowerCase().includes('networkerror')) {
            throw new Error(`AI 聊天连接失败。请检查您的网络连接。 (${error.message})`);
        }
    }
    throw new Error("AI 聊天服务当前不可用，请稍后重试。");
  }
}

export async function* generateChatResponseStream(
  prompt: string,
  history: ChatMessage[]
): AsyncGenerator<{text: string, sources?: GroundingChunk[]}> {
    if (!API_KEY || !ai) {
        yield { text: "API 密钥未配置。流式聊天功能不可用。" };
        return;
    }

    const chatHistory = convertChatHistoryToContents(history);
    const currentMessage: Content = { role: 'user', parts: [{text: prompt}] };

    try {
        const stream = await ai.models.generateContentStream({
            model: GEMINI_MODEL_TEXT,
            contents: [...chatHistory, currentMessage],
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0.7,
            },
        });

        for await (const chunk of stream) {
            const text = chunk.text ?? '';
            const sources = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;
            yield { text, sources };
        }
    } catch (error) {
        console.error("Error generating chat stream:", error);
        if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
            if (error.message.includes('API key not valid')) {
                yield { text: "错误：API 密钥无效。AI 聊天流获取失败。" };
                return;
            }
            if (error.message.toLowerCase().includes('failed to fetch') || error.message.toLowerCase().includes('load failed') || error.message.toLowerCase().includes('networkerror')) {
                 yield { text: `错误：AI 聊天流连接失败。请检查网络。 (${error.message})` };
                 return;
            }
        }
        yield { text: "错误：AI 聊天流获取失败，请稍后重试。" };
    }
}