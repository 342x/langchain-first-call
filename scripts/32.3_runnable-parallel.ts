import { RunnableParallel } from "@langchain/core/runnables";

const parallel = RunnableParallel.from({
  emotion: emotionChain,
  keywords: keywordChain,
  risk: riskChain,
})
