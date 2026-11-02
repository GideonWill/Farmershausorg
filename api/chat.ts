import { handleAgentChat } from '../frontend/src/lib/agent/handler'

export const config = {
  maxDuration: 30,
}

export default async function handler(req: Request) {
  return handleAgentChat(req)
}

export async function POST(req: Request) {
  return handleAgentChat(req)
}

