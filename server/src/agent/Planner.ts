export interface PlanStep {
  thought: string;
  nextTool: string;
  priority: number;
}

export class Planner {
  private steps: PlanStep[] = [];
  plan(initial: boolean, context: any): PlanStep {
    if (initial) {
      return { thought: 'Start by exploring project structure and detecting type', nextTool: 'list_files', priority: 1 };
    }
    // dynamic planning based on heuristic
    if (context.lastTest?.failed > 0) {
      return { thought: `Tests failing (${context.lastTest.failed}), investigate and patch`, nextTool: 'search_code', priority: 2 };
    }
    return { thought: 'Verify final state', nextTool: 'run_tests', priority: 1 };
  }
}
