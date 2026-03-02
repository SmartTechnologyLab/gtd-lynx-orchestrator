import Anthropic from '@anthropic-ai/sdk';
import type { AgentConfig, AgentMessage } from '../types.js';

const client = new Anthropic();

export async function callAgent(
  agent: AgentConfig,
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<string> {
  const messages = [
    ...conversationHistory,
    { role: 'user' as const, content: userMessage },
  ];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    system: agent.systemPrompt,
    messages,
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  return textBlock?.text ?? '[No response]';
}

export async function askTeamLeadToDecompose(
  agent: AgentConfig,
  projectDescription: string,
  availableAgents: AgentConfig[]
): Promise<string> {
  const agentList = availableAgents
    .filter((a) => a.id !== 'teamlead')
    .map((a) => `- ${a.emoji} ${a.name} (${a.id}): ${a.role}`)
    .join('\n');

  const prompt = `
PROJECT REQUEST:
${projectDescription}

AVAILABLE AGENTS:
${agentList}

Please:
1. Analyze this project and break it down into parallel subtasks
2. Assign each subtask to the most appropriate agent
3. Identify dependencies between tasks
4. Define what each agent should deliver

Respond in this format:
## Decomposition
[Brief analysis of the project]

## Tasks
For each task:
### Task: [title]
- Agent: [agent_id]
- Type: [code|architecture|ux|gtd-workflow|sprint-plan|documentation]
- Description: [what to do]
- Deliverable: [what to deliver]
- Dependencies: [none or task titles]
`;

  return callAgent(agent, prompt);
}

export async function askAgentToWork(
  agent: AgentConfig,
  task: string,
  context: string = ''
): Promise<string> {
  const prompt = `
TASK ASSIGNED TO YOU:
${task}

${context ? `CONTEXT FROM OTHER AGENTS:\n${context}` : ''}

Please complete this task thoroughly. Provide concrete, actionable deliverables.
If you need to write code, write complete, working TypeScript/ReactLynx code.
If you need to design, provide detailed specifications.
`;

  return callAgent(agent, prompt);
}

export async function askTeamLeadToReview(
  agent: AgentConfig,
  agentName: string,
  taskDescription: string,
  result: string
): Promise<{ approved: boolean; comment: string }> {
  const prompt = `
REVIEW REQUEST:
Agent: ${agentName}
Task: ${taskDescription}

AGENT'S DELIVERABLE:
${result}

Please review this deliverable. Check for:
1. Completeness - does it cover all requirements?
2. Quality - is it production-ready?
3. Consistency - does it align with the project architecture?
4. GTD compliance - does it follow GTD methodology correctly?
5. Lynx best practices - does it use Lynx features properly?

Respond in this format:
## Verdict: [APPROVED or REVISION_NEEDED]
## Comment: [Your review feedback]
## Action items: [If revision needed, list specific changes required]
`;

  const response = await callAgent(agent, prompt);
  const approved = response.includes('APPROVED') && !response.includes('REVISION_NEEDED');

  return { approved, comment: response };
}
