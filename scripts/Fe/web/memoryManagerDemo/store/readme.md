# 关于前端在memory的一些Demo及方案

## 短期记忆
- 短期记忆（ `storage` + 内存）
  - `sessionStorage`、`localStorage`、`IndexedDB`进行存储
    - 读写较慢（异步），有序列化开销、显示清除
  - 内存：根据所选框架进行结合（`redux`、`mobx`、`recoil`）等
    - 特点：读写快、无 IO开销 ；页面刷新及消失
- 为什么需要通过`Storage`+`内存`两层进行管理
  - 只用内存：页面刷新就丢失状态
  - 只用 sessionStorage：每次读写都要序列化/反序列化，频繁操作会影响性能
  - 所以应该是 内存主力+ storage 做备份
