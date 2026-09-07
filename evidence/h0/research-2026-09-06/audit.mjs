// Read-only corpus audit and up-to-six-case context acquisition pilot. Run from repo root.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const out = 'evidence/h0/research-2026-09-06';
const sha = x => createHash('sha256').update(x).digest('hex');
const jsonl = p => readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 30000 });
const groups = (rows, key) => Map.groupBy(rows, key);
const small = t => `Repository: ${t.repository_id}\nMerge: ${t.merge_sha}\nPath: ${t.path}\nTriple: ${t.triple_key}\nCategory: ${t.category}\n\n<<CONFLICT_HUNK>>\n<<<<<<< ours\n${t.ours}=======\n${t.theirs}>>>>>>>\n<<END_HUNK>>\n`.length <= 2400;
const norm = s => (s ?? '').replace(/\s+/g, '');
const files = readdirSync('evidence/h0/runs', { recursive: true }).filter(p => p.endsWith('.jsonl'));
const exposed = new Set(files.flatMap(p => jsonl(`evidence/h0/runs/${p}`).map(r => r.triple_id)));
const frozen = new Set(jsonl('evidence/h0/runs/hunk-only-2026-08-30T02-54-42-056Z.jsonl').map(r => r.triple_id));
const all = [], summaries = [], pilot = [], inputs = {};
for (const [name, dir] of [['jq', 'jq'], ['cli', 'cli-cli'], ['redis', 'redis']]) {
  const file = `evidence/h0/triples-${name}-diff3.jsonl`;
  inputs[file] = sha(readFileSync(file));
  const rows = jsonl(file), cwd = `/home/svnbjrn/rsrch/semantic-merge/local/${dir}`;
  all.push(...rows);
  const merges = groups(rows, t => t.merge_sha);
  const eligible = rows.filter(small), selected = rows.filter(t => frozen.has(t.triple_key));
  const seenMerges = new Set(rows.filter(t => exposed.has(t.triple_key)).map(t => t.merge_sha));
  summaries.push({ repo: rows[0].repository_id, rows: rows.length, unique_triple_keys: new Set(rows.map(t => t.triple_key)).size,
    unique_merges: merges.size, largest_merge_rows: Math.max(...[...merges.values()].map(x => x.length)),
    eligible_rows: eligible.length, eligible_merges: new Set(eligible.map(t => t.merge_sha)).size,
    frozen_matching_rows: selected.length, frozen_unique_keys: new Set(selected.map(t => t.triple_key)).size,
    frozen_merges: new Set(selected.map(t => t.merge_sha)).size,
    previously_exposed_keys: new Set(rows.filter(t => exposed.has(t.triple_key)).map(t => t.triple_key)).size,
    merges_without_any_recorded_exposure: [...merges.keys()].filter(k => !seenMerges.has(k)).length,
    missing_preimage_sides: rows.reduce((n,t) => n + ['ours','theirs'].filter(s => t[`preimage_${s}`] == null).length, 0),
    prompt_prefix_truncated_sides: rows.reduce((n,t) => n + ['ours','theirs'].filter(s => (t[`preimage_${s}`]?.length ?? 0) > 1200).length, 0),
    empty_dependency_rows: rows.filter(t => !t.dependency_graph?.length).length,
    categories: Object.fromEntries([...groups(rows, t => t.category)].map(([k,v]) => [k,v.length])),
    frozen_old_grader_side_union_matches: selected.filter(t => [norm(t.ours),norm(t.theirs)].includes(norm(t.resolution))).length });
  // Only already-exposed development cases: acquisition cannot contaminate a new holdout.
  const cases = [...groups(selected, t => t.merge_sha).values()].slice(0, 2).map(v => v[0]);
  for (const t of cases) {
    const parents = git(cwd, 'show', '-s', '--format=%P', t.merge_sha).trim().split(' ');
    assert.equal(parents.length, 2);
    const sides = parents.map((parent, i) => {
      const content = git(cwd, 'show', `${parent}:${t.path}`);
      assert.equal(content, t[`preimage_${i === 0 ? 'ours' : 'theirs'}`]);
      const hunk = t[i === 0 ? 'ours' : 'theirs'] ?? '';
      const offset = hunk.length ? content.indexOf(hunk) : -1;
      const start = offset < 0 ? 0 : Math.max(0, offset - 600);
      const end = offset < 0 ? Math.min(1200, content.length) : Math.min(content.length, offset + hunk.length + 600);
      const licenses = git(cwd, 'ls-tree', '--name-only', parent).trim().split('\n').filter(p => /^(license|copying)(\.|$)/i.test(p));
      return { parent, commit_metadata: git(cwd, 'show', '-s', '--format=%H%n%cI%n%s', parent).trim(),
        changed_paths: git(cwd, 'diff', '--name-only', t.base_reachability.base_sha, parent, '--').trim().split('\n').filter(Boolean),
        licenses: licenses.map(path => { const text = git(cwd, 'show', `${parent}:${path}`); return { path, sha256: sha(text), text }; }),
        blob_oid: git(cwd, 'rev-parse', `${parent}:${t.path}`).trim(), sha256: sha(content), original_utf8_bytes: Buffer.byteLength(content),
        hunk_found: offset >= 0, hunk_in_old_prefix: offset >= 0 && offset + hunk.length <= 1200,
        window_start_utf16: start, window_end_utf16: end, window: content.slice(start, end) };
    });
    pilot.push({ purpose: 'development-only acquisition feasibility; not model evaluation', repository_id: t.repository_id,
      triple_key: t.triple_key, merge_sha: t.merge_sha, path: t.path, base_sha: t.base_reachability.base_sha, sides });
  }
}
const duplicateKeys = [...groups(all, t => t.triple_key)].filter(([,v]) => v.length > 1);
const summary = { source_head: git('.', 'rev-parse', 'HEAD').trim(), node: process.version, git: git('.', '--version').trim(), inputs,
  recorded_exposure_policy: 'any triple_id in any runs/**/*.jsonl, including retracted/probe runs; absence is not proof of untouched data',
  repos: summaries, total_rows: all.length, unique_keys: new Set(all.map(t=>t.triple_key)).size,
  duplicate_key_groups: duplicateKeys.length,
  conflicting_resolution_key_groups: duplicateKeys.filter(([,v]) => new Set(v.map(t=>t.resolution)).size > 1).length,
  duplicate_key_details: duplicateKeys.map(([key,v]) => ({key, frozen: frozen.has(key),
    occurrences: v.map(t => ({repo:t.repository_id, merge:t.merge_sha, path:t.path, ordinal:t.ordinal, resolution_sha256:sha(t.resolution)}))})),
  pilot_cases: pilot.length, pilot_sides: pilot.flatMap(t=>t.sides).length,
  pilot_hunks_outside_old_prefix: pilot.flatMap(t=>t.sides).filter(s=>s.hunk_found && !s.hunk_in_old_prefix).length };
// Small checks for the audit's grouping, null normalization, and recorded sample accounting.
assert.equal(groups([{m:'a'}, {m:'a'}, {m:'b'}], x=>x.m).size, 2);
assert.equal(norm(null), '');
assert.equal(new Set(all.filter(t=>frozen.has(t.triple_key)).map(t=>t.triple_key)).size, frozen.size);
assert.equal(summary.pilot_sides, 2 * pilot.length);
writeFileSync(`${out}/inventory.json`, JSON.stringify(summary, null, 2) + '\n');
writeFileSync(`${out}/acquisition-pilot.jsonl`, pilot.map(x=>JSON.stringify(x)).join('\n') + '\n');
console.log(JSON.stringify(summary, null, 2));
