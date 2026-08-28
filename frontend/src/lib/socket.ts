import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

/**
 * Lazily creates a single shared socket. Auth rides on the same httpOnly
 * session cookie as REST calls (withCredentials), never a client-readable
 * token — see backend/src/socket.ts.
 */
export function getSocket(): Socket {
  if (!socket) {
    const url = import.meta.env.VITE_SOCKET_URL || "/";
    socket = io(url, { path: "/socket.io", autoConnect: false, withCredentials: true });
  }
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
