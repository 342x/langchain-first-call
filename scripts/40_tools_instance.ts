import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "langchain";
import { getWeather, createReminder } from "./40_tools";
import { model } from "./model";

const tools = [getWeather, createReminder];
const toolMap = new Map(tools.map((tool) => [tool.name, tool]));

const messages = [
  new HumanMessage("帮我看看明天上海天气，如果下雨就提醒我带伞。"),
];
//  mo模型绑定工具
const modelWithTools = model.bindTools(tools);

//  1. 模型先决定是否调用工具，如果需要返回 tool_calls

const aiMessage = await modelWithTools.invoke(messages);
messages.push(aiMessage);

// 2. 程序根据 tools_calls 真正执行
for (const toolCall of aiMessage.tool_calls ?? []) {
  const selectedTool = toolMap.get(toolCall.name);
  if (!selectedTool) {
    throw new Error(`未知工具：${toolCall.name}`);
  }
  // selectedTool.invoke(...) 会执行工具，并返回一个 ToolMessage。
  // 这个 ToolMessage 里会带上 tool_call_id，模型后面靠它来对上这次调用
    const toolMessage = await selectedTool.invoke(toolCall)
     messages.push(toolMessage)
}
// 3. 把工具结果再交给模型。
// 这一次拿到的，才是给用户看的最终回复。
const finalResponse = await modelWithTools.invoke(messages)
console.log("🚀 ~ finalResponse:", finalResponse)
console.log(finalResponse.text)
