import { createAgent } from "langchain";
import { getWeather,createReminder } from "./40_tools";
import { model } from "./model";

const agent = createAgent({
  model,
  tools:[getWeather,createReminder],
   systemPrompt: '你是用户的生活助理，能聊天，也能在必要时调用工具。',
})

const result = await agent.invoke({
  messages: [
    {
      role: 'user',
      content: '帮我看看明天上海天气，如果下雨就提醒我带伞。',
    },
  ],
})
console.log(result.messages.at(-1)?.text)
