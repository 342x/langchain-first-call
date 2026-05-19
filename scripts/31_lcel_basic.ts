import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { model } from "./model";

const prompt = ChatPromptTemplate.fromMessages([
  ['system', '你是一个前端开发助手，回答简洁。'],
  ['user', '{input}'],
])

const parser = new StringOutputParser()

const chain = prompt.pipe(model).pipe(parser)

const result = await chain.invoke({
  input: '解释一下 Runnable 为什么重要。RunnablePassthrough和RunnableLambda分别干嘛的？ 区别是合适呢么',
})

console.log(result)

