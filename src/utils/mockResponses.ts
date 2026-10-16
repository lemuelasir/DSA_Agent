import type { AssistantMode, AssistanceLevel } from '../types/assistant'

export function generateMockResponse(
  prompt: string,
  mode: AssistantMode,
  level: AssistanceLevel
): string {
  // 1. Hint Mode Responses
  if (mode === 'hint') {
    if (level === 1) {
      return `[DEV MOCK • Level 1 Hint]
🐾 Look closely at the data structure you are using.
Could an auxiliary data structure (like a Hash Table) trade a little memory space to avoid an O(N²) nested loop?`
    }
    if (level === 2) {
      return `[DEV MOCK • Level 2 Mistake Analysis]
🐾 Notice how your current approach re-scans the array on every iteration.
The bottleneck is searching for the complement element. If you store elements you have already seen in a Map, you can look them up in O(1) time!`
    }
    if (level === 3) {
      return `[DEV MOCK • Level 3 Guided Fix]
🐾 Here is the game plan:
1. Initialize an empty hash map \`seen = {}\`.
2. Iterate through the array with index \`i\` and value \`num\`.
3. Calculate \`complement = target - num\`.
4. If \`complement\` is in \`seen\`, return \`[seen[complement], i]\`.
5. Otherwise, record \`seen[num] = i\` and continue.`
    }
    return `[DEV MOCK • Level 4 Full Solution]
🐾 Here is the optimal One-Pass Hash Map approach:

\`\`\`typescript
function twoSum(nums: number[], target: number): number[] {
  const seen = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) {
      return [seen.get(complement)!, i];
    }
    seen.set(nums[i], i);
  }
  return [];
}
\`\`\`
• **Time Complexity:** O(N) — Single pass over the array.
• **Space Complexity:** O(N) — At most N entries stored in the map.`
  }

  // 2. Debug Mode Responses
  if (mode === 'debug') {
    if (level === 1) {
      return `[DEV MOCK • Level 1 Hint]
🐾 Look at your loop boundary condition. Are you sure \`while (left < right)\` or \`while (left <= right)\` handles single-element arrays correctly?`
    }
    if (level === 2) {
      return `[DEV MOCK • Level 2 Mistake Analysis]
🐾 Detected potential **Off-By-One / Infinite Loop** error!
When \`target\` is at the exact rightmost boundary, using \`mid = (left + right) / 2\` without integer rounding or setting \`left = mid\` (instead of \`mid + 1\`) can cause \`left\` and \`right\` to never converge!`
    }
    if (level === 3) {
      return `[DEV MOCK • Level 3 Guided Fix]
🐾 To fix the infinite loop in your Binary Search:
1. Use integer division: \`mid = Math.floor(left + (right - left) / 2)\` (also prevents integer overflow).
2. When \`nums[mid] < target\`, advance strictly: \`left = mid + 1\`.
3. When \`nums[mid] > target\`, shrink strictly: \`right = mid - 1\`.`
    }
    return `[DEV MOCK • Level 4 Full Solution]
🐾 Here is the corrected and safe Binary Search implementation:

\`\`\`typescript
function binarySearch(nums: number[], target: number): number {
  let left = 0;
  let right = nums.length - 1;

  while (left <= right) {
    const mid = Math.floor(left + (right - left) / 2);
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return -1; // Not found
}
\`\`\`
• **Verified:** Guaranteed termination, handles empty arrays \`[]\` and single-element inputs without out-of-bounds errors.`
  }

  // 3. Test Case Mode Responses
  if (mode === 'testcase') {
    return `[DEV MOCK • Test Case Analysis (Level ${level})]
🐾 Here are 4 critical edge cases you should test against your solution:

1. **Empty / Minimal Input:**
   • Input: \`nums = []\` or \`nums = [1]\`
   • *Why:* Catches index out of bounds on \`nums[0]\` or \`nums[1]\`.

2. **Negative Numbers:**
   • Input: \`nums = [-10, -5, 0, 3, 7]\`
   • *Why:* Catches assumptions that numbers are always positive.

3. **Duplicate Elements:**
   • Input: \`nums = [3, 3], target = 6\`
   • *Why:* Catches hash maps overwriting identical keys.

4. **Extreme Integer Values:**
   • Input: \`nums = [2147483647, -2147483648]\`
   • *Why:* Verifies overflow prevention.`
  }

  // 4. Learn Mode Responses
  return `[DEV MOCK • Algorithm Deep Dive (Level ${level})]
🐾 **Topic Breakdown for: "${prompt.slice(0, 30)}..."**

• **Core Pattern:** Sliding Window / Two Pointers
• **When to use it:** Whenever you are searching for a contiguous subarray, substring, or window that satisfies a condition.
• **Time Complexity:** O(N) because each pointer advances at most N times.
• **Space Complexity:** O(1) auxiliary space.

💡 *Senior Engineer Tip:* Think of the right pointer as expanding the window to satisfy a condition, and the left pointer as shrinking the window to minimize or validate it!`
}
