const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('index'); // hoặc res.send("Dashboard hoạt động!");
});

module.exports = router;
