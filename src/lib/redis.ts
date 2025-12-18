import Redis from "ioredis"

declare global {
  var __redis: Redis | undefined
  var __redisListenersAttached: boolean | undefined
}

const redisUrl = process.env.REDIS_URL

if (!redisUrl) {
  throw new Error("Missing REDIS_URL")
}

export const redis =
  global.__redis ??
  new Redis(redisUrl, {
    tls: redisUrl.startsWith("rediss://") ? {} : undefined,
  })

if (!global.__redisListenersAttached) {
  redis.on("connect", () => console.log("[redis] connect"))
  redis.on("ready", () => console.log("[redis] ready"))
  redis.on("reconnecting", () => console.log("[redis] reconnecting"))
  redis.on("end", () => console.log("[redis] end"))
  redis.on("error", (err) => console.error("[redis] error", err))
  global.__redisListenersAttached = true
}

if (process.env.NODE_ENV !== "production") {
  global.__redis = redis
}
