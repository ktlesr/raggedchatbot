
import OpenAI from "openai";

const openai = new OpenAI();

export async function getEmbeddings(text: string) {
    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
    });
    return response.data[0].embedding;
}
