type Category = 'emotion' | 'learning' | 'coding'

type Example = {
  category: Category
  input: string
  output: string
}

const allExamples: Example[] = [
  {
    category: 'emotion',
    input: '今天一直被打断，心态有点炸。',
    output:
      '一直被打断确实很消耗人。先别急着责怪自己，先把今天剩余任务缩到一件最重要的事。你先把节奏稳住，再处理情绪。',
  },
  {
    category: 'learning',
    input: 'React 19 的知识点太多了，我不知道从哪开始。',
    output:
      '别先追求全懂，先抓住一个最常用的入口。今晚只看一个小点，把它跑通比泛看十篇文章更有效。',
  },
  {
    category: 'coding',
    input: '这个组件总是重复渲染，我有点看不懂。',
    output:
      '先别一起看所有状态，把触发渲染的源头拆开。先检查 props 变化，再看父组件状态，最后看订阅范围。把更新边界拆清楚，问题通常就会浮出来。',
  },
]

export function selectExamples(category: Category) {
  console.log("🚀 ~ selectExamples ~ category:", category)
  return allExamples.filter((item) => item.category === category).slice(0, 2)
}
