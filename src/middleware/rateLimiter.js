import ratelimiter from "../config/upstash.js";


const rateLimiter = async (req, res, next) => {
  try{
    //Here we just keep it simple and use a static rate limit for now
    const { success, limit, remaining, reset } = await ratelimiter.limit("my-rate-limit"); //req.ip

//   res.setHeader("X-RateLimit-Limit", limit);
//   res.setHeader("X-RateLimit-Remaining", remaining);
//   res.setHeader("X-RateLimit-Reset", reset);

  if (!success) {
    return res.status(429).json({
      error: "Too many requests",
      message: "Please try again later",
    });
  }
  next();
  }catch(error){
    console.log(error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Please try again later",
    });
  }
};

export default rateLimiter;