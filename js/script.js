// ═══════════════════════════════════════════════════════════════
//  LEXER – máquina de estados (porta exacta del tokenizer Python)
//  cols: [spc, L(mayús), l(minús/print), |, ?, -, \n, >, *]
// ═══════════════════════════════════════════════════════════════

class GrammarLexer {
  constructor(input) { this.input = input; this.pos = 0; }

  static MATRIX = [
  //  spc  L   l   |   ?   -  \n   >   *
    [  0,  1,  2,  3,  4,  5,  7,  8,  8 ],  // q0 inicial
    [  8,  8,  8,  8,  8,  8,  8,  8,  8 ],  // q1 → 'n'  (No-terminal: mayúscula)
    [  8,  8,  8,  8,  8,  8,  8,  8,  8 ],  // q2 → 't'  (terminal: minúscula/símbolo)
    [  8,  8,  8,  8,  8,  8,  8,  8,  8 ],  // q3 → 'o'  (alternativa: |)
    [  8,  8,  8,  8,  8,  8,  8,  8,  8 ],  // q4 → 'e'  (epsilon: ?)
    [  9,  9,  9,  9,  9,  9,  9,  6,  9 ],  // q5 → espera '>' para formar '->'
    [  8,  8,  8,  8,  8,  8,  8,  8,  8 ],  // q6 → 'f'  (flecha: ->)
    [  8,  8,  8,  8,  8,  8,  8,  8,  8 ],  // q7 → 'endl' (fin de línea: \n)
    [  8,  8,  8,  8,  8,  8,  8,  8,  8 ],  // q8 → error
    [  8,  8,  8,  8,  8,  8,  8,  8,  8 ],  // q9 → emit 't' y retroceder
  ];

  _col(c) {
    if (c === ' ' || c === '\t' || c === '\r') return 0;
    if (c >= 'A' && c <= 'Z') return 1;
    if (c === '|') return 3;
    if (c === '?') return 4;
    if (c === '-') return 5;
    if (c === '\n') return 6;
    if (c === '>') return 7;
    return 2; // lowercase, dígitos, símbolos (+, *, (, ), etc.)
  }

  next() {
    const mat = GrammarLexer.MATRIX;
    let q = 0, lexema = '';
    while (true) {
      if (this.pos >= this.input.length)
        return { type: 'endf', lexema, position: this.pos };

      const savedPos = this.pos;
      const c = this.input[this.pos++];
      const col = this._col(c);
      q = mat[q][col];
      lexema += c;

      if (q === 1) return { type: 'n',    lexema, position: savedPos };
      if (q === 2) return { type: 't',    lexema, position: savedPos };
      if (q === 3) return { type: 'o',    lexema, position: savedPos };
      if (q === 4) return { type: 'e',    lexema, position: savedPos };
      if (q === 6) return { type: 'f',    lexema, position: savedPos };
      if (q === 7) return { type: 'endl', lexema, position: savedPos };
      if (q === 8) return { type: 'error',lexema, position: savedPos };
      // q9: el '-' no fue seguido de '>' → emitir '-' como terminal y retroceder
      if (q === 9) {
        this.pos--;
        const lex = lexema.slice(0, -1);
        return { type: 't', lexema: lex, position: savedPos };
      }
      // q0: espacio — resetear lexema
      if (q === 0) { lexema = ''; }
    }
  }

  unget(token) { this.pos = token.position; }
}

// ═══════════════════════════════════════════════════════════════
//  GRAMMAR PARSER – genera código Python (porta del original)
//  Y al mismo tiempo construye estructura interna para el intérprete
// ═══════════════════════════════════════════════════════════════

class GrammarParser {
  constructor(input) {
    this.lexer    = new GrammarLexer(input);
    this.tokens   = [];
    // Estructura interna para intérprete: { ruleName: [[item,...], ...] }
    this.rules    = {};
    this.firstRule = null;
    // Código Python generado
    this.programa = `
def main():
    global w
    global p
    w = input("Palabra: ")
    w += "\\n"
    p = 0
    parse()

def parse():
    if S() and w[p] == "\\n":
        print("Palabra correcta")
    else:
        print("Palabra incorrecta")

`;
  }

  next_token() { const t = this.lexer.next(); this.tokens.push(t); return t; }
  unget_token(t) { this.lexer.unget(t); if (this.tokens.length) this.tokens.pop(); }

  parse() {
    const ok = this.S(1);
    return {
      ok,
      code:      this.programa + '\nmain()',
      tokens:    this.tokens,
      rules:     this.rules,
      firstRule: this.firstRule,
    };
  }

  S(i)  { return this.PS(i); }
  PS(i) { if (this.P(i)) return this.P1(i); return false; }

  P1(i) {
    const token = this.next_token();
    if (token.type === 'endl') {
      const t2 = this.next_token(); this.unget_token(t2);
      if (t2.type === 'n') return this.PS(i);
      return true;
    }
    if (token.type === 'endf') return true;
    this.unget_token(token); return false;
  }

