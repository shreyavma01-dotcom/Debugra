export function parseGeminiResponse(text: string): { tool: string; args: any; reason?: string } | null {
  if (!text) return null;
  // try direct JSON
  try {
    const j = JSON.parse(text);
    if (j.tool || j.name) return { tool: j.tool || j.name, args: j.args || j.arguments || j.parameters || {}, reason: j.reason || j.summary };
  } catch {}
  // extract JSON code block
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try {
      const j = JSON.parse(match[1]);
      if (j.tool || j.name) return { tool: j.tool || j.name, args: j.args || j.arguments || {}, reason: j.reason };
    } catch {}
  }
  // try find { "tool": ... }
  const jsonMatch = text.match(/\{[\s\S]*"tool"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const j = JSON.parse(jsonMatch[0]);
      if (j.tool) return { tool: j.tool, args: j.args || {}, reason: j.reason };
    } catch {}
  }
  return null;
}
