import { OFFLINE_COUNT_KEYS, SnapshotError, summarizeSnapshot } from './snapshot.mjs';

export const MAX_COUNTS_CSV_BYTES = 1024;
const columns = ['schemaVersion', ...OFFLINE_COUNT_KEYS];
const headers = new Map([',', ';'].map(delimiter => [columns.join(delimiter), delimiter]));
const decimalInteger = /^(?:0|[1-9][0-9]{0,9})$/;

export function summarizeCountsCsv(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new SnapshotError('INVALID_CSV_INPUT');
  if (bytes.length > MAX_COUNTS_CSV_BYTES) throw new SnapshotError('LIMIT_CSV_BYTES');

  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new SnapshotError('INVALID_UTF8'); }

  // Intentionally not a general CSV reader: exactly a header and one aggregate.
  // Only ASCII digits, known column names, and a single separator are accepted.
  const rows = text.replaceAll('\r\n', '\n').split('\n');
  if (rows.at(-1) === '') rows.pop();
  const delimiter = headers.get(rows[0]);
  if (rows.length !== 2 || !delimiter) throw new SnapshotError('INVALID_COUNTS_CSV_LAYOUT');

  const cells = rows[1].split(delimiter);
  if (cells.length !== columns.length) throw new SnapshotError('INVALID_COUNTS_CSV_LAYOUT');
  const [version, ...values] = cells;
  if (version !== '1') throw new SnapshotError('UNSUPPORTED_COUNTS_CSV_VERSION');
  if (!values.every(value => decimalInteger.test(value))) throw new SnapshotError('INVALID_COUNTS_CSV_VALUE');

  return summarizeSnapshot({
    schemaVersion: 1,
    source: 'radar-offline',
    counts: Object.fromEntries(OFFLINE_COUNT_KEYS.map((key, index) => [key, Number(values[index])])),
  });
}
