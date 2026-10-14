'use strict';

const MODELS = ['haiku', 'sonnet', 'opus', 'fable'];
const TAG = new RegExp(
  '(?:^|[\\s(\\["\'`“‘])@(' + MODELS.join('|') + ')' +
    '(?=$|[\\s,;:!?)\\]"`”]|[\'’]\\p{L}|\\.+(?:$|[\\s)\\]"`]))',
  'iu'
);

function detectOverride(prompt) {
  if (typeof prompt !== 'string') return null;
  const m = TAG.exec(prompt);
  return m ? m[1].toLowerCase() : null;
}

function buildContext(override, env = process.env) {
  if (env && env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE === '1') {
    return (
      'CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1 ayarlı olduğu için çağrı başına model seçilemez; ' +
      "model yönlendirme bu oturumda devre dışı. model-routing skill'i çağrılmaz, istek normal şekilde yapılır " +
      've kullanıcıya yönlendirmenin devre dışı olduğu tek satırla bildirilir.'
    );
  }
  if (override) {
    return (
      `Kullanıcı bu istek için ${override} modelini seçti (@${override}). ` +
      `İstek soru veya açıklama olsa bile model-routing, ilk adım olarak Skill aracıyla çağrılır ve ` +
      `işi sınıflandırma yapmadan ${override} modeliyle bir alt ajana devreder.`
    );
  }
  return (
    "Bu kurulumda kodlama değişikliği, ekleme ve hata düzeltme istekleri model-routing skill'i üzerinden yönlendirilir: " +
    'model-routing, dosya düzenlenmeden önce Skill aracıyla çağrılır ve işi uygun modeldeki bir alt ajan yapar. ' +
    'Soru, açıklama ve sohbet isteklerinde yönlendirme yapılmaz.'
  );
}

function run(stdinText) {
  try {
    const event = JSON.parse(stdinText);
    if (!event || typeof event.prompt !== 'string') return '';
    return JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: buildContext(detectOverride(event.prompt)),
      },
    });
  } catch {
    return '';
  }
}

module.exports = { detectOverride, buildContext, run };

if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (input += chunk));
  process.stdin.on('end', () => {
    const out = run(input);
    if (out) process.stdout.write(out);
    process.exit(0);
  });
  process.stdin.on('error', () => process.exit(0));
}
