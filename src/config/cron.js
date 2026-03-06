import cron from "cron";
import https from "https";
import { runSubscriptionExpiryReminders } from "../services/subscriptionEmailService.js";

const job = new cron.CronJob("*/14 * * * *", function () {
  https
    .get(process.env.API_URL, (res) => {
      if (res.statusCode === 200) console.log("GET request sent successfully");
      else console.log("GET request failed", res.statusCode);
    })
    .on("error", (e) => console.error("Error while sending request", e));
});

// Run every day at 02:00 AM - send subscription expiry reminders (2 days before)
const subscriptionExpiryJob = new cron.CronJob(
  "0 2 * * *",
  async function () {
    try {
      const result = await runSubscriptionExpiryReminders();
      console.log("Subscription expiry reminders sent:", result?.sent ?? 0);
    } catch (e) {
      console.error("Subscription expiry job error:", e);
    }
  },
  null,
  false
);

export default job;
export { subscriptionExpiryJob };


// CRON JOB EXPLANATION:
// Cron jobs are scheduled tasks that run periodically at fixed intervals
// we want to send 1 GET request for every 14 minutes

// How to define a "Schedule"?
// You define a schedule using a cron expression, which consists of 5 fields representing:

//! MINUTE, HOUR, DAY OF THE MONTH, MONTH, DAY OF THE WEEK

//? EXAMPLES && EXPLANATION:
//* 14 * * * * - Every 14 minutes
//* 0 0 * * 0 - At midnight on every Sunday
//* 30 3 15 * * - At 3:30 AM, on the 15th of every month
//* 0 0 1 1 * - At midnight, on January 1st
//* 0 * * * * - Every hour