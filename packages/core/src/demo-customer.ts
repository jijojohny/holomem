/**
 * HoloMem customer demo — OpenAI research agent
 *
 * Shows the full customer journey:
 *   1. Planner   — GPT-4o-mini breaks the question into sub-tasks, writes plan to HoloMem
 *   2. Executors — Three agents research in parallel, each write findings to HoloMem
 *   3. Consolidator — Recalls all memories, synthesises a final report, writes it as persistent
 *
 * Run:
 *   npm run demo:customer -w packages/core
 *
 * Env required (.env):
 *   HOLOMEM_API_KEY=hm_live_xxx
 *   OPENAI_API_KEY=sk-...
 */

import 'dotenv/config';
import OpenAI from 'openai';
import { HoloMem } from '@holomem/sdk';
import chalk from 'chalk';
import ora from 'ora';

// ─── Config ───────────────────────────────────────────────────────────────────

const QUESTION =
  process.argv[2] ||
  'What are the biggest opportunities for AI agents in enterprise software in 2026?';

const SESSION_ID = `demo-${Date.now()}`;
const ENCRYPTION_KEY_PATH = '.holomem-key';

// ─── Clients ──────────────────────────────────────────────────────────────────

if (!process.env.HOLOMEM_API_KEY) throw new Error('HOLOMEM_API_KEY is not set in .env');
if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set in .env');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const mem = (() => {
  try {
    return HoloMem.loadKey(ENCRYPTION_KEY_PATH, { apiKey: process.env.HOLOMEM_API_KEY! });
  } catch {
    const instance = new HoloMem({ apiKey: process.env.HOLOMEM_API_KEY! });
    instance.saveKey(ENCRYPTION_KEY_PATH);
    return instance;
  }
})();

// ─── LLM helper ───────────────────────────────────────────────────────────────

async function chat(system: string, user: string, maxTokens = 1024): Promise<string> {
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? '';
}

// ─── Agents ───────────────────────────────────────────────────────────────────

interface SubTask {
  title: string;
  question: string;
}

async function plannerAgent(question: string): Promise<{ tasks: SubTask[]; planKey: string }> {
  const raw = await chat(
    'You are a research planner. Return ONLY a valid JSON array, no markdown, no extra text.',
    `Break this question into exactly 3 focused sub-questions:
"${question}"

Format:
[
  {"title": "Short title", "question": "Full sub-question to research"},
  {"title": "Short title", "question": "Full sub-question to research"},
  {"title": "Short title", "question": "Full sub-question to research"}
]`,
  );

  const tasks: SubTask[] = JSON.parse(raw);

  const planKey = await mem.write(
    SESSION_ID,
    `Research plan for: "${question}"\n\n${tasks.map((t, i) => `${i + 1}. ${t.title}: ${t.question}`).join('\n')}`,
    { agentId: 'planner', ttl: 'working' },
  );

  return { tasks, planKey };
}

async function executorAgent(task: SubTask, index: number): Promise<string> {
  const finding = await chat(
    'You are a research analyst. Write a thorough 2-3 paragraph answer. Be specific with examples.',
    task.question,
    1024,
  );

  const entityKey = await mem.write(
    SESSION_ID,
    `[${task.title}]\n\n${finding}`,
    { agentId: `executor-${index + 1}`, ttl: 'episodic' },
  );

  return entityKey;
}

async function consolidatorAgent(question: string): Promise<{ report: string; reportKey: string }> {
  const memories = await mem.recall(SESSION_ID, { limit: 50 });

  const context = memories
    .map((m) => `--- ${m.agentId} ---\n${m.plaintext}`)
    .join('\n\n');

  const report = await chat(
    `You are a senior research analyst. Synthesise the provided research into a structured report.
Use this format:
## Executive Summary
(2-3 sentences)

## Key Findings
(3-5 bullet points)

## Conclusion
(1 paragraph)`,
    `Original question: "${question}"\n\nResearch from agents:\n\n${context}`,
    2048,
  );

  const reportKey = await mem.write(
    SESSION_ID,
    `FINAL REPORT\n\nQuestion: ${question}\n\n${report}`,
    { agentId: 'consolidator', ttl: 'persistent' },
  );

  return { report, reportKey };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(chalk.bold.cyan('\n╔══════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║') + chalk.bold.white('   HoloMem × OpenAI — Research Agent Demo') + chalk.bold.cyan('    ║'));
  console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════╝'));
  console.log(chalk.gray('\n  Model:   ') + chalk.white('gpt-4o-mini'));
  console.log(chalk.gray('  Memory:  ') + chalk.white('HoloMem (encrypted, on-chain)'));
  console.log(chalk.gray('  Session: ') + chalk.white(SESSION_ID));
  console.log(chalk.gray('\n  Question: ') + chalk.italic.white(`"${QUESTION}"\n`));

  // 1. Planner
  const plannerSpinner = ora({ text: chalk.bold('Planner') + chalk.gray(' breaking down question...'), color: 'cyan' }).start();
  const { tasks, planKey } = await plannerAgent(QUESTION);
  plannerSpinner.succeed(
    chalk.bold.green('Planner') +
    chalk.gray('  plan written → ') + chalk.white(planKey.slice(0, 14) + '...') +
    chalk.gray('  TTL: 15min'),
  );

  for (const [i, t] of tasks.entries()) {
    console.log(chalk.gray(`    ${i + 1}. `) + chalk.white(t.title));
  }

  // 2. Executors (parallel)
  console.log();
  const executorSpinners = tasks.map((t, i) =>
    ora({ text: chalk.bold(`Executor ${i + 1}`) + chalk.gray(` → "${t.title}"...`), color: 'green' }).start(),
  );

  const entityKeys = await Promise.all(
    tasks.map(async (task, i) => {
      const key = await executorAgent(task, i);
      executorSpinners[i].succeed(
        chalk.bold.green(`Executor ${i + 1}`) +
        chalk.gray('  finding written → ') + chalk.white(key.slice(0, 14) + '...') +
        chalk.gray('  TTL: 1h'),
      );
      return key;
    }),
  );

  // 3. Consolidator
  console.log();
  const consolidatorSpinner = ora({
    text: chalk.bold('Consolidator') + chalk.gray(` recalling ${entityKeys.length + 1} memories and synthesising...`),
    color: 'magenta',
  }).start();

  const { report, reportKey } = await consolidatorAgent(QUESTION);
  consolidatorSpinner.succeed(
    chalk.bold.green('Consolidator') +
    chalk.gray('  report written → ') + chalk.white(reportKey.slice(0, 14) + '...') +
    chalk.gray('  TTL: 30 days'),
  );

  // 4. Print report
  console.log(chalk.bold.cyan('\n══ FINAL REPORT ══════════════════════════════════\n'));
  console.log(report.split('\n').map((l) => '  ' + l).join('\n'));
  console.log(chalk.bold.cyan('\n══════════════════════════════════════════════════'));

  // 5. Usage + dashboard link
  const usage = await mem.usage();
  console.log(chalk.gray(`\n  Active memories : `) + chalk.white(String(usage.memories.active)));
  console.log(chalk.gray(`  Writes used     : `) + chalk.white(String(usage.writes.used)));
  console.log(
    chalk.gray('\n  View memory graph → ') +
    chalk.underline.cyan(`https://holomem-dashboard.vercel.app/sessions/${SESSION_ID}\n`),
  );
}

main().catch((err) => {
  console.error(chalk.red('\nError: ') + err.message);
  process.exit(1);
});
