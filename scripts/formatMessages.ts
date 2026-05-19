import { ChatPromptTemplate } from '@langchain/core/prompts'

export const prompt = ChatPromptTemplate.fromMessages([
  [
    'user',
    [
      '用户昵称：{nickname}',
      '当前场景：{scene}',
      '本轮输入：{input}',
    ].join('\n'),
  ],
])
