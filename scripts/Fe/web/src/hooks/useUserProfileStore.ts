import { useMemo } from 'react'
import { UserProfileStore } from '../stores/UserProfileStore'

let profileStore: UserProfileStore | null = null

export function useUserProfileStore() {
  return useMemo(() => {
    if (!profileStore) profileStore = new UserProfileStore()
    return profileStore
  }, [])
}

