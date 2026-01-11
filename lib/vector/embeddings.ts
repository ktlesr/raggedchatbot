
import OpenAI from "openai";

const openaiDefault = new OpenAI();

export async function getEmbeddings(text: string, openaiInstance?: OpenAI) {
    const ai = openaiInstance || openaiDefault;
    const response = await ai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
    });
    return response.data[0].embedding;
}

export const getEmbedding = getEmbeddings;
