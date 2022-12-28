var express = require('express');
var router = express.Router();
var ics = require('ics');

var fjnuAPI = require('./api');

router.post('/api/raw', function (req, res) {
    fjnuAPI(req.body['uid'], req.body['password'], req.body['year'], req.body['semester'], (err, data) => {
        if (err) {
            res.statusCode = 400;
            res.end("test");
        }
        else {
            res.send(data);
        }
    });
});

router.post('/api/ics', function (req, res) {
    fjnuAPI(req.body['uid'], req.body['password'], req.body['year'], req.body['semester'], (err, data) => {
        if (err) {
            res.statusCode = 400;
            res.end("ERR");
        }
        else {
            var dt = new Date(Number(req.body['start']));
            var wk_idx = 0;
            var a = [];
            var sch = data;
            for (var i = 0; i < 365; ++i) {
                if (i % 7 == 0) ++wk_idx;
                for (var j in sch) {
                    var it = sch[j];
                    if (it['weeks'].indexOf(wk_idx) == -1) continue;
                    if (it['weekday_order'] != i % 7 + 1) continue;
                    var duration = (new Date(0, 0, 0, it['time']['to'][0], it['time']['to'][1])) - (new Date(0, 0, 0, it['time']['from'][0], it['time']['from'][1]));
                    a.push({
                        title: it['name'],
                        start: [dt.getFullYear(), dt.getMonth() + 1, dt.getDate() + 1, it['time']['from'][0], it['time']['from'][1]],
                        duration: {
                            hours: Math.floor(duration / 1000 / 60 / 60),
                            minutes: (duration / 1000 / 60) % 60
                        },
                        location: it['location'],
                        description: it['teacher']
                    })
                }
                dt.setDate(dt.getDate() + 1);
            }
            var { err, value } = ics.createEvents(a);
            if (err) {
                res.statusCode = 400;
                res.end("ERR");
            }
            else {
                res.end(value);
            }
        }
    });
});

module.exports = router;
