import { JsonOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnablePassthrough } from "@langchain/core/runnables";
import { createAgent } from "langchain";
import { model } from "./model";

const emotionChain = ChatPromptTemplate.fromMessages([
  ["system", '分析用户情绪，只返回 JSON：{{"emotion":"", "confidence":0}}'],
  ["user", "{input}"],
])
  .pipe(model)
  .pipe(new JsonOutputParser());

const keywordChain = ChatPromptTemplate.fromMessages([
  ["system", "提取这句话里的关键词，只返回 JSON 数组。"],
  ["user", "{input}"],
])
  .pipe(model)
  .pipe(new JsonOutputParser());

const riskChain = ChatPromptTemplate.fromMessages([
  [
    "system",
    '判断这句话是否需要额外安抚，只返回 JSON：{{"level":"low|medium|high"}}',
  ],
  ["user", "{input}"],
])
  .pipe(model)
  .pipe(new JsonOutputParser());

const preProcess = RunnablePassthrough.assign({
  emotion: emotionChain,
  keywords: keywordChain,
  risk: riskChain,
});

const agent = createAgent({
  model,
  tools: [],
  systemPrompt: [
    "你是一个前端陪伴助手。",
    "如果 risk=high，先安抚，再给一个很小的动作建议。",
    "如果 risk=low，就正常交流，不要过度放大情绪。",
  ].join("\n"),
});

const preProcessed = await preProcess.invoke({
  input: "今天线上刚修完，脑子还是绷着的。",
});

const result = await agent.invoke({
  messages: [
    {
      role: "user",
      content: [
        `input=${preProcessed.input}`,
        `emotion=${JSON.stringify(preProcessed.emotion)}`,
        `keywords=${JSON.stringify(preProcessed.keywords)}`,
        `risk=${JSON.stringify(preProcessed.risk)}`,
      ].join("\n"),
    },
  ],
});

console.log(result.messages.at(-1)?.text ?? "");
