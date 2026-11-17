/**
 * The panel's own settings, read from the environment. Pure: takes the
 * environment as an argument and returns what it found, including every reason
 * the panel must not start.
 */

export const MIN_PASSWORD_LENGTH = 12;
export const MIN_SESSION_SECRET_LENGTH = 32;
export const DEFAULT_SESSION_HOURS = 12;
export const MAX_SESSION_HOURS = 24 * 30;

export interface PanelConfig {
  /** True when TRIDENT_PANEL_PASSWORD is set: every page and API route then needs a session. */
  loginEnabled: boolean;
  /** Empty when login is off. */
  password: string;
  /** Empty when TRIDENT_PANEL_SESSION_SECRET is not set; a random key is used instead. */
  sessionSecret: string;
  sessionSeconds: number;
  /** Non-empty when the settings are unusable. The panel refuses to start and to serve. */
  errors: string[];
}

// Words a guessable password is typically assembled from. A password whose
// letters are nothing but these words, in any order and any number of times,
// is refused whatever digits and punctuation surround them.
const COMMON_WORDS = [
  'administrator', 'qwertyuiop', 'asdfghjkl', 'changeme', 'password', 'zxcvbnm', 'letmein',
  'welcome', 'default', 'trident', 'example', 'passwd', 'qwerty', 'secret', 'change', 'please',
  'admin', 'cache', 'panel', 'token', 'login', 'pass', 'word', 'root', 'asdf', 'your', 'test',
  'demo', 'me', 'my',
];
const COMMON_WORDS_ONLY = new RegExp(`^(?:${COMMON_WORDS.join('|')})+$`);
const DIGIT_RUNS = ['01234567890123456789012345678901', '98765432109876543210987654321098'];
// Characters commonly typed in place of letters (p@ssw0rd).
const LOOKALIKES: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i', '|': 'l', '+': 't',
};

function onlyCommonWords(text: string): boolean {
  const letters = text.replace(/[^a-z]/g, '');
  return letters.length > 0 && COMMON_WORDS_ONLY.test(letters);
}

/** True for a password an attacker would try early, however long it is. */
export function isWeakPassword(password: string): boolean {
  const lower = password.toLowerCase();
  if (new Set(lower).size < 5) return true;
  if (onlyCommonWords(lower)) return true;
  const lookalike = (ch: string) => LOOKALIKES[ch];
  // Every lookalike read as a letter (p@$$w0rd), and only those inside a word,
  // so that trailing "!!!" or "123" stays punctuation (p@ssw0rd!!!).
  if (onlyCommonWords(lower.replace(/[013457@$!|+]/g, lookalike))) return true;
  if (onlyCommonWords(lower.replace(/(?<=[a-z])[013457@$!|+]+(?=[a-z])/g, (run) => run.replace(/./g, lookalike)))) return true;
  if (/^\d+$/.test(lower) && DIGIT_RUNS.some((run) => run.includes(lower))) return true;
  return false;
}

export function readPanelConfig(env: Record<string, string | undefined>): PanelConfig {
  const errors: string[] = [];

  const password = env.TRIDENT_PANEL_PASSWORD ?? '';
  const loginEnabled = password !== '';
  if (loginEnabled) {
    if (password.length < MIN_PASSWORD_LENGTH) {
      errors.push(
        `TRIDENT_PANEL_PASSWORD is ${password.length} characters long; it must be at least ${MIN_PASSWORD_LENGTH}.`,
      );
    } else if (isWeakPassword(password)) {
      errors.push(
        'TRIDENT_PANEL_PASSWORD is too easy to guess: it is built from common words ' +
          '(such as "password", "admin", "changeme" or "trident"), a digit run, or very few different characters.',
      );
    }
  }

  const sessionSecret = env.TRIDENT_PANEL_SESSION_SECRET ?? '';
  if (sessionSecret !== '' && sessionSecret.length < MIN_SESSION_SECRET_LENGTH) {
    errors.push(
      `TRIDENT_PANEL_SESSION_SECRET is ${sessionSecret.length} characters long; it must be at least ` +
        `${MIN_SESSION_SECRET_LENGTH}. Unset it to use a random key generated at each start.`,
    );
  }

  let sessionHours = DEFAULT_SESSION_HOURS;
  const rawHours = (env.TRIDENT_PANEL_SESSION_HOURS ?? '').trim();
  if (rawHours !== '') {
    const parsed = Number(rawHours);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_SESSION_HOURS) {
      errors.push(
        `TRIDENT_PANEL_SESSION_HOURS must be a number greater than 0 and at most ${MAX_SESSION_HOURS}; got "${rawHours}".`,
      );
    } else {
      sessionHours = parsed;
    }
  }

  return {
    loginEnabled,
    password,
    sessionSecret,
    sessionSeconds: Math.max(1, Math.round(sessionHours * 3600)),
    errors,
  };
}
