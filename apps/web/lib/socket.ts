'use client';

import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from './api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
// Socket.IO connects at the origin, not the REST /api/v1 path.
const SOCKET_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, '');

let socket: Socket | null = null;

/**
 * Lazy singleton — created on first use, reused across client-side
 * navigations (the module instance persists for the SPA's lifetime). Auth is
 * re-evaluated on every (re)connect so a refreshed access token is picked up
 * automatically.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(`${SOCKET_ORIGIN}/ws`, {
      autoConnect: false,
      auth: (cb) => cb({ token: getAccessToken() }),
    });
  }
  if (!socket.connected) socket.connect();
  return socket;
}

/** Subscribe to one event for the lifetime of the calling component. */
export function useSocketEvent<T = unknown>(event: string, handler: (payload: T) => void): void {
  useEffect(() => {
    const s = getSocket();
    s.on(event, handler);
    return () => {
      s.off(event, handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
}

/** Live GPS — fire-and-forget; the server silently drops it if there's no active order. */
export function emitLocation(lat: number, lng: number): void {
  getSocket().emit('location:update', { lat, lng });
}
