
import OpenAI from "openai";

export async function getEmbeddings(text: string, openaiInstance?: OpenAI) {
    const ai = openaiInstance || new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || 'no-key-at-build-time'
    });

    const response = await ai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
    });
    return response.data[0].embedding;
}

export const getEmbedding = getEmbeddings;
