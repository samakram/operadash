import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import cookie from "cookie";
import { verifyAccessToken } from "@/utils/jwt";
import { COOKIE_NAMES } from "@/middleware/auth";
import { logger } from "@/utils/logger";

let io: Server | undefined;

function tenantRoom(tenantId: string): string {
  return `tenant:${tenantId}`;
}

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN ?? "http://localhost:5173", credentials: true },
  });

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const pubClient = new Redis(redisUrl);
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
  }

  // The access token lives in an httpOnly cookie (never readable from client JS),
  // so authenticate the handshake the same way HTTP requests are: read it off
  // the raw Cookie header of the upgrade request rather than a client-supplied token.
  io.use((socket: Socket, next) => {
    try {
      const rawCookie = socket.request.headers.cookie;
      const token = rawCookie ? cookie.parse(rawCookie)[COOKIE_NAMES.ACCESS_COOKIE] : undefined;
      if (!token) {
        next(new Error("Unauthorized"));
        return;
      }
      const payload = verifyAccessToken(token);
      socket.data.auth = payload;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const tenantId = socket.data.auth?.tenantId as string | undefined;
    if (tenantId) {
      socket.join(tenantRoom(tenantId));
    }
    logger.debug({ socketId: socket.id, tenantId }, "Socket connected");
  });

  return io;
}

export function getIo(): Server {
  if (!io) {
    throw new Error("Socket.io has not been initialized yet");
  }
  return io;
}

/** Broadcasts a real-time event to every connected client of a tenant. */
export function emitToTenant(tenantId: string, event: string, payload: unknown): void {
  if (!io) return;
  io.to(tenantRoom(tenantId)).emit(event, payload);
}
