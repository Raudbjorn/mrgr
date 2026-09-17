// The one authorized attempt terminated on environment drift. This command is
// retained as a fail-closed tombstone; choosing another directory grants no retry.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mutantDisposition} from '../../evidence/h0/mutant-disposition.mjs';
export const CASE='1ef47c17386e0c6585ca4c3bd2c8ea58d4a63c18cdfedd13ffbf9d2e6f21dc6f';
export const REPLACEMENT='\tstart, end, step := 0, MaxInt, 2\n';
export const rejected=ev=>mutantDisposition(ev)==='rejected';
export function requireEnvironment(expected,actual){assert.equal(actual,expected,'environment fingerprint drift; no controls authorized');}
export function freeze(){throw new Error('INCOMPLETE: control-repair amendment is terminal; a new protocol is required');}
export const run=freeze;
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  console.error('INCOMPLETE: control-repair amendment is terminal; no freeze, retry, or continuation authorized');
  process.exitCode=1;
}
