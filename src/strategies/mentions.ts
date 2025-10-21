import { BskyAgent } from "@atproto/api";

/**
 * Like recent mentions of your account
 */
export async function likeRecentMentions(agent: BskyAgent, limit = 20) {
  const notifications = await agent.listNotifications({ limit });
  
  for (const n of notifications.data.notifications) {
    if (n.reason === "mention" && n.reasonSubject) {
      try {
        await agent.like(n.uri, n.cid);
        console.log("Liked mention", n.uri);
      } catch (_e) {
        console.warn("Failed to like", n.uri);
      }
    }
  }
}
