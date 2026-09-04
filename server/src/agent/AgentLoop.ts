import fs from 'fs';
import path from 'path';
import { AgentState } from './AgentState';
import { ToolRegistry } from '../tools/ToolRegistry';
import { createListFilesTool } from '../tools/listFiles';
import { createReadFileTool } from '../tools/readFile';
import { createSearchCodeTool } from '../tools/searchCode';
import { createReadLogsTool } from '../tools/readLogs';
import { createDetectProjectTool } from '../tools/detectProject';
import { createDetectTestsTool } from '../tools/detectTests';
import { createRunTestsTool } from '../tools/runTests';
import { createRunLinterTool } from '../tools/runLinter';
import { createRunCommandTool } from '../tools/runCommand';
import { createApplyPatchTool } from '../tools/applyPatch';
import { createGitDiffTool } from '../tools/gitDiff';
import { createRollbackTool } from '../tools/rollback';
import { Evaluator } from './Evaluator';
import { RecoveryManager } from './RecoveryManager';
import { eventBus } from '../events/EventBus';
import { geminiClient } from '../ai/GeminiClient';
import { sandboxManager, Sandbox } from '../sandbox/SandboxManager';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

export interface LoopOptions {
  runId: string;
  projectId: string;
  goal: string;
  workspacePath: string;
  projectPath: string;
  projectMeta: any;
  maxSteps: number;
  maxRetries: number;
  onStateChange?: (status: string, run: any)=>void;
}

