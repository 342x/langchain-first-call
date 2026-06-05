import { makeAutoObservable } from 'mobx'

export class CounterStore {
  count = 0

  constructor() {
    makeAutoObservable(this)
  }

  inc() {
    this.count += 1
  }

  reset() {
    this.count = 0
  }
}

