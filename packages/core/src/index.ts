import 'dotenv/config';
import chalk from 'chalk';
import ora from 'ora';
import { runPlanner } from './agents/planner.js';
import { runExecutor, ExecutorOutput } from './agents/executor.js';
import { runConsolidator } from './agents/consolidator.js';
import { ExpirationTime } from '@arkiv-network/sdk/utils';
import { TTL } from './constants.js';
import { createProvider, type ProviderName } from './llm.js';

const args = process.argv.slice(2);
const mockMode = args.includes('--mock');

// --provider anthropic | --provider openai  (default: auto-detect from env)
const providerFlagIdx = args.indexOf('--provider');
const providerArg =
  providerFlagIdx !== -1
    ? (args[providerFlagIdx + 1] as ProviderName | 'auto')
    : 'auto';

const filteredArgs = args.filter(
  (a, i) => a !== '--mock' && a !== '--provider' && args[providerFlagIdx] !== '--provider'
    ? true
    : i !== providerFlagIdx && i !== providerFlagIdx + 1,
);
const question = filteredArgs.join(' ') ||
  'What are the critical challenges and opportunities facing decentralized AI infrastructure in 2026?';

function shortKey(key: string): string {
  return `${key.slice(0, 8)}...${key.slice(-6)}`;
}

