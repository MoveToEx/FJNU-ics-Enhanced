var express = require('express');
var router = express.Router();
var ics = require('ics');
const encrypt = require('./encrypt');
const htmlParser = require('node-html-parser').parse;
const async = require('async');
const querystring = require('querystring')
var request = require('request');

const class_time = {
    "旗山校区": [0, [8, 20], [9, 15], [10, 20], [11, 15], [14, 0], [14, 55],
        [15, 50], [16, 45], [18, 30], [19, 25], [20, 20], [21, 15]],
    "仓山校区": [0, [8, 00], [8, 55], [10, 00], [10, 55], [14, 0], [14, 55],
        [15, 50], [16, 45], [18, 30], [19, 25], [20, 20], [21, 15]]
}

const duration_per_class = 45;

function range(l, r, mod) {
    var a = [];
    for (var i = l; i <= r; i++) {
        if (mod == null) {
            a.push(i);
        }
        else if (i % 2 == mod) {
            a.push(i);
        }
    }
    return a;
}

router.get('/api/gen.ics', function (req, res) {
    var qs = JSON.parse(req.query['param']);
    var uid = qs.uid
    var password = qs.password
    var year = qs.year
    var semester = qs.semester
    var start = qs.start

    var jar = request.jar();
    var _request = request.defaults({ jar: jar });

    if (!(uid && password && year && semester)) {
        res.statusCode = 400;
        res.end("Invalid data");
        return;
    }

    var ts = new Date().getTime();
    var headers = {
        "Origin": "https://jwglxt.fjnu.edu.cn",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
        "Referer": "https://jwglxt.fjnu.edu.cn/jwglxt/xtgl/login_slogin.html",
        "Content-Type": "application/x-www-form-urlencoded"
    };

    async.waterfall([
        function (callback) {
            var data = {
                'csrftoken': '',
                'language': 'zh_CN',
                'yhm': '',
                'mm': ''
            };

            _request.get('https://jwglxt.fjnu.edu.cn/jwglxt/xtgl/login_slogin.html', (err, res, body) => {
                if (err) {
                    callback(err);
                    return;
                }
                if (!body) {
                    callback("1 of 5: Login page empty");
                    return;
                }
                var html = htmlParser(body);
                if (!html.querySelector('input#csrftoken')) {
                    callback("1 of 5: CSRF token not present");
                    return;
                }
                data['csrftoken'] = htmlParser(body).querySelector('input#csrftoken').attrs['value'];
                callback(null, data);
            });
        },
        function (data, callback) {
            _request.get('https://jwglxt.fjnu.edu.cn/jwglxt/xtgl/login_getPublicKey.html?time=' + ts, { gzip: true, json: true }, (err, res, body) => {
                if (err) {
                    callback(err);
                    return;
                }
                data['yhm'] = uid;
                data['mm'] = encrypt(password, body['modulus'], body['exponent']);
                callback(null, data);
            });
        },
        function (data, callback) {
            _request.post('https://jwglxt.fjnu.edu.cn/jwglxt/xtgl/login_logoutAccount.html', { headers: headers }, (err, res, body) => {
                if (err) {
                    callback(err);
                    return;
                }
                callback(null, data);
            })
        },

        function (data, callback) {
            _request.post('https://jwglxt.fjnu.edu.cn/jwglxt/xtgl/login_slogin.html?time=' + ts, {
                headers: headers, body: querystring.encode(data)
            }, (err, res, body) => {

                if (err) {
                    callback(err);
                    return;
                }

                if (body.indexOf('不正确') != -1) {
                    callback("4 of 5: Failed when logging in");
                    return;
                }

                callback(null, data);
            });
        },

        function (data, callback) {
            _request.post('https://jwglxt.fjnu.edu.cn/jwglxt/kbcx/xskbcx_cxXsgrkb.html?gnmkdm=N253508&layout=default&su=' + uid, {
                body: `xnm=${year}&xqm=${semester}&kzlx=ck`,
                headers: headers,
                gzip: true
            }, (err, res, body) => {
                if (err) {
                    callback(err);
                    return;
                }

                callback(null, body);
            });
        }
    ], function (err, result) {
        if (err) {
            res.statusCode = 400;
            res.end(err);
            return;
        }

        var sch = JSON.parse(result).kbList;
        var schedule = [];

        for (var i in sch) {
            var it = sch[i];
            var mres;
            var weeks = [];
            _ = it['jcs'].match(/(\d*)-(\d*)/);
            _class = [Number(_[1]), Number(_[2])];
            campus = it['xqmc'];

            _ = it['zcd'].split(',');

            for (var s in _) {
                s = _[s].trim();

                if (mres = s.match(/(\d*)-(\d*)周\((.*)\)/)) {
                    weeks = weeks.concat(range(Number(mres[1]), Number(mres[2]), mres[3] == '单' ? 1 : 0));
                }
                else if (mres = s.match(/(\d*)-(\d*)周/)) {
                    weeks = weeks.concat(range(Number(mres[1]), Number(mres[2])));
                }
                else if (mres = s.match(/(\d*)周/)) {
                    weeks.push(Number(mres[1]));
                }
            }

            _ = [class_time[campus][_class[1]][0], class_time[campus][_class[1]][1]];
            _[1] += duration_per_class;
            if (_[1] >= 60) {
                _[0]++;
                _[1] -= 60;
            }

            schedule.push({
                "name": it['kcmc'],
                "teacher": it['xm'],
                "location": it['cdmc'],
                "time": {
                    "from": [class_time[campus][_class[0]][0], class_time[campus][_class[0]][1]],
                    "to": _
                },
                "weeks": weeks,
                "weekday_order": Number(it['xqj'])
            });
        }

        var t = new Date(start);
        var week = 0;
        var a = [];

        for (var i = 0; i < 365; ++i) {
            if (i % 7 == 0) ++week;
            for (var j in schedule) {
                var it = schedule[j];
                if (it['weeks'].indexOf(week) == -1) continue;
                if (it['weekday_order'] != i % 7 + 1) continue;
                var duration = (new Date(0, 0, 0, it['time']['to'][0], it['time']['to'][1])) - (new Date(0, 0, 0, it['time']['from'][0], it['time']['from'][1]));
                a.push({
                    title: it['name'],
                    start: [t.getFullYear(), t.getMonth() + 1, t.getDate(), it['time']['from'][0], it['time']['from'][1]],
                    duration: {
                        hours: Math.floor(duration / 1000 / 60 / 60),
                        minutes: (duration / 1000 / 60) % 60
                    },
                    location: it['location'],
                    description: it['teacher']
                })
            }
            t.setDate(t.getDate() + 1);
        }
        var { err, value } = ics.createEvents(a);
        if (err) {
            res.statusCode = 400;
            res.end("ERR");
        }
        else {
            res.set({ "Content-Disposition": "attachment; filename=\"caledar.ics\"" });
            res.set({ "Content-Type": "text/calendar" });
            res.send(value);
            res.end();
        }
    });

});

module.exports = router;