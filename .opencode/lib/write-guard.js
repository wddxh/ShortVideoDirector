// .opencode/lib/write-guard.js
//
// OC plugin tool.execute.before hook backstop:
// 任何工具的字符串参数 > MAX_STRING_ARG_LEN 时拒绝执行 + throw 结构化错误
// 让 LLM 看到 advice 自然 retry（chunked operations）。
//
// 设计决策：
//   - 通用检查：deep walk args，覆盖所有 tool 的所有字符串字段（包括 apply_patch.patch / bash.command 等）
//   - 无文件类型例外：.json / .yaml 同样 4000 阈值（按 ENTRY_WORKFLOW_DISPATCH_DISCIPLINE 的 JSON 增量模式分段）
//   - throw error 不自动 chunk（chunk 会破坏 OC file state tracking）
// 详见 docs/superpowers/specs/2026-05-18-runtime-write-guard-design.md

export const MAX_STRING_ARG_LEN = 4000;

/**
 * 深度遍历 args，找出所有长度 > threshold 的字符串值。
 * @param {*} args - 任意值（对象、数组、字符串、null、undefined）
 * @param {number} [threshold=MAX_STRING_ARG_LEN]
 * @returns {Array<{path: string, length: number}>}
 */
export function findLargeStrings(args, threshold = MAX_STRING_ARG_LEN) {
  const results = [];
  const walk = (obj, path) => {
    if (typeof obj === 'string') {
      if (obj.length > threshold) results.push({ path, length: obj.length });
    } else if (Array.isArray(obj)) {
      obj.forEach((v, i) => walk(v, `${path}[${i}]`));
    } else if (obj && typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) {
        walk(v, path ? `${path}.${k}` : k);
      }
    }
  };
  walk(args, '');
  return results;
}

const ADVICE_WRITE = `For Write/apply_patch:
1. First call with content ≤${MAX_STRING_ARG_LEN} chars
2. Then Edit append for each subsequent chunk:
   - oldString = last 30-50 chars of prior chunk (must be unique in file)
   - newString = those chars + next chunk (≤${MAX_STRING_ARG_LEN})

For JSON arrays:
- Write '[\\n  <entry1>\\n]' first (single entry, small)
- Edit oldString='\\n]' newString=',\\n  <entryN>\\n]' for each subsequent entry`;

const ADVICE_EDIT = `For Edit: split into multiple Edit calls.
Each subsequent Edit's oldString = last 30-50 chars of previous newString.
Same JSON incremental pattern as Write applies.`;

const ADVICE_TASK = `For task: don't pass large data via prompt parameter.
1. Write the data to a file first (using incremental Write+Edit if >${MAX_STRING_ARG_LEN})
2. Pass only the file path in task prompt
3. Subagent reads via Read tool`;

const ADVICE_BASH = `For bash: store the command in a script file and invoke it.
Or split into multiple shorter commands.`;

const ADVICE_GENERIC = `Split the long string into multiple smaller operations (each ≤${MAX_STRING_ARG_LEN} chars).`;

function getAdvice(tool) {
  switch (tool) {
    case 'write':
    case 'apply_patch':
      return ADVICE_WRITE;
    case 'edit':
      return ADVICE_EDIT;
    case 'task':
      return ADVICE_TASK;
    case 'bash':
      return ADVICE_BASH;
    default:
      return ADVICE_GENERIC;
  }
}

/**
 * OC plugin hook 入口。在任何 tool 执行前调用。
 * @param {{tool: string}} input
 * @param {{args?: object}} output
 * @throws Error 若 args 含 > MAX_STRING_ARG_LEN 的字符串值
 */
export function interceptToolCall(input, output) {
  const longs = findLargeStrings(output?.args);
  if (longs.length === 0) return;
  const summary = longs
    .map(l => `${l.path || '<root>'}: ${l.length} chars`)
    .join(', ');
  throw new Error(
    `Tool '${input.tool}' has string argument(s) exceeding ${MAX_STRING_ARG_LEN} chars: ${summary}.\n\n${getAdvice(input.tool)}`
  );
}
