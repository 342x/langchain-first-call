import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { createAgent, Document } from "langchain";
import dotenv from "dotenv";
dotenv.config({ path: new URL("../.env.local", import.meta.url) });

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-small",
});

//  准备知识库
const vectorStor = await MemoryVectorStore.fromDocuments(
  [
    new Document({
      pageContent:
        "退款政策：购买后 30 天内可申请无条件退款。超过 30 天需要提供商品质量问题证明。",
      metadata: { source: "policy.pdf" },
    }),
    new Document({
      pageContent:
        "配送说明：标准配送 3 到 5 个工作日，加急配送 1 到 2 个工作日。",
      metadata: { source: "policy.pdf" },
    }),
  ],
  embeddings,
);

const agent = createAgent({
  model: "openai:gpt-4.1-mini",
  tools: [],
});

async function answer(question: string) {
  // 1. 先从向量库里找最相关的资料。
  const docs = await vectorStor.similaritySearch(question, 2);
  // 2. 将资料整理为上下文，交给后面的Agent
  const context = docs.map((doc) => doc.pageContent).join("\n\n");
  const result = await agent.invoke({
    messages: [
      {
        // system 负责告诉 Agent：下面这段内容是外部资料，不要脱离资料乱答。
        role: "system",
        content: `你是客服助手。请优先根据下面的参考资料回答用户问题。如果资料里没有明确答案，就直接说不知道，不要编造。参考资料：${context}`,
      },
      {
        // user 仍然保留用户原始问题。
        role: "user",
        content: question,
      },
    ],
  });
  //  最后一条消息就是本轮回答的结果
  return result.messages.at(-1)?.text ?? "";
}
const answerText = await answer("买完东西多久内可以退款？");

console.log(answerText);
