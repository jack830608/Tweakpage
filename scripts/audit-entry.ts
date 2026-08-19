/** What selector-audit.mjs injects into a real page. See that file. */
import { buildContext } from '../lib/selector/context';
import { generateSelector } from '../lib/selector/generate';
import { resolveRecord } from '../lib/selector/resolve';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__twk = { generateSelector, resolveRecord, buildContext };