export async function runAgentLoop(opts: LoopOptions, store: any) {
  const state = new AgentState('CREATED');
  const registry = new ToolRegistry();
  registry.register(createListFilesTool());
  registry.register(createReadFileTool());
  registry.register(createSearchCodeTool());
  registry.register(createReadLogsTool());
  registry.register(createDetectProjectTool());
  registry.register(createDetectTestsTool());
  registry.register(createRunTestsTool());
  registry.register(createRunLinterTool());
  registry.register(createRunCommandTool());
  registry.register(createApplyPatchTool());
  registry.register(createGitDiffTool());
  registry.register(createRollbackTool());

  const evaluator = new Evaluator();
  const recovery = new RecoveryManager(opts.maxRetries);

  let stepCount = 0;
  let attempt = 0;
  let replans = 0;
  let baselineResult: any = null;
  let finalResult: any = null;
  let changedFiles = new Set<string>();
  let previousActions: any[] = [];
  let testResults: any[] = [];
  let recentToolOutputs: any[] = [];
  let recentLogs: any[] = [];
  let sandbox: Sandbox | null = null;

  const updateStore = async (patch: any) => {
    if (store && store.updateRun) await store.updateRun(opts.runId, patch);
    if (opts.onStateChange) opts.onStateChange(patch.status || state.get(), patch);
  };

  const emit = (type: string, data:any={}) => eventBus.emitRunEvent(opts.runId, type, data);

  try {
    state.transition('INITIALIZING');
    await updateStore({ status: state.get(), stepCount, attempts: attempt, replans });
    emit('agent.started', { summary: 'Agent initializing' });

    // create sandbox
    sandbox = await sandboxManager.create(opts.workspacePath, opts.projectPath, opts.runId);
    emit('sandbox.created', { summary: sandbox.useDocker ? 'Docker sandbox created' : 'Local sandbox created (Docker unavailable)' });

    state.transition('ANALYZING');
    await updateStore({ status: state.get() });
    emit('project.detected', { summary: `Detected ${opts.projectMeta.framework} (${opts.projectMeta.packageManager})`, meta: opts.projectMeta });

    // Try npm install if node project and node_modules missing
    if (opts.projectMeta.framework.includes('node')) {
      const nmExists = fs.existsSync(path.join(opts.projectPath, 'node_modules'));
      if (!nmExists) {
        emit('tool.started', { summary: 'Installing dependencies (npm install)' });
        const installRes = await sandboxManager.exec(sandbox!, 'npm install --silent', 120000);
        emit('tool.completed', { summary: `npm install exit ${installRes.exitCode}`, output: installRes.stdout.slice(0,2000) });
        if (installRes.exitCode!==0) {
          // try with --legacy-peer-deps?
        }
      }
    }

    // baseline tests
    state.force('TESTING');
    await updateStore({ status: state.get() });
    emit('test.started', { summary: 'Running baseline tests' });
    const baselineTool = registry.get('run_tests')!;
    const baselineCtx = { projectPath: opts.projectPath, workspacePath: opts.workspacePath, sandbox, projectMeta: opts.projectMeta, runId: opts.runId, attempt, testResults, recentLogs, changedFiles };
    const baselineExec = await baselineTool.execute({}, baselineCtx);
    // baselineExec contains output.testResult
    const br = baselineExec.output?.testResult || null;
    baselineResult = br;
    if (br) testResults.push(br);
    finalResult = br;
    emit('test.completed', { summary: br ? `${br.passed}/${br.total} passed, ${br.failed} failed` : 'Baseline tests unavailable', testResult: br });
    await updateStore({ baselineResult: br, status: state.get() });

    state.force('EXECUTING');
    await updateStore({ status: state.get() });

    // prepare context for loop
    const ctxBase: any = {
      projectPath: opts.projectPath,
      workspacePath: opts.workspacePath,
      sandbox,
      projectMeta: opts.projectMeta,
      runId: opts.runId,
      changedFiles,
      testResults,
      recentLogs,
    };

    let consecutiveFailures = 0;
    let lastTool = '';

    while (stepCount < opts.maxSteps) {
      stepCount++;
      await updateStore({ stepCount, attempts: attempt, replans });

      if (['EXECUTING','EVALUATING','REPLANNING','ANALYZING','TESTING'].includes(state.get())) {
        // build context for Gemini
        const agentCtx = {
          goal: opts.goal,
          projectMeta: opts.projectMeta,
          workspacePath: opts.workspacePath,
          projectPath: opts.projectPath,
          previousActions,
          testResults,
          changedFiles,
          attempt,
          replanCount: replans,
          recentToolOutputs,
          recentLogs
        };

        // decide next action
        let decision = await geminiClient.getNextAction(agentCtx);
        if (!decision) {
          emit('agent.failed', { summary: 'Agent could not decide next action' });
          break;
        }

        // avoid infinite loop of same tool
        if (decision.tool === lastTool) consecutiveFailures++;
        else consecutiveFailures = 0;
        lastTool = decision.tool;

        // if repeated same tool 3 times, force replan
        if (consecutiveFailures >= 3) {
          state.transition('REPLANNING');
          replans++;
          emit('agent.replanning', { summary: `Replanning after repeated ${decision.tool} calls`, attempt, replans });
          await updateStore({ status: state.get(), replans });
          consecutiveFailures = 0;
          // force different tool: if stuck on read, try search
          if (decision.tool === 'read_file') decision = { tool: 'search_code', args: { query: 'auth' }, reason: 'Replan: search instead' };
        }

        emit('tool.started', { summary: `${decision.tool} — ${decision.reason||''}`, tool: decision.tool });
        await updateStore({ status: 'EXECUTING' });
        state.force('EXECUTING');

        // execute tool
        const toolDef = registry.get(decision.tool);
        if (!toolDef) {
          const msg = `Unknown tool ${decision.tool}`;
          emit('tool.completed', { summary: msg, tool: decision.tool, status: 'FAILED' });
          previousActions.push({ runId: opts.runId, step: stepCount, tool: decision.tool, summary: decision.reason||'', status: 'FAILED', output: { error: msg } });
          continue;
        }

        const execCtx = { ...ctxBase, attempt, runId: opts.runId, recentLogs, testResults, changedFiles, recentToolOutputs };
        // also inject previous outputs for patch heuristics
        const start = Date.now();
        let result: any;
        try {
          result = await registry.execute(decision.tool, decision.args, execCtx);
        } catch (e:any) {
          result = { success: false, tool: decision.tool, error: e.message, summary: e.message, duration: Date.now()-start };
        }
        const duration = result.duration || (Date.now()-start);

        // track outputs
        if (result.output) recentToolOutputs.push(result.output);
        if (recentToolOutputs.length>10) recentToolOutputs.shift();

        // record action
        const action = {
          runId: opts.runId,
          step: stepCount,
          type: decision.tool,
          tool: decision.tool,
          summary: decision.reason || result.summary || `${decision.tool} completed`,
          status: result.success ? 'SUCCESS' : 'FAILED',
          duration,
          input: decision.args,
          output: result.output || result.error,
          timestamp: new Date().toISOString()
        };
        previousActions.push(action);
        if (store && store.addAction) await store.addAction(action);
        emit('tool.completed', { summary: result.summary || action.summary, tool: decision.tool, output: result.output, status: action.status });

        // handle patch applied event
        if (decision.tool === 'apply_patch' && result.success) {
          attempt++;
          await updateStore({ attempts: attempt });
          emit('patch.applied', { summary: `Patch applied to ${decision.args.file}`, file: decision.args.file });
          // after patch, automatically run tests next iteration? But let agent decide; we can do incremental test check
          // continue to evaluation
          state.force('EVALUATING');
        }

        // handle run_tests
        if (decision.tool === 'run_tests' && result.success) {
          const tr = result.output?.testResult;
          if (tr) {
            finalResult = tr;
            await updateStore({ finalResult: tr });
            emit('test.completed', { summary: `${tr.passed}/${tr.total} passed`, testResult: tr });
            // evaluate
            state.force('EVALUATING');
            const evalRes = evaluator.evaluateGoal(baselineResult, tr, opts.goal);
            if (evalRes.verified) {
              state.transition('VERIFYING');
              emit('verification.started', { summary: 'Verifying final result' });
              // regression: run tests again? or linter? For now check git diff and ensure no extra failures
              // Do final verification: run tests one more time and check build if available
              let verifyPassed = true;
              let verifyReason = evalRes.reason;
              // Check build command if exists
              if (opts.projectMeta.buildCommand) {
                const buildRes = await sandboxManager.exec(sandbox!, opts.projectMeta.buildCommand, 60000);
                if (buildRes.exitCode!==0) { verifyPassed = false; verifyReason = 'Build failed'; }
                emit('tool.completed', { summary: `Build verification exit ${buildRes.exitCode}`, tool: 'run_command' });
              }
              if (verifyPassed) {
                state.transition('VERIFIED');
                await updateStore({ status: state.get(), finalResult: tr, completedAt: new Date().toISOString() });
                emit('agent.completed', { summary: `Verified: ${verifyReason}`, verified: true });
                break;
              } else {
                state.force('EVALUATING');
                // treat as not verified
              }
            } else {
              // not verified, need replanning
              recovery.recordFailure();
              if (!recovery.canRetry() && attempt >= opts.maxRetries) {
                state.force('FAILED');
                await updateStore({ status: state.get(), finalResult: tr, error: evalRes.reason });
                emit('agent.failed', { summary: `Failed: ${evalRes.reason}`, reason: evalRes.reason });
                break;
              }
              // decide to replan
              state.force('REPLANNING');
              replans++;
              emit('agent.replanning', { summary: `Replanning: ${evalRes.reason}`, reason: evalRes.reason, replans });
              await updateStore({ status: state.get(), replans, attempts: attempt });
              // if same failure repeated, maybe rollback?
              consecutiveFailures++;
            }
          }
        }

        // if tool failed, record
        if (!result.success) {
          recovery.recordFailure();
        }

        // check if we have succeeded without run_tests? check if all tests now pass from previous
        // Also evaluate if we haven't run tests in last 3 steps but have patched, we should force test run next loop will handle via heuristic

        // check step limit
        if (stepCount >= opts.maxSteps) {
          state.force('TIMEOUT');
          await updateStore({ status: state.get(), error: 'Max steps reached' });
          emit('agent.failed', { summary: 'Maximum agent steps reached' });
          break;
        }

        // transition back to EXECUTING for next loop
        if (state.get() === 'EVALUATING' || state.get() === 'REPLANNING') {
          // keep as is for next decision but planner will handle
          state.force('EXECUTING');
        }

        // small delay to avoid spinning
        await new Promise(r=>setTimeout(r, 300));
      }
    }

    // final evaluation if not yet verified/failed
    if (!['VERIFIED','FAILED','TIMEOUT','STOPPED'].includes(state.get())) {
      if (finalResult && finalResult.failed===0) {
        state.force('VERIFIED');
        await updateStore({ status: state.get(), completedAt: new Date().toISOString() });
        emit('agent.completed', { summary: 'Agent verified (fallback check)' });
      } else {
        state.force('FAILED');
        await updateStore({ status: state.get(), completedAt: new Date().toISOString(), error: 'Agent did not verify goal within step limit', finalResult });
        emit('agent.failed', { summary: 'Agent stopped without verification' });
      }
    }

    // capture diff
    try {
      const { stdout } = await execAsync('git diff HEAD', { cwd: opts.projectPath, maxBuffer: 1024*1024 });
      await updateStore({ diff: stdout.slice(0,50000) });
      const cf = await execAsync('git diff --name-only HEAD', { cwd: opts.projectPath });
      const files = cf.stdout.split('\n').filter(Boolean);
      await updateStore({ changedFiles: files });
    } catch {}

    // cleanup sandbox container but keep workspace for download
    await sandboxManager.cleanup(sandbox!);

    return { status: state.get(), baselineResult, finalResult, stepCount, attempts: attempt, replans };

  } catch (e:any) {
    console.error('Agent loop error', e);
    state.force('FAILED');
    await updateStore({ status: state.get(), error: e.message, completedAt: new Date().toISOString() });
    emit('agent.failed', { summary: `Agent error: ${e.message}` });
    if (sandbox) await sandboxManager.cleanup(sandbox);
    return { status: 'FAILED', error: e.message };
  }
}
