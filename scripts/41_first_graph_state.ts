import { END, Graph, GraphNode, MessagesValue, START, StateGraph, StateSchema } from "@langchain/langgraph";
import { z } from "zod";

// 1.定义状态
const MyState = new StateSchema({
  messages: MessagesValue,
  currentStep: z.string().default("init"),
});
// 2.定义节点
const greet: GraphNode<typeof MyState> = (state) => {
  const userName = state.messages.at(-1)?.content ?? "朋友";
  return {
    messages: [{ role: "assistant", content: `你好${userName}` }],
    currentStep: "greeted",
  };
};

const farewell:GraphNode<typeof MyState> =state=>{
  return {
    messages:[{role:'assistant',content:'再见，有问题随时联系我'}],
    currentStep:'done'
  }
}

// 3. 构建图
const graph = new StateGraph(MyState)
// 添加节点：名称 + 处理函数
.addNode('greet',greet)
.addNode('farewell',farewell)
// 添加边
.addEdge(START,'greet')
.addEdge('greet','farewell')
.addEdge('farewell',END)
  // 编译：把图定义转化为可运行的实例
.compile()
// 4.运行
const result = await graph.invoke({
  messages:[{role:'user',content:'小明'}]
})
console.log(result.currentStep,'--->')

for(const msg of result.messages){
  console.log(`[${msg.getType()}]:${msg.content}`)
}
