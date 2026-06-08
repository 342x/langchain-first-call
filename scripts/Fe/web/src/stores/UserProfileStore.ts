import { makeAutoObservable } from 'mobx'

export type UserProfile = {
  name: string | null
}

const STORAGE_KEY = 'fe_user_profile_v1'

export class UserProfileStore {
  name: string | null = null

  constructor() {
    makeAutoObservable(this)
    this.load()
  }

  setName(name: string) {
    const value = name.trim()
    this.name = value.length > 0 ? value : null
    this.save()
  }

  clear() {
    this.name = null
    this.save()
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as UserProfile
      this.name = typeof parsed.name === 'string' ? parsed.name : null
    } catch {
    }
  }

  private save() {
    try {
      const payload: UserProfile = { name: this.name }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
    }
  }
}

