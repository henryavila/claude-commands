/**
 * Minimal YAML parser for the simple structures used in skills.yaml and module.yaml.
 * Supports: string values, nested objects (multiple levels), multiline strings (|).
 * Does NOT support: arrays, inline comments, anchors, tags, flow style.
 */
export function parse(input) {
  const lines = input.split('\n');
  const result = {};
  const stack = [{ obj: result, indent: -1 }];
  let multilineKey = null;
  let multilineIndent = 0;
  let multilineValue = '';
  let multilineTarget = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle multiline string continuation
    if (multilineKey !== null) {
      const lineIndent = line.search(/\S/);
      if ((lineIndent >= multilineIndent || line.trim() === '') && i < lines.length - 1 ? true : lineIndent >= multilineIndent && line.trim() !== '') {
        if (line.trim() === '' && lineIndent < multilineIndent) {
          // Empty line that might end the block
          // Look ahead to see if next non-empty line is at lower indent
          let nextNonEmpty = i + 1;
          while (nextNonEmpty < lines.length && lines[nextNonEmpty].trim() === '') nextNonEmpty++;
          if (nextNonEmpty >= lines.length || lines[nextNonEmpty].search(/\S/) < multilineIndent) {
            multilineTarget[multilineKey] = multilineValue.trimEnd();
            multilineKey = null;
            continue;
          }
        }
        multilineValue += (line.trim() === '' ? '' : line.slice(multilineIndent)) + '\n';
        continue;
      } else {
        multilineTarget[multilineKey] = multilineValue.trimEnd();
        multilineKey = null;
      }
    }

    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const indent = line.search(/\S/);
    const match = trimmed.match(/^([\w][\w.-]*)\s*:\s*(.*)/);
    if (!match) continue;

    const [, key, rawValue] = match;

    // Pop stack to correct nesting level
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const value = rawValue.trim();

    if (value === '' || value === '|') {
      if (value === '|') {
        multilineKey = key;
        multilineIndent = indent + 2;
        multilineValue = '';
        multilineTarget = stack[stack.length - 1].obj;
      } else {
        const newObj = {};
        stack[stack.length - 1].obj[key] = newObj;
        stack.push({ obj: newObj, indent });
      }
    } else {
      const cleaned = value.replace(/^['"]|['"]$/g, '');
      stack[stack.length - 1].obj[key] = cleaned;
    }
  }

  // Flush any remaining multiline
  if (multilineKey !== null) {
    multilineTarget[multilineKey] = multilineValue.trimEnd();
  }

  return result;
}
