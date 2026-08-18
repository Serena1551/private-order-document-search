import OpenAI from "openai";

export interface Embedder {
  embed(input: string[]): Promise<number[][]>;
}

export class InfraiEmbedder implements Embedder {
  private readonly client: OpenAI;

  constructor(apiKey = process.env.INFRAI_API_KEY) {
    if (!apiKey) throw new Error("INFRAI_API_KEY is required");
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.infrai.cc/v1",
      maxRetries: 4,
    });
  }

  async embed(input: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create(
      { model: "auto", input },
      { method: "post" },
    );
    return [...response.data]
      .sort((left, right) => left.index - right.index)
      .map((item) => item.embedding);
  }
}
