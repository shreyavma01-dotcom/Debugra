import { TestResult } from '../models/AgentRun';

export interface Evaluation {
  verified: boolean;
  reason: string;
  level: 'tool'|'goal';
}

export class Evaluator {
  evaluateToolResult(result: any): Evaluation {
    if (!result.success) return { verified: false, reason: `Tool failed: ${result.error}`, level: 'tool' };
    if (result.tool === 'run_tests') {
      const tr: TestResult = result.output?.testResult;
      if (!tr) return { verified: false, reason: 'No test result', level: 'tool' };
      if (tr.failed > 0) return { verified: false, reason: `${tr.failed} tests failed`, level: 'tool' };
      return { verified: true, reason: `All ${tr.passed} tests passed`, level: 'tool' };
    }
    return { verified: true, reason: 'Tool succeeded', level: 'tool' };
  }

  evaluateGoal(baseline: TestResult | null | undefined, finalResult: TestResult | null | undefined, goal: string): Evaluation {
    if (!finalResult) return { verified: false, reason: 'No final test result', level: 'goal' };
    if (finalResult.failed > 0) return { verified: false, reason: `${finalResult.failed}/${finalResult.total} tests still failing`, level: 'goal' };
    if (finalResult.exitCode !== 0) return { verified: false, reason: `Tests exit code ${finalResult.exitCode}`, level: 'goal' };
    // if baseline had failures and now passes, success
    if (baseline && finalResult.passed > baseline.passed) {
      return { verified: true, reason: `Improved from ${baseline.passed}/${baseline.total} to ${finalResult.passed}/${finalResult.total}`, level: 'goal' };
    }
    if (finalResult.failed===0) return { verified: true, reason: `All ${finalResult.passed}/${finalResult.total} tests passed`, level: 'goal' };
    return { verified: false, reason: 'Goal not verified', level: 'goal' };
  }
}
