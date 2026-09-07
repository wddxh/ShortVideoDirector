// .opencode/tests/write-guard.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_STRING_ARG_LEN,
  findLargeStrings,
  interceptToolCall,
} from '../lib/write-guard.js';

describe('MAX_STRING_ARG_LEN', () => {
  test('is 2000', () => {
    assert.equal(MAX_STRING_ARG_LEN, 2000);
  });
});

describe('findLargeStrings', () => {
  test('returns empty array for small strings', () => {
    assert.deepEqual(findLargeStrings({a: 'small', b: 'tiny'}), []);
  });

  test('returns entry for single long string', () => {
    const result = findLargeStrings({content: 'x'.repeat(5000)});
    assert.equal(result.length, 1);
    assert.equal(result[0].path, 'content');
    assert.equal(result[0].length, 5000);
  });

  test('reports nested object path', () => {
    const result = findLargeStrings({nested: {deep: {value: 'x'.repeat(5000)}}});
    assert.equal(result.length, 1);
    assert.equal(result[0].path, 'nested.deep.value');
  });

  test('reports array index path', () => {
    const result = findLargeStrings({items: ['small', 'x'.repeat(5000)]});
    assert.equal(result.length, 1);
    assert.equal(result[0].path, 'items[1]');
  });

  test('returns multiple if multiple long strings', () => {
    const result = findLargeStrings({a: 'x'.repeat(5000), b: 'y'.repeat(5000)});
    assert.equal(result.length, 2);
  });

  test('handles null/undefined args gracefully', () => {
    assert.deepEqual(findLargeStrings(null), []);
    assert.deepEqual(findLargeStrings(undefined), []);
  });

  test('exactly at threshold (2000) does not trigger', () => {
    assert.deepEqual(findLargeStrings({content: 'x'.repeat(2000)}), []);
  });

  test('one over threshold (2001) triggers', () => {
    const result = findLargeStrings({content: 'x'.repeat(2001)});
    assert.equal(result.length, 1);
    assert.equal(result[0].length, 2001);
  });

  test('custom threshold parameter works', () => {
    assert.deepEqual(findLargeStrings({a: 'x'.repeat(100)}, 200), []);
    assert.equal(findLargeStrings({a: 'x'.repeat(300)}, 200).length, 1);
  });

  test('non-string values ignored (numbers, booleans, null)', () => {
    assert.deepEqual(findLargeStrings({n: 12345, b: true, x: null}), []);
  });
});

describe('interceptToolCall', () => {
  test('allows 2000 and rejects 2001 characters for every tool', () => {
    for (const tool of ['write', 'edit', 'task', 'apply_patch', 'bash', 'something_else']) {
      assert.doesNotThrow(() => interceptToolCall({tool}, {args: {x: 'x'.repeat(2000)}}));
      assert.throws(
        () => interceptToolCall({tool}, {args: {x: 'x'.repeat(2001)}}),
        /exceeding 2000 chars: x: 2001 chars/
      );
    }
  });

  test('does not throw on small args for any tool', () => {
    for (const tool of ['write', 'edit', 'task', 'apply_patch', 'bash', 'something_else']) {
      assert.doesNotThrow(() => interceptToolCall({tool}, {args: {x: 'small'}}));
    }
  });

  test('does not throw on missing args / null args', () => {
    assert.doesNotThrow(() => interceptToolCall({tool: 'write'}, {}));
    assert.doesNotThrow(() => interceptToolCall({tool: 'write'}, {args: null}));
    assert.doesNotThrow(() => interceptToolCall({tool: 'write'}, {args: undefined}));
  });

  test('throws on large content for write (regardless of file ext)', () => {
    assert.throws(
      () => interceptToolCall({tool: 'write'}, {args: {filePath: 'a.md', content: 'x'.repeat(5000)}}),
      /Tool 'write' has string argument\(s\) exceeding 2000 chars/
    );
    assert.throws(
      () => interceptToolCall({tool: 'write'}, {args: {filePath: 'data.json', content: 'x'.repeat(5000)}}),
      /exceeding 2000 chars/
    );
    assert.throws(
      () => interceptToolCall({tool: 'write'}, {args: {filePath: 'cfg.yaml', content: 'x'.repeat(5000)}}),
      /exceeding 2000 chars/
    );
  });

  test('throws on large newString for edit', () => {
    assert.throws(
      () => interceptToolCall({tool: 'edit'}, {args: {filePath: 'a.md', newString: 'x'.repeat(5000)}}),
      /Tool 'edit'.*newString: 5000 chars/
    );
  });

  test('throws on large prompt for task', () => {
    assert.throws(
      () => interceptToolCall({tool: 'task'}, {args: {prompt: 'x'.repeat(5000)}}),
      /Tool 'task'.*prompt: 5000 chars/
    );
  });

  test('throws on large patch for apply_patch', () => {
    assert.throws(
      () => interceptToolCall({tool: 'apply_patch'}, {args: {patch: 'x'.repeat(5000)}}),
      /Tool 'apply_patch'.*patch: 5000 chars/
    );
  });

  test('throws on large command for bash', () => {
    assert.throws(
      () => interceptToolCall({tool: 'bash'}, {args: {command: 'x'.repeat(5000)}}),
      /Tool 'bash'.*command: 5000 chars/
    );
  });

  test('error includes nested path', () => {
    assert.throws(
      () => interceptToolCall({tool: 'custom'}, {args: {nested: {deep: {value: 'x'.repeat(5000)}}}}),
      /nested\.deep\.value: 5000 chars/
    );
  });

  describe('tool-aware advice', () => {
    function getAdvice(tool, args) {
      try {
        interceptToolCall({tool}, {args});
        return null;
      } catch (e) {
        return e.message;
      }
    }

    test('write advice includes JSON arrays incremental pattern', () => {
      const msg = getAdvice('write', {filePath: 'a.md', content: 'x'.repeat(5000)});
      assert.match(msg, /First call with content/);
      assert.match(msg, /JSON arrays/);
    });

    test('apply_patch advice mirrors write advice', () => {
      const msg = getAdvice('apply_patch', {patch: 'x'.repeat(5000)});
      assert.match(msg, /Write\/apply_patch/);
    });

    test('edit advice includes split pattern', () => {
      const msg = getAdvice('edit', {newString: 'x'.repeat(5000)});
      assert.match(msg, /split into multiple Edit calls/);
    });

    test('task advice includes file handoff pattern', () => {
      const msg = getAdvice('task', {prompt: 'x'.repeat(5000)});
      assert.match(msg, /Write the data to a file|file path in task prompt/);
    });

    test('bash advice includes script file pattern', () => {
      const msg = getAdvice('bash', {command: 'x'.repeat(5000)});
      assert.match(msg, /store the command in a script file/);
    });

    test('unknown tool gets generic advice', () => {
      const msg = getAdvice('unknown_tool_xyz', {x: 'x'.repeat(5000)});
      assert.match(msg, /Split the long string/);
    });
  });
});
