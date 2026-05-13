/**
 * Генерация invite-кодов для команд.
 * Алфавит без визуально похожих символов (0, O, 1, I).
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

/**
 * Проверяет формат кода (6 символов, только из разрешённого алфавита).
 */
export function isValidInviteCodeFormat(code: string): boolean {
  if (!code || code.length !== CODE_LENGTH) return false;
  for (const ch of code) {
    if (!ALPHABET.includes(ch)) return false;
  }
  return true;
}
