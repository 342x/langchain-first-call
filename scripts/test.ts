import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
// import { prompt } from "./MessagesPlaceholder";
import { prompt } from "./FewShotChatMessagePromptTemplate.ts";
import dotenv from "dotenv";

dotenv.config({ path: new URL("../.env.local", import.meta.url) });


const model = new ChatOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
  },
});

const agent = createAgent({
  model,
  tools: [],
  systemPrompt:  '你是一名面向前端开发者的陪伴助手。先共情，再给建议，控制在 3 句话以内。',
});

const promptValue = await prompt.invoke({
  history: [
    {
      role: 'user',
      content: '今天开会又改需求了。',
    },
    {
      role: 'assistant',
      content: '听起来你已经有点烦了，最麻烦的是哪一段？',
    },
  ],
  input: '最烦的是昨天刚定下来，今天又推翻了。',
})



const stream = await agent.stream(
  {
    messages:promptValue.toChatMessages()
  },
  {
    streamMode: "messages",
  },
);

process.stdout.write("agent stream result:\n");

for await (const [messageChunk] of stream) {
  if (messageChunk.content) {
    process.stdout.write(messageChunk.text);
  }
}

process.stdout.write("\n");
