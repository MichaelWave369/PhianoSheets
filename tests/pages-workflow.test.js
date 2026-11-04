import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Prevent recurrent GitHub Pages "multiple artifacts named github-pages"
// errors when a failed job is re-run within the same workflow run.
test('Pages upload and deploy use matching per-attempt artifact names', () => {
  const workflow = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  const token = 'github-pages-${{ github.run_attempt }}';
  assert.equal(workflow.split(token).length - 1, 2,
    'Both upload and deploy must use the same attempt-specific artifact name');
  assert.match(workflow, /uses: actions\/upload-pages-artifact@v4\s+with:\s+name: github-pages-\$\{\{ github\.run_attempt \}\}/);
  assert.match(workflow, /uses: actions\/deploy-pages@v4\s+with:\s+artifact_name: github-pages-\$\{\{ github\.run_attempt \}\}/);
  assert.match(workflow, /workflow_dispatch:/, 'Manual fresh workflow runs must remain enabled');
});
