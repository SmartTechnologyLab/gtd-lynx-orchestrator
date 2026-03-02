// Agent definition
export interface AgentConfig {
  id: string;
  name: string;
  emoji: string;
  role: string;
  systemPrompt: string;
  /** Tasks this agent can auto-approve without human review */
  autoApprove: TaskType[];
}

// Task types for approval routing
export type TaskType =
  | 'code'
  | 'architecture'
  | 'ux'
  | 'gtd-workflow'
  | 'sprint-plan'
  | 'review'
  | 'documentation';

// Approval model
export type ApprovalMode = 'auto' | 'human' | 'hybrid';

export interface ApprovalConfig {
  mode: ApprovalMode;
  /** Task types that always require human approval */
  humanRequired: TaskType[];
  /** Task types the team lead agent can auto-approve */
  agentCanApprove: TaskType[];
}

// Orchestration state
export type StepStatus = 'pending' | 'working' | 'waiting_approval' | 'approved' | 'revision' | 'rejected' | 'done';

export interface OrchestrationStep {
  id: string;
  agent: string;
  task: string;
  taskType: TaskType;
  status: StepStatus;
  result?: string;
  reviewComment?: string;
  dependencies?: string[]; // step IDs this depends on
  createdAt: Date;
  completedAt?: Date;
}

export interface OrchestrationState {
  projectName: string;
  projectDescription: string;
  steps: OrchestrationStep[];
  currentPhase: 'decomposition' | 'parallel_work' | 'review' | 'planning' | 'done';
  approvalConfig: ApprovalConfig;
}

// Claude API interaction
export interface AgentMessage {
  agent: string;
  content: string;
  type: 'thinking' | 'result' | 'review' | 'delegation' | 'question';
  timestamp: Date;
}

// CLI display
export interface CLITheme {
  primary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  muted: string;
}
