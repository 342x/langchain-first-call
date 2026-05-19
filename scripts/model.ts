import { ChatOpenAI } from "@langchain/openai";
import dotenv from 'dotenv'
import { createAgent } from "langchain";

dotenv.config({ path: new URL('../.env.local', import.meta.url) })

// 定义模型
export const model = new ChatOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
  },
})

export const agent = createAgent({
  model,
  tools:[],
})
