import type { PageEdits } from '../edits/types';

/**
 * The page as it should be handed to somebody else.
 *
 * A change switched off is one the author decided against. It stayed in the Markdown
 * summary, in the before/after image and in a share link anyway, with nothing marking it
 * as off — so an engineer was handed work nobody had asked for, indistinguishable from
 * the work they had.
 *
 * This is not the same as exporting your own edits. A JSON export is how the work moves
 * between your machines, and dropping the parts you had switched off would be losing
 * them; a hand-off is a request to someone else, and it carries only what is being asked
 * for. `toJson` deliberately does not go through here.
 */
export function forHandOff(page: PageEdits): PageEdits {
  return { ...page, records: page.records.filter((record) => record.enabled) };
}
