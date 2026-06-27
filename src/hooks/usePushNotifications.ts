import { useEffect } from 'react'
import { apiPost } from '@/lib/api'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

const usePushNotifications = (vapidPublicKey: string) => {
  useEffect(() => {
    if (!vapidPublicKey) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    const subscribe = async () => {
      try {
        if (typeof Notification === 'undefined') return
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        const registration = await navigator.serviceWorker.ready
        const existing = await registration.pushManager.getSubscription()
        if (existing) return // already subscribed

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
        })

        await apiPost('/api/business/push-subscription', subscription.toJSON())
        console.log('[PUSH] Subscribed successfully')
      } catch (err) {
        console.error('[PUSH] Subscription failed:', err)
      }
    }

    subscribe()
  }, [vapidPublicKey])
}

export default usePushNotifications
