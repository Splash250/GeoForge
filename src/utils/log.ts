import { restoreLocalStorageAfterLoglevelImport } from '@/utils/log-localstorage-guard.ts';
import rawLog from 'loglevel/lib/loglevel.js';

type Loglevel = typeof import('loglevel');

restoreLocalStorageAfterLoglevelImport();

const log = rawLog as Loglevel;

export type GeoForgeLogger = typeof log;
export default log;
