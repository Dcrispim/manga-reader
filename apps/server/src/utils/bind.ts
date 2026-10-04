export {
  buildDeltaPayload,
  mergeBindData,
  type BindPayload,
  type BindData,
} from '@manga/core'

export const BIND_CODE_KEY = 'bindCode'
export const BIND_LAST_SYNC_KEY = 'bindLastSync'

export function getLastSync(): number {
  return Number(localStorage.getItem(BIND_LAST_SYNC_KEY) || 0)
}

export function setLastSync(timestamp: number) {
  localStorage.setItem(BIND_LAST_SYNC_KEY, String(timestamp))
}
