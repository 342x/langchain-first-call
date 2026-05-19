import { JsonOutputParser } from '@langchain/core/output_parsers'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import dotenv from "dotenv";
import { z } from 'zod'
dotenv.config({ path: new URL("../.env.local", import.meta.url) });

const emotionSchema = z.object({
  emotion: z.enum(['calm', 'anxious', 'sad', 'angry']),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
})

const parser = new JsonOutputParser()

const prompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    [
      '你负责做情绪识别。',
      '只返回 JSON，不要补充解释。',
      parser.getFormatInstructions(),
    ].join('\n'),
  ],
  ['user', '{input}'],
])

const model = new ChatOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
  },
})

const chain = prompt.pipe(model).pipe(parser)

const emotionResult = await chain.invoke({
  input: '今天一直在改 bug，越改越乱，我有点烦。',
})

console.log(emotionResult)
