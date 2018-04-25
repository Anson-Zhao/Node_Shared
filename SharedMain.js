var express = require('express');
var app = express();
var path = require('path');
var bodyParser = require('body-parser');
var mysql = require('mysql');
var Influx = require('influx');
var port = 9090;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

var con_CS = mysql.createConnection({
    multipleStatements: true,
    host: '10.11.4.249',
    port: 3306,
    user: 'AppUser',
    password: 'Special888%',
    database: 'CitySmart'
});

var con_FAW = mysql.createConnection({
    multipleStatements: true,
    host: '10.11.4.249',
    port: 3306,
    user: 'AppUser',
    password: 'Special888%',
    database: 'FAWv4'
});

var con_Water = new Influx.InfluxDB({
    database: 'FTAA_Water',
    host: 'aworldbridgelabs.com',
    port: 8086,
    username: 'trueman',
    password: 'TruemanWu!04',
    schema: [
        {
            measurement: 'Water_Experiment',
            fields: {
                Benchmark: Influx.FieldType.STRING,
                Building_1_Drinking_Water: Influx.FieldType.FLOAT,
                Building_2_Drinking_Water: Influx.FieldType.FLOAT,
                Remark: Influx.FieldType.STRING,
                Unit: Influx.FieldType.STRING
            },
            tags: [
                'Element'
            ]
        }
    ]
});

var con_EnergyBudget = new Influx.InfluxDB({
    database: 'FTAA_Energy',
    host: 'aworldbridgelabs.com',
    port: 8086,
    username: 'trueman',
    password: 'TruemanWu!04',
    schema: [
        {
            measurement: 'Energy_Budget',
            fields: {
                Electricity_Usage: Influx.FieldType.FLOAT,
                Machine_Name: Influx.FieldType.STRING
            },
            tags: [
                'Machine_ID'
            ]
        }
    ]
});

var con_EnergyPredic = new Influx.InfluxDB({
    database: 'FTAA_Energy',
    host: 'aworldbridgelabs.com',
    port: 8086,
    username: 'trueman',
    password: 'TruemanWu!04',
    schema: [
        {
            measurement: 'Actual_vs_Prediction',
            fields: {
                Actual_Electricity_Usage: Influx.FieldType.FLOAT,
                Predict_Electricity_Usage: Influx.FieldType.FLOAT
            },
            tags: [

            ]
        }
    ]
});

var con_WHS = mysql.createConnection({
    multipleStatements: true,
    host: '127.0.0.1',
    port: 3306,
    user: 'AppUser',
    password: 'Special888%',
    database: 'whs'
});

app.get('/ChangeSelectList', function (req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    con_CS.query("SELECT Country, City FROM Country2City", function (err, results) {
        if (err) throw err;
        res.send(results);
        res.end();
    });
});

app.get('/ChangeLayerList', function (req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    con_CS.query("SELECT FirstLayer , SecondLayer , CityName , ClassName FROM LayerMenu", function (err, results) {
        if (err) throw err;
        var layerInfo = JSON.stringify(results, null, "\t");
        res.send(layerInfo);
        console.log(res);
        res.end();

    });
});

app.get('/heatmap', function(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header

    var myStat = "SELECT latitude, longitude FROM FAWv4.Historical_Heatmap_Data;";

    con_FAW.query(myStat, function(err, results, fields) {
        if (err) {
            console.log(err);
            res.send("fail");
            res.end();
        } else {
            // console.log(results);
            res.send(results);
            res.end();
        }
    });
});

var names = "";

