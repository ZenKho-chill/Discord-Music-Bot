const express = require('express');
const path = require('path');

module.exports = function () {
  const app = express();
  const PORT = 3000;

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'dashboard/views'));

  const routes = require('./dashboard/routes/index');
  app.use('/', routes);

  app.listen(PORT, () => {
    console.log(`Truy cập bảng điều khiển tại: http://localhost:${PORT}`);
  });
};
