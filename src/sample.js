import 'babel-polyfill'
import {Server as WebSocketServer} from 'ws'
import http from 'http'
import express from 'express'
import {createClient} from 'redis'
import SensorTag from 'sensortag'

const redis = createClient();
const app = express();
const port = process.env.PORT || 3000;
const PERIOD = process.argv[2] || 1000 * 60;

// express setting
app.use(express.static(__dirname + "/"));

const server = http.createServer(app);
server.listen(port);

console.log("http server listening on %d", port);

const wss = new WebSocketServer({server: server});
console.log("websocket server created");

console.log(`SensorTag を探しています...`);

SensorTag.discover(tag => {
  const sensorInfo = `[${tag.type}][${tag.id}]`;
  console.log(`${sensorInfo} SensorTag を発見しました。`);

  tag.on('disconnect', () => {
    redis.end();
    console.log(`プログラムを終了します。`);
    process.exit(0);
  });

  console.log(`${sensorInfo} SensorTag へ接続します...`);

  tag.connectAndSetUp(error => {
    tag.enableHumidity(error => {
      console.log(`${sensorInfo} SensorTag の情報取得周期を${PERIOD}msに変更します。`);
      tag.setHumidityPeriod(PERIOD, error => {

        var connects = [];

        var sensordataset = [];

        console.log(`${sensorInfo} SensorTag の情報を取得します。`);

        setInterval(() => {
          tag.readHumidity((error, temperature, humidity) => {
            console.log(`${sensorInfo} 温度: ${temperature.toFixed(1)} °C`);
            console.log(`${sensorInfo} 湿度: ${humidity.toFixed(1)} %`);

            let humidityData = {
              date: Date.now(),
              temperature: temperature,
              humidity: humidity
            };

            let sensordata = humidityData;

            redis.zadd('sensor', Date.now(), JSON.stringify(sensordata));

            connects.forEach(ws => {
              ws.send(JSON.stringify({type: 'update', sensordata}), () => {});
            });
          });
        }, PERIOD);

        tag.notifySimpleKey(listenSimpleKey);

        wss.on("connection", ws => {
          console.log("websocket connection open");
          connects.push(ws);
          console.log('connects: %d', connects.length);

          let sensordata = {};

          // 1日前のデータまで取得
          let ago = Date.now() - (1000 * 60 * 60 * 24);

          redis.zrevrangebyscore('sensor', '+inf', ago, function(err, result){
            if (err) throw err;
            sensordataset = result.map((element, index, array) => {
              return JSON.parse(element)
            })
            ws.send(JSON.stringify({type: 'init', sensordataset}), () => {});
          });

          ws.on("close", () => {
            console.log("websocket connection close");
            closeConnection(ws);
          })
        })

        function closeConnection(conn) {
          connects = connects.filter(function (connect, i) {
              return (connect === conn) ? false : true;
          });
          console.log('connects: %d', connects.length);
        }

        function listenSimpleKey(error) {
          tag.on('simpleKeyChange', (left, right) => {
            console.log(`${sensorInfo} 左: ${left} 右: ${right}`);
            if (left && right) {
              console.log(`${sensorInfo} SensorTag から切断します。`);
              tag.disconnect();
            }
          });
        }
      });
    });
  });

});
