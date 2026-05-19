import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";

export const prompt = ChatPromptTemplate.fromMessages([
  new MessagesPlaceholder({
    variableName: "history",
    optional: true,
  }),
  [
    "user",
    ["用户昵称：{nickname}", "当前场景：{scene}", "本轮输入：{input}"].join(
      "\n",
    ),
  ],
]);
