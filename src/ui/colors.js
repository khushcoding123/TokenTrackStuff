// Zero-dependency ANSI color helpers.
// Colors are disabled automatically when output is not a TTY, when NO_COLOR is
// set, or when TOKENPILOT_NO_COLOR is set — so piped output stays clean.

const enabled =
  Boolean(process.stdout.isTTY) &&
  !process.env.NO_COLOR &&
  !process.env.TOKENPILOT_NO_COLOR;

const ESC = String.fromCharCode(27); // the ASCII escape character
const code = (open, close) => (text) =>
  enabled ? `${ESC}[${open}m${text}${ESC}[${close}m` : String(text);

export const colors = {
  enabled,
  bold: code(1, 22),
  dim: code(2, 22),
  italic: code(3, 23),
  underline: code(4, 24),

  red: code(31, 39),
  green: code(32, 39),
  yellow: code(33, 39),
  blue: code(34, 39),
  magenta: code(35, 39),
  cyan: code(36, 39),
  gray: code(90, 39),

  bgRed: code(41, 49),
  bgYellow: code(43, 49),
  bgGreen: code(42, 49),
};

// Severity → color mapping used across the UI.
export const severityColor = {
  high: colors.red,
  medium: colors.yellow,
  low: colors.blue,
};
