const encrypt = require('./encrypt');
const htmlParser = require('node-html-parser').parse;
const async = require('async');
var request = require('request');

const class_time = {
    "旗山校区": [ 0, [8, 20], [9, 15], [10, 20], [11, 15], [14, 0], [14, 55],
        [15, 50], [16, 45], [18, 30], [19, 25], [20, 20], [21, 15] ],
    "仓山校区": [ 0, [8, 00], [8, 55], [10, 00], [10, 55], [14, 0], [14, 55],
        [15, 50], [16, 45], [18, 30], [19, 25], [20, 20], [21, 15] ]
}

const duration_per_class = 45;


function range(l, r, f) {
    var a = [];
    for (var i = l; i <= r; i++) {
        if (f == null) {
            a.push(i);
        }
        else if (i % 2 == f) {
            a.push(i);
        }
    }
    return a;
}

module.exports = function (uid, password, year, semester, out) {
    var jar = request.jar();
    var _request = request.defaults({ jar: jar });

    if (!(uid && password && year && semester)) {
        console.log("Missing")
        out(1);
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
                    console.log("Empty response")
                    callback(1);
                    return;
                }

                var html = htmlParser(body);

                if (!html.querySelector('input#csrftoken')) {
                    callback(1);
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

                for (var i in data) {
                    data[i] = encodeURIComponent(data[i]);
                }

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
                headers: headers, body: `csrftoken=${data['csrftoken']}&language=zh_CN&yhm=${data['yhm']}&mm=${data['mm']}`
            }, (err, res, body) => {

                if (err) {
                    callback(err);
                    return;
                }

                if (body.indexOf('不正确') != -1) {
                    console.log("Failed when logging in")
                    callback(1);
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
            out(err);
            return;
        }

        if (!JSON.parse(result)) {
            out(null, []);
            return;
        }

        var sch = JSON.parse(result).kbList;
        var res = [];

        for (var i in sch) {
            var it = sch[i];
            var mres;
            _ = it['jcs'].match("(\\d*)-(\\d*)")
            _class = [Number(_[1]), Number(_[2])]
            campus = it['xqmc']

            weeks = []
            _ = it['zcd'].split(',')

            for (var s in _) {
                s = _[s].trim();

                if (mres = s.match("(\\d*)-(\\d*)周\\((.*)\\)")) {
                    weeks = weeks.concat(range(Number(mres[1]), Number(mres[2]), mres[3] == '单' ? 1 : 0));
                }
                else if (mres = s.match("(\\d*)-(\\d*)周")) {
                    weeks = weeks.concat(range(Number(mres[1]), Number(mres[2])));
                }
                else if (mres = s.match("(\\d*)周")) {
                    weeks.push(Number(mres[1]))
                }
            }

            _ = [class_time[campus][_class[1]][0], class_time[campus][_class[1]][1]];
            _[1] += duration_per_class;
            if (_[1] >= 60) {
                _[0]++;
                _[1] -= 60;
            }

            // 写后端的傻逼我囸你妈
            res.push({
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

        out(null, res);
    });

}