function formatTTL(seconds: number): string {
  if (seconds >= 86400) return `${Math.round(seconds / 86400)}d`;
  if (seconds >= 3600) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 60)}min`;
}

function printBanner(providerName?: string, modelName?: string) {
  console.log(chalk.bold.cyan('\n╔══════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║') + chalk.bold.white('        HoloMem: Cryptographic Memory Mesh') + chalk.bold.cyan('               ║'));
  console.log(chalk.bold.cyan('║') + chalk.gray('        Multi-Agent Research Swarm on Arkiv Braga') + chalk.bold.cyan('        ║'));
  console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════════════════╝\n'));

  if (mockMode) {
    console.log(chalk.yellow('  ⚡ Running in MOCK mode (no Arkiv writes, no LLM calls)\n'));
  } else if (providerName && modelName) {
    const providerColor = providerName === 'openai' ? chalk.bold.green : chalk.bold.magenta;
    console.log(
      chalk.gray('  LLM Provider: ') +
      providerColor(providerName.toUpperCase()) +
      chalk.gray('  model: ') +
      chalk.white(modelName) + '\n',
    );
  }
  console.log(chalk.bold('  Research Question:'));
  console.log(chalk.white(`  "${question}"\n`));
  console.log(chalk.gray('  ─'.repeat(64)));
}

function printMemoryGraph(
  planKey: string,
  executorOutputs: ExecutorOutput[],
  finalKey: string,
  sessionId: string,
) {
  const wMemTTL = formatTTL(ExpirationTime.fromMinutes(TTL.WORKING_MEMORY_MINUTES));
  const episodicTTL = formatTTL(ExpirationTime.fromHours(TTL.EPISODIC_HOURS));
  const persistentTTL = formatTTL(ExpirationTime.fromDays(TTL.PERSISTENT_DAYS));

  console.log(chalk.bold.cyan('\n  Memory Graph') + chalk.gray(` (session: ${sessionId})`));
  console.log(chalk.gray('  ' + '═'.repeat(60)));

  console.log(
    chalk.yellow('  MemoryNode') + chalk.gray(' [plan]  ') +
    chalk.white(shortKey(planKey)) +
    chalk.gray(`  ⏱ ${wMemTTL} TTL  🔒 encrypted`)
  );

  for (const out of executorOutputs) {
    const isLast = out === executorOutputs[executorOutputs.length - 1];
    const connector = isLast && !finalKey ? '└──' : '├──';
    console.log(chalk.gray(`  ${connector} `) + chalk.cyan('RelationshipEdge') + chalk.gray(' [reasoning-step]'));
    console.log(
      chalk.gray(`  │   └── `) +
      chalk.green('MemoryNode') + chalk.gray(' [result-') + chalk.white(`${out.agentIndex + 1}`) + chalk.gray(']  ') +
      chalk.white(shortKey(out.resultEntityKey)) +
      chalk.gray(`  ⏱ ${episodicTTL} TTL  🔒 encrypted`)
    );
    console.log(chalk.gray(`  │       ${chalk.italic.gray('"' + out.preview.slice(0, 55) + '..."')}`));
  }

  if (finalKey) {
    console.log(chalk.gray(`  └── `) + chalk.cyan('RelationshipEdge') + chalk.gray(' [task-delegation]'));
    console.log(
      chalk.gray(`      └── `) +
      chalk.magenta('MemoryNode') + chalk.gray(' [final]  ') +
      chalk.white(shortKey(finalKey)) +
      chalk.gray(`  ⏱ ${persistentTTL} TTL  🔒 encrypted`)
    );
  }

  console.log(chalk.gray('  ' + '═'.repeat(60)));
  console.log(chalk.gray(`  Explorer: ${chalk.underline('https://explorer.braga.hoodi.arkiv.network')}`));
}

async function main() {
  // ── Initialise LLM provider ─────────────────────────────────────
  let llm: import('./llm.js').LLMProvider | undefined;
  if (!mockMode) {
    try {
      llm = createProvider(providerArg);
    } catch (err: any) {
      console.error(chalk.red('\n  ✗ LLM provider error: ') + err.message);
      console.error(chalk.gray('    Run with --mock to test without an API key.\n'));
      process.exit(1);
    }
  }

  printBanner(llm?.name, llm?.model);

  // ── Step 1: Planner ─────────────────────────────────────────────
  const plannerSpinner = ora({
    text: chalk.bold('Planner Agent') + chalk.gray(' initializing research session...'),
    color: 'cyan',
  }).start();

  let plannerResult;
  try {
    plannerResult = await runPlanner(question, mockMode, llm);
    plannerSpinner.succeed(
      chalk.bold.green('✓ Plan written to Arkiv') +
      chalk.gray('  entityKey: ') + chalk.white(shortKey(plannerResult.planEntityKey)) +
      chalk.gray('  txHash: ') + chalk.white(shortKey(plannerResult.txHash)) +
      chalk.gray(`  TTL: ${formatTTL(ExpirationTime.fromMinutes(TTL.WORKING_MEMORY_MINUTES))}`)
    );
  } catch (err: any) {
    plannerSpinner.fail(chalk.red('Planner failed: ') + err.message);
    process.exit(1);
  }

  console.log(chalk.gray('\n  Research plan:'));
  for (const step of plannerResult.steps) {
    console.log(chalk.gray(`    ${step.index + 1}. `) + chalk.white(step.title));
    console.log(chalk.gray(`       ${step.instruction.slice(0, 80)}...`));
  }
  console.log();

  // ── Step 2: Executors (sequential for nonce safety) ─────────────
  const executorOutputs: ExecutorOutput[] = [];

  for (const step of plannerResult.steps) {
    const spinner = ora({
      text: chalk.bold(`Executor #${step.index + 1}`) + chalk.gray(` researching "${step.title}"...`),
      color: 'green',
    }).start();

    try {
      const output = await runExecutor(
        plannerResult.sessionId,
        plannerResult.planEntityKey,
        step,
        mockMode,
        llm,
      );
      executorOutputs.push(output);
      spinner.succeed(
        chalk.bold.green(`✓ Executor #${step.index + 1}`) + chalk.gray(' result written  ') +
        chalk.gray('entityKey: ') + chalk.white(shortKey(output.resultEntityKey)) +
        chalk.gray('  edge: ') + chalk.white(shortKey(output.edgeEntityKey))
      );
    } catch (err: any) {
      spinner.fail(chalk.red(`Executor #${step.index + 1} failed: `) + err.message);
      process.exit(1);
    }
  }

  // ── Step 3: Consolidator ────────────────────────────────────────
  console.log();
  const consolidatorSpinner = ora({
    text: chalk.bold('Consolidator Agent') + chalk.gray(` synthesizing ${executorOutputs.length} research threads...`),
    color: 'magenta',
  }).start();

  let consolidatorResult;
  try {
    consolidatorResult = await runConsolidator(
      plannerResult.sessionId,
      plannerResult.planEntityKey,
      executorOutputs.map((o) => o.resultEntityKey),
      mockMode,
      llm,
    );
    consolidatorSpinner.succeed(
      chalk.bold.green('✓ Final report written') +
      chalk.gray('  entityKey: ') + chalk.white(shortKey(consolidatorResult.finalEntityKey)) +
      chalk.gray('  TTL: ') + chalk.white(formatTTL(ExpirationTime.fromDays(TTL.PERSISTENT_DAYS)))
    );
  } catch (err: any) {
    consolidatorSpinner.fail(chalk.red('Consolidator failed: ') + err.message);
    process.exit(1);
  }

  // ── Memory Graph ─────────────────────────────────────────────────
  printMemoryGraph(
    plannerResult.planEntityKey,
    executorOutputs,
    consolidatorResult.finalEntityKey,
    plannerResult.sessionId,
  );

  // ── Final Report ─────────────────────────────────────────────────
  console.log(chalk.bold.cyan('\n  ══ FINAL RESEARCH REPORT (decrypted) ══\n'));
  console.log(consolidatorResult.report.split('\n').map((l) => '  ' + l).join('\n'));
  console.log(chalk.bold.cyan('\n  ════════════════════════════════════════\n'));

  // ── Transaction Log ──────────────────────────────────────────────
  console.log(chalk.gray('  On-chain audit trail:'));
  console.log(chalk.gray(`    Plan    txHash: ${plannerResult.txHash}`));
  for (const out of executorOutputs) {
    console.log(chalk.gray(`    Exec-${out.agentIndex + 1} txHash: ${out.txHash}`));
  }
  console.log(chalk.gray(`    Final   txHash: ${consolidatorResult.txHash}`));
  console.log();
}

main().catch((err) => {
  console.error(chalk.red('\nFatal error:'), err.message);
  process.exit(1);
});
