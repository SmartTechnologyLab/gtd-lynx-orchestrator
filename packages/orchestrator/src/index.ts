import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import boxen from 'boxen';
import { allAgents } from './agents/index.js';
import {
  askTeamLeadToDecompose,
  askAgentToWork,
  askTeamLeadToReview,
} from './core/claude.js';
import type { ApprovalConfig, TaskType } from './types.js';

// ── Config ──────────────────────────────────────────
const approvalConfig: ApprovalConfig = {
  mode: 'hybrid',
  humanRequired: ['architecture', 'sprint-plan'],
  agentCanApprove: ['code', 'documentation', 'gtd-workflow', 'ux'],
};

// ── CLI Helpers ─────────────────────────────────────
function header() {
  console.log(
    boxen(
      chalk.bold('🔄 Multi-Agent Orchestrator') +
        '\n' +
        chalk.dim('GTD App on Lynx — Supervisor Pattern') +
        '\n' +
        chalk.dim('Hybrid approval: agent + human on key decisions'),
      {
        padding: 1,
        borderColor: 'cyan',
        borderStyle: 'round',
      }
    )
  );
}

function agentHeader(agentId: string, action: string) {
  const agent = allAgents[agentId];
  if (!agent) return;
  console.log(
    `\n${agent.emoji} ${chalk.hex('#4ECDC4').bold(agent.name)} — ${chalk.dim(action)}`
  );
  console.log(chalk.dim('─'.repeat(60)));
}

function printResult(text: string) {
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.startsWith('##')) {
      console.log(chalk.yellow.bold(line));
    } else if (line.startsWith('###')) {
      console.log(chalk.cyan(line));
    } else if (line.startsWith('- ')) {
      console.log(chalk.dim('  ') + line);
    } else {
      console.log(chalk.white(line));
    }
  }
}

async function humanApproval(
  agentName: string,
  taskType: TaskType,
  result: string,
  teamLeadReview: string
): Promise<{ approved: boolean; feedback: string }> {
  console.log(
    boxen(
      chalk.yellow.bold('⏸  HUMAN APPROVAL REQUIRED') +
        '\n\n' +
        chalk.dim(`Task type: ${taskType}`) +
        '\n' +
        chalk.dim(`Agent: ${agentName}`) +
        '\n\n' +
        chalk.white('Team Lead review:') +
        '\n' +
        chalk.dim(teamLeadReview.substring(0, 500) + '...'),
      { padding: 1, borderColor: 'yellow', borderStyle: 'round' }
    )
  );

  const { decision } = await inquirer.prompt([
    {
      type: 'list',
      name: 'decision',
      message: 'Your decision:',
      choices: [
        { name: '✅ Approve', value: 'approve' },
        { name: '⚠️  Request revision', value: 'revise' },
        { name: '❌ Reject', value: 'reject' },
        { name: '👀 Show full result first', value: 'show' },
      ],
    },
  ]);

  if (decision === 'show') {
    console.log('\n' + chalk.dim('─'.repeat(60)));
    printResult(result);
    console.log(chalk.dim('─'.repeat(60)) + '\n');

    const { finalDecision } = await inquirer.prompt([
      {
        type: 'list',
        name: 'finalDecision',
        message: 'Your decision after review:',
        choices: [
          { name: '✅ Approve', value: 'approve' },
          { name: '⚠️  Request revision', value: 'revise' },
          { name: '❌ Reject', value: 'reject' },
        ],
      },
    ]);

    if (finalDecision === 'revise') {
      const { feedback } = await inquirer.prompt([
        { type: 'input', name: 'feedback', message: 'Revision feedback:' },
      ]);
      return { approved: false, feedback };
    }
    return { approved: finalDecision === 'approve', feedback: '' };
  }

  if (decision === 'revise') {
    const { feedback } = await inquirer.prompt([
      { type: 'input', name: 'feedback', message: 'Revision feedback:' },
    ]);
    return { approved: false, feedback };
  }

  return { approved: decision === 'approve', feedback: '' };
}