  P(i) {
    const token = this.next_token();
    if (token.type === 'n') {
      const t2 = this.next_token();
      if (t2.type === 'f') {
        const name = token.lexema;
        if (!this.firstRule) this.firstRule = name;
        this.rules[name] = [];
        this.programa += `\ndef ${name}() -> bool:\n    global p\n`;
        if (this.DS(i, name)) {
          this.programa += `\n    return False\n`;
          return true;
        }
      }
      this.unget_token(t2);
    }
    this.unget_token(token); return false;
  }

  DS(i, name) {
    const alt = [];
    if (this.D(i, alt)) {
      this.rules[name].push(alt);
      return this.D1(i, name);
    }
    return false;
  }

  D1(i, name) {
    const token = this.next_token();
    if (token.type === 'o') return this.DS(i, name);
    this.unget_token(token); return true;
  }

  D(i, alt) {
    const ind  = '    '.repeat(i);
    const ind1 = '    '.repeat(i + 1);
    const token = this.next_token();

    if (token.type === 'n') {
      if (alt) alt.push({ type: 'call', fn: token.lexema });
      this.programa += `${ind}t${i} = p\n`;
      this.programa += `${ind}if ${token.lexema}():\n`;
      const peek = this.next_token(); this.unget_token(peek);
      if (['n','t','e'].includes(peek.type)) {
        const innerAlt = alt ? [] : null;
        if (this.D(i + 1, innerAlt)) {
          if (alt && innerAlt) innerAlt.forEach(x => alt.push(x));
          this.programa += `${ind}p = t${i}\n`;
          return true;
        }
      }
      this.programa += `${ind1}return True\n`;
      this.programa += `${ind}p = t${i}\n`;
      return true;
    }

    if (token.type === 't') {
      if (alt) alt.push({ type: 'char', ch: token.lexema });
      this.programa += `${ind}t${i} = p\n`;
      this.programa += `${ind}c = w[p]\n`;
      this.programa += `${ind}p += 1\n`;
      this.programa += `${ind}if c == '${token.lexema}':\n`;
      const peek = this.next_token(); this.unget_token(peek);
      if (['n','t','e'].includes(peek.type)) {
        const innerAlt = alt ? [] : null;
        if (this.D(i + 1, innerAlt)) {
          if (alt && innerAlt) innerAlt.forEach(x => alt.push(x));
          this.programa += `${ind}p = t${i}\n`;
          return true;
        }
      }
      this.programa += `${ind1}return True\n`;
      this.programa += `${ind}p = t${i}\n`;
      return true;
    }

    if (token.type === 'e') {
      if (alt) alt.push({ type: 'epsilon' });
      this.programa += `${ind}p = t${i-1 >= 1 ? i-1 : i}\n`;
      this.programa += `${ind}return True\n`;
      return true;
    }

    this.unget_token(token); return false;
  }
}

// ═══════════════════════════════════════════════════════════════
//  WORD INTERPRETER – ejecuta la gramática directamente en JS
//  Usa backtracking igual que el código Python generado
// ═══════════════════════════════════════════════════════════════

class WordInterpreter {
  constructor(rules, firstRule) {
    this.rules     = rules;
    this.firstRule = firstRule;
    this.word = '';
    this.p    = 0;
  }

  run(word) {
    this.word = word + '\n';
    this.p    = 0;
    const ok  = this.callRule(this.firstRule);
    return ok && this.word[this.p] === '\n';
  }

  callRule(name) {
    const alts = this.rules[name];
    if (!alts) return false;
    for (const alt of alts) {
      const saved = this.p;
      if (this.matchAlt(alt)) return true;
      this.p = saved;
    }
    return false;
  }

  matchAlt(alt) {
    for (const item of alt) {
      if (item.type === 'epsilon') return true;
      if (item.type === 'call') {
        if (!this.callRule(item.fn)) return false;
      }
      if (item.type === 'char') {
        if (this.word[this.p] !== item.ch) return false;
        this.p++;
      }
    }
    return true;
  }
}

// ═══════════════════════════════════════════════════════════════
//  UI STATE
// ═══════════════════════════════════════════════════════════════

let generatedCode = '';
let allTokens     = [];
let grammarRules  = {};
let grammarFirst  = null;

function log(msg, type = 'info') {
  const body = document.getElementById('logBody');
  const now  = new Date();
  const ts   = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  const cls = {ok:'log-ok', err:'log-err', info:'log-info', warn:'log-warn'}[type] || 'log-info';
  entry.innerHTML = `<span class="log-time">${ts}</span><span class="${cls}">${msg}</span>`;
  body.appendChild(entry);
  body.scrollTop = body.scrollHeight;
}

function setStatus() {}

function tokenTag(type) {
  const map = { n:'tag-n', t:'tag-t', o:'tag-o', e:'tag-e', f:'tag-f', endl:'tag-endl', endf:'tag-endf', error:'tag-error' };
  return `<span class="tag ${map[type]||'tag-error'}">${type}</span>`;
}

