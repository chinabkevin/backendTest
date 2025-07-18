import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis'


import "dotenv/config"

const ratelimiter = new Ratelimit({
  redis:Redis.fromEnv(),
  // limiter: Ratelimit.slidingWindow(100, '60 s'),
  limiter: Ratelimit.slidingWindow(100, '1 s'), //testing
})

export default ratelimiter;