// ── Main Orchestration ──────────────────────────────
async function main() {
  header();

  // Step 1: Get project description
  const { projectDesc } = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectDesc',
      message: '📝 Describe your project:',
      default:
        'Mobile GTD (Getting Things Done) app built with Lynx framework. Daily task funnel with Inbox → Clarify → Organize → Reflect → Engage workflow. Offline-first, swipe gestures, context-based task filtering.',
    },
  ]);

  // Step 2: Team Lead decomposes
  agentHeader('teamlead', 'Decomposing project into subtasks...');
  const spinner = ora({
    text: 'Team Lead is analyzing the project...',
    color: 'cyan',
  }).start();

  const decomposition = await askTeamLeadToDecompose(
    allAgents.teamlead,
    projectDesc,
    Object.values(allAgents)
  );

  spinner.succeed('Decomposition complete');
  printResult(decomposition);

  // Step 3: Human approves decomposition
  const { approveDecomp } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'approveDecomp',
      message: '✅ Approve this decomposition and start agents?',
      default: true,
    },
  ]);

  if (!approveDecomp) {
    console.log(chalk.yellow('Orchestration cancelled. Refine your request and try again.'));
    return;
  }

  // Step 4: Parallel agent work (simulated sequential for CLI)
  const agentTasks: Array<{ agentId: string; task: string; taskType: TaskType }> = [
    { agentId: 'gtd', task: 'Define the complete GTD workflow, state machine for task lifecycle, context taxonomy, and daily/weekly review checklists for the app.', taskType: 'gtd-workflow' },
    { agentId: 'ux', task: 'Design all screens (Inbox, Today, Projects, Review), navigation flow, gesture interactions, and the daily funnel UX.', taskType: 'ux' },
    { agentId: 'architect', task: 'Design the full architecture: folder structure, data models, state management with Zustand, offline-first sync strategy, and Lynx dual-thread usage.', taskType: 'architecture' },
    { agentId: 'frontend', task: 'Write core ReactLynx components: TaskCard, SwipeableRow, QuickAddBar, InboxScreen. Include CSS styles and gesture handlers.', taskType: 'code' },
  ];

  const results: Map<string, string> = new Map();

  for (const { agentId, task, taskType } of agentTasks) {
    const agent = allAgents[agentId];
    agentHeader(agentId, `Working on: ${task.substring(0, 60)}...`);

    const workSpinner = ora({
      text: `${agent.emoji} ${agent.name} is working...`,
      color: 'magenta',
    }).start();

    const result = await askAgentToWork(agent, task);
    workSpinner.succeed(`${agent.name} delivered`);
    printResult(result);
    results.set(agentId, result);

    // Step 5: Review
    agentHeader('teamlead', `Reviewing ${agent.name}'s work...`);
    const reviewSpinner = ora({ text: 'Team Lead reviewing...', color: 'yellow' }).start();

    const review = await askTeamLeadToReview(
      allAgents.teamlead,
      agent.name,
      task,
      result
    );

    reviewSpinner.stop();

    // Hybrid approval logic
    const needsHumanApproval = approvalConfig.humanRequired.includes(taskType);

    if (needsHumanApproval) {
      // Human must approve
      const humanResult = await humanApproval(agent.name, taskType, result, review.comment);
      if (humanResult.approved) {
        console.log(chalk.green(`  ✅ ${agent.name} — Approved by you`));
      } else {
        console.log(chalk.yellow(`  ⚠️  ${agent.name} — Revision requested: ${humanResult.feedback}`));
        // In production: re-run agent with feedback
      }
    } else if (review.approved) {
      // Agent auto-approves
      console.log(chalk.green(`  ✅ ${agent.name} — Auto-approved by Team Lead`));
      console.log(chalk.dim(`     ${review.comment.substring(0, 120)}...`));
    } else {
      // Agent requests revision, escalate to human
      console.log(chalk.yellow(`  ⚠️  Team Lead requested revision. Escalating to you.`));
      const humanResult = await humanApproval(agent.name, taskType, result, review.comment);
      if (humanResult.approved) {
        console.log(chalk.green(`  ✅ Overridden — Approved by you`));
      }
    }

    console.log('');
  }

  // Step 6: Sprint planning
  agentHeader('teamlead', 'Creating sprint plan...');
  const planSpinner = ora({ text: 'Planning sprints...', color: 'green' }).start();

  const allResults = Array.from(results.entries())
    .map(([id, r]) => `## ${allAgents[id].name} Result:\n${r}`)
    .join('\n\n');

  const sprintPlan = await askAgentToWork(
    allAgents.teamlead,
    `Based on all agent deliverables, create a detailed 4-sprint plan for building this GTD Lynx app. Include specific tasks, assignees, and acceptance criteria for each sprint.`,
    allResults
  );

  planSpinner.succeed('Sprint plan ready');
  printResult(sprintPlan);

  // Human approves sprint plan
  await humanApproval('Team Lead', 'sprint-plan', sprintPlan, 'Sprint plan for your review');

  console.log(
    boxen(
      chalk.green.bold('🎉 Orchestration Complete!') +
        '\n\n' +
        chalk.white('All agents delivered. Sprint plan approved.') +
        '\n' +
        chalk.dim('Run `npm run dev:app` to start building.'),
      { padding: 1, borderColor: 'green', borderStyle: 'round' }
    )
  );
}

main().catch((err) => {
  console.error(chalk.red('Orchestration failed:'), err);
  process.exit(1);
});