function renderTokens() {}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function highlightPython(code) {
  let h = escHtml(code);
  h = h.replace(/(#.*?)$/gm, m => `<span class="cm">${m}</span>`);
  h = h.replace(/('.*?'|".*?")/g, m => `<span class="str">${m}</span>`);
  h = h.replace(/\b(def)\s+(\w+)/g, (_, kw, name) => `<span class="kw">def</span> <span class="fn">${name}</span>`);
  h = h.replace(/\b(global|if|return|True|False|None|and|or|not|while|for)\b/g, m => `<span class="kw">${m}</span>`);
  h = h.replace(/\b(\d+)\b/g, m => `<span class="num">${m}</span>`);
  return h;
}

function renderCode(code) {
  const display = document.getElementById('codeDisplay');
  if (!code) {
    display.innerHTML = '<div class="empty-msg">el código aparecerá aquí después de compilar</div>';
    return;
  }
  display.innerHTML = `<pre>${highlightPython(code)}</pre>`;
}

// ═══════════════════════════════════════════════════════════════
//  ACCIONES PRINCIPALES
// ═══════════════════════════════════════════════════════════════

function loadExample() {
  document.getElementById('grammarInput').value =
`S -> E+S | E-S | E
E -> F*E | F/E | F
F -> N | -F | (S)
N -> 0 | 1 | 2 | 3 | 4 | 5`;
  document.getElementById('wordInput').value = '3+4';
  log('gramática de ejemplo cargada', 'info');
}

function clearAll() {
  document.getElementById('grammarInput').value = '';
  document.getElementById('wordInput').value    = '';
  generatedCode = '';
  allTokens     = [];
  grammarRules  = {};
  grammarFirst  = null;
  renderCode('');
  renderTokens([]);
  document.getElementById('resultRow').style.display = 'none';
  log('workspace limpiado', 'warn');
}

function runParser() {
  const grammar = document.getElementById('grammarInput').value.trim();
  if (!grammar) { log('error: la gramática está vacía', 'err'); return; }

  setStatus(true);
  log('iniciando análisis léxico-sintáctico…', 'info');

  setTimeout(() => {
    try {
      const parser = new GrammarParser(grammar);
      const { ok, code, tokens, rules, firstRule } = parser.parse();
      allTokens    = tokens;
      grammarRules = rules;
      grammarFirst = firstRule;

      renderTokens(tokens);

      if (ok) {
        generatedCode = code;
        renderCode(code);
        log(`léxico: ${tokens.length} tokens - reglas: ${Object.keys(rules).join(', ')}`, 'ok');
        log(`símbolo inicial: ${firstRule}`, 'ok');
        log('análisis sintáctico: OK - código Python generado', 'ok');
        setStatus(false);
      } else {
        log('análisis sintáctico: FALLO - gramática inválida', 'err');
        renderCode('');
        setStatus(false, true);
        setTimeout(() => setStatus(false), 2000);
      }
    } catch(e) {
      log('excepción: ' + e.message, 'err');
      setStatus(false, true);
      setTimeout(() => setStatus(false), 2000);
    }
  }, 80);
}

function testWord() {
  const word = document.getElementById('wordInput').value.trim();
  if (!word)         { log('error: ingresa una palabra para verificar', 'err'); return; }
  if (!grammarFirst) { log('error: primero compila la gramática', 'err'); return; }

  log(`verificando: "${word}"`, 'info');
  setStatus(true);

  setTimeout(() => {
    try {
      const interp = new WordInterpreter(grammarRules, grammarFirst);
      const ok     = interp.run(word);
      const msg    = ok ? 'Palabra correcta ✓' : 'Palabra incorrecta ✗';

      const area = document.getElementById('resultArea');
      const icon  = ok ? '✓' : '✗';
      const label = ok ? 'Palabra correcta' : 'Palabra incorrecta';
      area.innerHTML = `<div class="result-bar ${ok ? 'ok' : 'fail'}">${icon} ${label}<span class="sub">"${word}"</span></div>`;

      log(msg, ok ? 'ok' : 'err');
      setStatus(false);
    } catch(e) {
      log('error en verificación: ' + e.message, 'err');
      setStatus(false, true);
      setTimeout(() => setStatus(false), 2000);
    }
  }, 60);
}

function copyCode() {
  if (!generatedCode) return;
  navigator.clipboard.writeText(generatedCode).then(() => {
    const btn = document.getElementById('copyBtn');
    btn.textContent = '✓ COPIADO';
    setTimeout(() => btn.textContent = 'COPIAR', 2000);
    log('código copiado al portapapeles', 'ok');
  });
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    runParser();
  }
});

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loadExampleBtn').addEventListener('click', loadExample);
  document.getElementById('clearBtn').addEventListener('click', clearAll);
  document.getElementById('runParserBtn').addEventListener('click', runParser);
  document.getElementById('testWordBtn').addEventListener('click', testWord);
  document.getElementById('copyBtn').addEventListener('click', copyCode);

  log('grammar-parser v1.0 - JS vanilla', 'ok');
  log('Ctrl+Enter para compilar', 'info');
});