app.get('/search', function (req, res) {
    "use strict";
    names = req.query.keywords;
    //console.log(names);
    con_WHS.query('select * from Country Where ContinentCode <> "" AND CountryName = ?', [names], function(err, results, fields) {
        if(err) throw err;

        // Prepare output in JSON format

        var JSONresult = JSON.stringify(results, null, "\t");

        //console.log(JSONresult);

        // setHeader
        var origin = req.headers.origin;
        res.setHeader("Access-Control-Allow-Origin", origin);

        if (results[0] == null) {
            con_WHS.query('select * from Continent Where ContinentName = ?', [names], function(err, results, fields) {
                if(err) throw err;
                JSONresult = JSON.stringify(results, null, "\t");
                //console.log(JSONresult);

                if (results[0] == null) {
                    names = "%" + req.query.keywords + "%";
                    con_WHS.query('select * from Sites Where SiteName LIKE ?', [names], function(err, results, fields) {
                        if(err) throw err;
                        JSONresult = JSON.stringify(results, null, "\t");
                        //console.log(JSONresult);

                        if (results[0] == null) {
                            //res.send("No Result");
                            res.status(503).send('No Search Result');
                            res.end();
                        } else {
                            //console.log(JSONresult);
                            res.send(JSONresult);
                            res.end();
                        }
                    })
                } else {
                    //console.log(JSONresult);
                    res.send(JSONresult);
                    res.end();
                }
            });

        } else {
            //console.log(JSONresult);
            res.send(JSONresult);
            res.end();
        }
    });

});

app.get('/searchCountry', function (req, res) {
    "use strict";
    con_WHS.query('Select CountryCode, CountryName, ContinentCode From Country Where ContinentName <> "" ', function(err, results, fields) {
        if (err) throw err;

        var JSONresult = JSON.stringify(results, null, "\t");
        //console.log(JSONresult);

        var origin = req.headers.origin;
        res.setHeader("Access-Control-Allow-Origin", origin);

        res.send(JSONresult);
        res.end();
    });
});

app.get('/searchSite', function (req, res) {
    "use strict";

    var sql1 = 'Select SiteID, CountryCode, CountryName, ContinentCode, CorrectLatiDecimal AS LatiDecimal, CorrectLongDecimal AS LongDecimal From Sites WHERE CorrectLatiDecimal <> 0 and CorrectLongDecimal <> 0; ';
    var sql2 = 'Select SiteID, CountryCode, CountryName, ContinentCode, LatiDecimal, LongDecimal From Sites WHERE CorrectLatiDecimal = "" AND CorrectLongDecimal = ""; ';
    var sql3 = 'Select * from Continent; ';
    var sql4 = 'Select CountryCode from Country WHERE ContinentCode = "NA"; ';
    var sql5 = 'SELECT Count(SiteID) FROM Sites; ';

    con_WHS.query(sql1+sql2, function(err, results, fields) {
        if (err) throw err;

        var result1 = results[0];
        var result2 = results[1];
        var resultsAll = result1.concat(result2);
        var JSONresult = JSON.stringify(resultsAll, null, "\t");
        //console.log(JSONresult);
        var origin = req.headers.origin;
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.send(JSONresult);
        res.end();

    });
});

app.get('/autoSuggestion', function (req, res) {

    "use strict";
    var sql1 = 'Select ContinentName AS value from Continent; ';
    var sql2 = 'Select CountryName AS value from Country Where ContinentCode <> ""; ';
    var sql3 = 'Select SiteName AS value from Sites; ';

    con_WHS.query(sql1+sql2+sql3, function(err, results, fields) {
        if (err) throw err;

        var result1 = results[0];
        var result2 = results[1];
        var result3 = results[2];
        var resultsAll = result1.concat(result2).concat(result3);
        var JSONresult = JSON.stringify(resultsAll, null, "\t");
        //console.log(JSONresult.length);
        //console.log(JSONresult);

        var origin = req.headers.origin;
        res.setHeader("Access-Control-Allow-Origin", origin);

        res.send(JSONresult);
        res.end();

    });
});

app.get('/popup', function (req, res) {
    "use strict";
    con_WHS.query('SELECT SiteID, SiteName, SiteDescription, SiteURL, PicPath FROM Sites', function(err, results, fields){
        if (err) throw err;
        var JSONresult = JSON.stringify(results, null, "\t");
        //console.log(JSONresult);

        var origin = req.headers.origin;
        res.setHeader("Access-Control-Allow-Origin", origin);

        res.send(JSONresult);
        res.end();
    });
});


