export class GoalManager {
  private goal: string;
  constructor(goal: string) { this.goal = goal; }
  getGoal() { return this.goal; }
  // simple goal parsing: extract test keywords
  getTargetKeywords(): string[] {
    const lower = this.goal.toLowerCase();
    const keywords: string[] = [];
    if (lower.includes('auth')) keywords.push('auth','authentication','authorization','jwt','token','login');
    if (lower.includes('task')) keywords.push('task');
    if (lower.includes('test')) keywords.push('test');
    return keywords;
  }
  isAuthGoal(): boolean { return this.goal.toLowerCase().includes('auth'); }
}
