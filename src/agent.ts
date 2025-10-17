import { BskyAgent } from '@atproto/api';

export async function createAgent(service: string, handle: string, password: string) {
  const agent = new BskyAgent({ service });
  await agent.login({ identifier: handle, password });
  return agent;
}
