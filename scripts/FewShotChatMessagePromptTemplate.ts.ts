import {
  ChatPromptTemplate,
  FewShotChatMessagePromptTemplate,
  MessagesPlaceholder
} from '@langchain/core/prompts'
import { selectExamples } from './selectExamples'

const examples = [
  {
    input: '今天开会被否了 3 次，我有点怀疑自己。',
    output:
      '被连续否定确实很伤状态，但这不等于你能力不行。先把被否的点拆成“需求变化”和“表达问题”两类，你会更容易看清哪里该改。今晚先别继续内耗，把问题归档下来就够了。',
  },
  {
    input: '我明知道要学 React 19，可一下班就只想躺着刷手机。',
    output:
      '你不是不想学，你只是下班后已经没有整块意志力了。今晚别定大目标，只看 15 分钟一个小点。先把启动门槛降下来，反而更容易重新进入状态。',
  },
]

const examplePrompt = ChatPromptTemplate.fromMessages([
  ['user', '{input}'],
  ['assistant', '{output}'],
])

const fewShotPrompt = new FewShotChatMessagePromptTemplate({
  examples:selectExamples('coding'),
  examplePrompt,
  inputVariables: [],
})

export const prompt = ChatPromptTemplate.fromMessages([
  fewShotPrompt,
  new MessagesPlaceholder('history'),
  ['user', '{input}'],
])
