import { JsonOutputParser, StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnablePassthrough, RunnableBranch } from "@langchain/core/runnables";
import { createAgent } from "langchain";
import { model } from "./model";

const classifyChain = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "判断用户消息意图，只输出以下三个类别之一：",
     
    ].join("\n"),
  ],
  ["user", "{input}"],
])
  .pipe(model)
  .pipe(new StringOutputParser());

// 三条前置链分别给不同场景补一个 scene 字段。
const techPrefilter = RunnablePassthrough.assign({
  scene: () => "tech",
});

const emotionalPrefilter = RunnablePassthrough.assign({
  scene: () => "emotional",
});

const casualPrefilter = RunnablePassthrough.assign({
  scene: () => "casual",
});

// 根据 classifyChain 的结果选择不同前置链。
const routeByIntent = RunnableBranch.from([
  [({ intent }: { intent: string }) => intent.trim() === "tech", techPrefilter],
  [
    ({ intent }: { intent: string }) => intent.trim() === "emotional",
    emotionalPrefilter,
  ],
  casualPrefilter,
]);

// 这一段还是 LCEL 前置链：先分类，再分支。
const preProcess = RunnablePassthrough.assign({ intent: classifyChain }).pipe(
  routeByIntent,
);

// Agent 负责拿到整理后的结果，生成最终回复。
const agent = createAgent({
  model,
  tools: [],
  systemPrompt: [
    "你是一个前端陪伴助手。",
    "scene=tech 时，优先回答技术问题。",
    "scene=emotional 时，先共情，再给一个小建议。",
    "scene=casual 时，就正常闲聊。",
  ].join("\n"),
});

// 先跑前置链，拿到 intent / scene / input。
const preProcessed = await preProcess.invoke({
  input: "今天开会被否了三次，心里有点堵。",
});
console.log("🚀 ~ preProcessed:", preProcessed);

// 再把路由后的结果整理成消息，交给 Agent。
const result = await agent.invoke({
  messages: [
    {
      role: "user",
      content: [
        `scene=${preProcessed.scene}`,
        `intent=${preProcessed.intent}`,
        `input=${preProcessed.input}`,
      ].join("\n"),
    },
  ],
});

// 最后一条消息就是这一轮的最终回复。
console.log(result.messages.at(-1)?.text ?? "");
