'use strict';
// /model-router:panel komutu için: paneli gerekirse başlatır ve adresini yazar.
const { ensurePanel } = require('../hooks/ensure-server.js');

ensurePanel()
  .then((info) => {
    process.stdout.write(
      info
        ? `Model Router paneli: http://localhost:${info.port}\n`
        : 'Model Router paneli başlatılamadı. PATH üzerinde Node.js olduğundan emin ol.\n'
    );
  })
  .catch(() => process.stdout.write('Model Router paneli başlatılamadı.\n'))
  .finally(() => process.exit(0));
