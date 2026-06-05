import { observer } from 'mobx-react-lite'
import styles from './App.module.less'
import { useCounterStore } from './hooks/useCounterStore'
import { MemoryPanel } from './components/MemoryPanel'

function App() {
  const counterStore = useCounterStore()

  return (
    <>
      <div>测试</div>
      <MemoryPanel/>
    </>
  )
}

export default observer(App)
