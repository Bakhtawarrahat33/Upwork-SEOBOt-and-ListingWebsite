const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const EMOJIS = { DEBUG: '🔍', INFO: 'ℹ️', WARN: '⚠️', ERROR: '❌', SUCCESS: '✅' };

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] || LOG_LEVELS.INFO;

function formatArgs(args) {
  return args.map(a => (typeof a === 'object' ? (a.stack || JSON.stringify(a, null, 2)) : String(a))).join(' ');
}

function emit(level, ...args) {
  if (LOG_LEVELS[level] < currentLevel) return;
  const ts = new Date().toISOString();
  const prefix = EMOJIS[level] || '';
  const message = formatArgs(args);
  const line = `[${ts}] [${level}] ${prefix} ${message}`;
  if (level === 'ERROR') {
    console.error(line);
  } else if (level === 'WARN') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (...args) => emit('DEBUG', ...args),
  info: (...args) => emit('INFO', ...args),
  warn: (...args) => emit('WARN', ...args),
  error: (...args) => emit('ERROR', ...args),
  success: (...args) => emit('SUCCESS', ...args),
};
