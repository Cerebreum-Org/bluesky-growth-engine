import { BskyAgent } from "@atproto/api";

/**
 * Follow back users who follow you
 */
export async function followBack(agent: BskyAgent, limit = 20) {
  const session = agent.session;
  if (!session) throw new Error("Not authenticated");
  
  const profile = await agent.getProfile({ actor: session.handle });
  const followersRes = await agent.getFollowers({ actor: profile.data.did, limit });
  const followingRes = await agent.getFollows({ actor: profile.data.did, limit });

  const following = new Set((followingRes.data.follows || []).map(f => f.did));
  const toFollow = (followersRes.data.followers || []).filter(f => !following.has(f.did));

  for (const f of toFollow) {
    try {
      await agent.follow(f.did);
      console.log("Followed", f.handle);
    } catch (_e) {
      console.warn("Failed to follow", f.handle);
    }
  }
}
