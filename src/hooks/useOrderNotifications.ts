import { useEffect, useRef, useCallback } from 'react'
import { apiGet } from '@/lib/api'
import { playOrderSound } from '@/utils/playOrderSound'

const useOrderNotifications = () => {
  const lastCountRef = useRef<number>(
    parseInt(localStorage.getItem('lastOrderCount') || '0', 10)
  )

  const checkNewOrders = useCallback(async () => {
    try {
      const stats = await apiGet('/api/stats')
      const currentCount: number = stats.totalOrders ?? 0

      if (
        currentCount > lastCountRef.current &&
        lastCountRef.current > 0 &&
        Notification.permission === 'granted'
      ) {
        const data = await apiGet('/api/orders?limit=1')
        const latest = data.orders?.[0]

        playOrderSound()
        const n = new Notification('🛍️ Nouvelle commande !', {
          body: `${latest?.customerName || 'Nouveau client'} — ${latest?.product || 'Produit'}`,
          icon: '/vite.svg',
          tag: 'new-order',
        })

        n.onclick = () => {
          window.focus()
          n.close()
        }
      }

      lastCountRef.current = currentCount
      localStorage.setItem('lastOrderCount', String(currentCount))
    } catch {
      // silent fail — do not crash on network errors
    }
  }, [])

  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }

    const interval = setInterval(checkNewOrders, 30_000)
    return () => clearInterval(interval)
  }, [checkNewOrders])
}

export default useOrderNotifications