var value;
var startDateTime;
var endDateTime;

app.get('/EnergyGraph', function (req, res) {
    value = req.query.keywords;
    startDateTime = req.query.startDateTime;
    endDateTime = req.query.endDateTime;
    //console.log(value);
    //console.log(startDateTime);
    //console.log(endDateTime);

    if (value === "budget") {
        con_EnergyBudget.query('SELECT sum(Electricity_Usage) as Electricity_Usage FROM "FTAA_Energy"."autogen"."Energy_Budget" WHERE time >= 1473120000000000000 and time <= 1504652400000000000 GROUP BY time(1h)').then(results => {
            var origin = req.headers.origin;
            res.setHeader("Access-Control-Allow-Origin", origin);

            var JSONresult = JSON.stringify(results, null, "\t");
            //console.log(JSONresult);

            res.send(JSONresult);
            res.end();
        });
    } else if (value === "actual") {
        con_EnergyPredic.query('SELECT * FROM "FTAA_Energy"."autogen"."Actual_vs_Prediction"').then(results => {
            var origin = req.headers.origin;
            res.setHeader("Access-Control-Allow-Origin", origin);

            var JSONresult = JSON.stringify(results, null, "\t");
            //console.log(JSONresult);

            res.send(JSONresult);
            res.end();
        });
    } else {
        var queryDate = 'SELECT Electricity_Usage, Machine_ID, Machine_Name FROM "FTAA_Energy"."autogen"."Energy_Budget" WHERE time >= ' + "'" + startDateTime + "'" + 'AND time < ' + "'" + endDateTime + "'" + " GROUP BY Machine_ID";
        //console.log(queryDate);
        con_EnergyBudget.query(queryDate).then(results => {
            var origin = req.headers.origin;
            res.setHeader("Access-Control-Allow-Origin", origin);

            var JSONresult = JSON.stringify(results, null, "\t");
            //console.log(JSONresult);

            res.send(JSONresult);
            res.end();
        });
    }

});

var value;
var query1 = 'SELECT * FROM "FTAA_Water"."autogen"."Water_Experiment" WHERE "Element" = ' + "'Calcium_Ion-Selective_Electrode'";
var query2 = 'SELECT * FROM "FTAA_Water"."autogen"."Water_Experiment" WHERE "Element" = ' + "'Ammonium_Ion-Selective_Electrode'";
var query3 = 'SELECT * FROM "FTAA_Water"."autogen"."Water_Experiment" WHERE "Element" = ' + "'Potassium_ion-Selective_Electrode'";
var query4 = 'SELECT * FROM "FTAA_Water"."autogen"."Water_Experiment" WHERE "Element" = ' + "'Chloride_Probe'";
var query5 = 'SELECT * FROM "FTAA_Water"."autogen"."Water_Experiment" WHERE "Element" = ' + "'Colorimeter'";
var query6 = 'SELECT * FROM "FTAA_Water"."autogen"."Water_Experiment" WHERE "Element" = ' + "'Turbidity_Sensor'";
var query7 = 'SELECT * FROM "FTAA_Water"."autogen"."Water_Experiment" WHERE "Element" = ' + "'PH_Sensor'";
var query8 = 'SELECT * FROM "FTAA_Water"."autogen"."Water_Experiment" WHERE "Element" = ' + "'Temperature_Probe_(C)'";

//console.log(query1);

