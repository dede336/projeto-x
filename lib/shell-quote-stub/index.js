// Minimal shell-quote stub
// react-devtools-core uses this internally; it is never called in Expo Go / web context.

function quote(args) {
  return args
    .map(function (s) {
      if (typeof s === 'object') return s.op || '';
      if (/[^a-zA-Z0-9@%_\-+=:,./]/.test(s)) {
        return "'" + s.replace(/'/g, "'\\''") + "'";
      }
      return s;
    })
    .join(' ');
}

function parse(s, env) {
  var tokens = [];
  var current = '';
  var inSingle = false;
  var inDouble = false;
  for (var i = 0; i < s.length; i++) {
    var c = s[i];
    if (inSingle) {
      if (c === "'") inSingle = false;
      else current += c;
    } else if (inDouble) {
      if (c === '"') inDouble = false;
      else current += c;
    } else if (c === "'") {
      inSingle = true;
    } else if (c === '"') {
      inDouble = true;
    } else if (c === ' ' || c === '\t') {
      if (current) { tokens.push(current); current = ''; }
    } else {
      current += c;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

module.exports = { quote: quote, parse: parse };
