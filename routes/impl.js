var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/impl', function(req, res, next) {
  res.render('impl', { title: 'FJNU ICS Generator' });
});

module.exports = router;
