import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'


const loader = new PDFLoader('../data/郭航-影像云平台研发工程师(1).pptx')

const docs = await loader.load();

console.log(docs.length)

console.log("🚀 ~ docs:", docs[0].pageContent.slice(0,80))

console.log(docs[0].metadata)