app.get('/WaterGraph', function (req, res) {
    value = req.query.keywords;
    console.log(value);
    if (value === "Calcium") {
        con_Water.query(query1).then(results => {
            var origin = req.headers.origin;
            res.setHeader("Access-Control-Allow-Origin", origin);

            var JSONresult = JSON.stringify(results, null, "\t");
            console.log(JSONresult);

            res.send(JSONresult);
            res.end();
        });
    }

    if (value === "Ammonium") {
        con_Water.query(query2).then(results => {
            var origin = req.headers.origin;
            res.setHeader("Access-Control-Allow-Origin", origin);

            var JSONresult = JSON.stringify(results, null, "\t");
            console.log(JSONresult);

            res.send(JSONresult);
            res.end();
        });
    }

    if (value === "Potassium") {
        con_Water.query(query3).then(results => {
            var origin = req.headers.origin;
            res.setHeader("Access-Control-Allow-Origin", origin);

            var JSONresult = JSON.stringify(results, null, "\t");
            console.log(JSONresult);

            res.send(JSONresult);
            res.end();
        });
    }

    if (value === "Chloride") {
        con_Water.query(query4).then(results => {
            var origin = req.headers.origin;
            res.setHeader("Access-Control-Allow-Origin", origin);

            var JSONresult = JSON.stringify(results, null, "\t");
            console.log(JSONresult);

            res.send(JSONresult);
            res.end();
        });
    }

    if (value === "Colorimeter") {
        con_Water.query(query5).then(results => {
            var origin = req.headers.origin;
            res.setHeader("Access-Control-Allow-Origin", origin);

            var JSONresult = JSON.stringify(results, null, "\t");
            console.log(JSONresult);

            res.send(JSONresult);
            res.end();
        });
    }

    if (value === "Turbidity") {
        con_Water.query(query6).then(results => {
            var origin = req.headers.origin;
            res.setHeader("Access-Control-Allow-Origin", origin);

            var JSONresult = JSON.stringify(results, null, "\t");
            console.log(JSONresult);

            res.send(JSONresult);
            res.end();
        });
    }

    if (value === "pH") {
        con_Water.query(query7).then(results => {
            var origin = req.headers.origin;
            res.setHeader("Access-Control-Allow-Origin", origin);

            var JSONresult = JSON.stringify(results, null, "\t");
            console.log(JSONresult);

            res.send(JSONresult);
            res.end();
        });
    }

    if (value === "Temperature") {
        con_Water.query(query8).then(results => {
            var origin = req.headers.origin;
            res.setHeader("Access-Control-Allow-Origin", origin);

            var JSONresult = JSON.stringify(results, null, "\t");
            console.log(JSONresult);

            res.send(JSONresult);
            res.end();
        });
    }
});


app.get('/firstlayer', function (req, res) {

    res.setHeader("Access-Control-Allow-Origin", "*");

    con_CS.query("SELECT FirstLayer From LayerMenu", function (err, result) {

        console.log("recive and processing");

        var JSONresult = JSON.stringify(result, null, "\t");
        console.log(JSONresult);

        res.send(JSONresult);

        res.end();

    });
});

app.get('/secondlayer', function (req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");

    con_CS.query("SELECT SecondLayer From LayerMenu", function (err,result) {

        console.log("recive and processing");

        var JSONresult = JSON.stringify(result, null, "\t");

        res.send(JSONresult);
        res.end();

    });

});

app.get('/thirdlayer', function (req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");

    con_CS.query("SELECT ThirdLayer From LayerMenu", function (err,result) {

        console.log("recive and processing");

        var JSONresult = JSON.stringify(result, null, "\t");

        res.send(JSONresult);
        res.end();

    });

});


app.get('/layername', function (req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");

    con_CS.query("SELECT LayerName From LayerMenu", function (err,result) {

        console.log("recive and processing");

        var JSONresult = JSON.stringify(result, null, "\t");

        res.send(JSONresult);
        res.end();

    });
});

app.get('/createlayer', function (req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*");

        con_CS.query("SELECT * From CitySmart.LayerMenu", function (err,result) {
            console.log("recive and processing");

            var JSONresult = JSON.stringify(result, null, "\t");

            res.send(JSONresult);
            res.end();

        });

    });

app.listen(port);
console.log('The magic happens on port ' + port);
