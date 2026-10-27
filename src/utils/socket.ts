import { io, Socket } from 'socket.io-client'

let socketInstance: Socket | null = null

export function getSocket(): Socket {
  if (!socketInstance) {
    const serverUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'
    socketInstance = io(serverUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling']
    })

    socketInstance.on('connect', () => {
      console.log('⚡ [SOCKET.IO] Conectado ao servidor de tempo real:', socketInstance?.id)
      
      // Auto-join tenant if stored
      try {
        const storedAuth = localStorage.getItem('peoplehub_auth') || localStorage.getItem('auth_user')
        if (storedAuth) {
          const parsed = JSON.parse(storedAuth)
          const tenantId = parsed.tenantId || parsed.user?.tenantId || 'tenant_default'
          socketInstance?.emit('join:tenant', tenantId)
        }
      } catch (e) {
        // Ignora erro de parsing
      }
    })

    socketInstance.on('disconnect', (reason) => {
      console.warn('⚡ [SOCKET.IO] Desconectado:', reason)
    })

    socketInstance.on('connect_error', (err) => {
      console.warn('⚡ [SOCKET.IO] Erro de conexão:', err.message)
    })
  }

  return socketInstance
}

export function joinTenantRoom(tenantId: string) {
  const s = getSocket()
  if (s.connected) {
    s.emit('join:tenant', tenantId)
  } else {
    s.once('connect', () => {
      s.emit('join:tenant', tenantId)
    })
  }
}

export function subscribeToEvent<T = any>(event: string, callback: (data: T) => void): () => void {
  const s = getSocket()
  s.on(event, callback)
  return () => {
    s.off(event, callback)
  }
}

export function emitSocketEvent(event: string, payload: any) {
  const s = getSocket()
  s.emit(event, payload)
}
