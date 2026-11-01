export type ToastKind = 'success' | 'error' | 'info'
export const toastEvent = 'farmershaus:toast'

export function notify(message: string, kind: ToastKind = 'success') {
  window.dispatchEvent(new CustomEvent(toastEvent, { detail: { message, kind } }))
}
