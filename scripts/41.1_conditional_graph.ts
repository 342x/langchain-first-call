import {
  ConditionalEdgeRouter,
  END,
  GraphNode,
  START,
  StateGraph,
  StateSchema,
  MessagesValue
} from "@langchain/langgraph";

import { z } from 'zod'

const State = new StateSchema({
  messages: MessagesValue,
  mood: z.enum(["happy", "sad", "neutral"]).default("neutral"),
});

// 2.分析情绪的节点
const analyzeMood: GraphNode<typeof State> = (state) => {
  const lastMsg = state.messages.at(-1)?.content?.toString() ?? "";
  let mood: "happy" | "sad" | "neutral" = "neutral";
  if (lastMsg.includes("开心") || lastMsg.includes("高兴")) mood = "happy";
  if (lastMsg.includes("难过") || lastMsg.includes("伤心")) mood = "sad";
  return { mood };
};
// 不通情绪对应的节点
const happyReply: GraphNode<typeof State> = () => ({
  messages: [
    { role: "assistant", content: "很高兴听到你这么开心！继续保持好心情 😊" },
  ],
});
const sadReply: GraphNode<typeof State> = () => ({
  messages: [{ role: "assistant", content: "别难过，有什么我能帮你的吗？" }],
});

const neutralReply: GraphNode<typeof State> = () => ({
  messages: [{ role: "assistant", content: "你好，有什么可以帮你的？" }],
});
//  路由函数
const moodRouter: ConditionalEdgeRouter<typeof State> = (state) => {
  switch (state.mood) {
    case "happy":
      return "happyReply";
    case "sad":
      return "sadReply";
    default:
      return "neutralReply";
  }
};

const graph = new StateGraph(State)
  .addNode("analyzeMood", analyzeMood)
  .addNode("happyReply", happyReply)
  .addNode("sadReply", sadReply)
  .addNode("neutralReply", neutralReply)
  .addEdge(START, "analyzeMood")
  .addConditionalEdges('analyzeMood', moodRouter, [
    'happyReply', 'sadReply', 'neutralReply',
  ])
  .addEdge('happyReply',END)
  .addEdge('sadReply',END)
  .addEdge('neutralReply',END)
  .compile()

const result = await graph.invoke({
  messages: [{ role: 'user', content: '今天好开心啊' }],
})

console.log(result.messages.at(-1)?.content)
