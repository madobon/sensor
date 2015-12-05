import {Server as WebSocketServer} from 'ws'
import http from 'http'
import express from 'express'
import request from 'request';
import {EventEmitter} from 'events';
import SensorTag from 'sensortag'

const app = express();
const port = process.env.PORT || 5000;

// express setting
app.use(express.static(__dirname + "/"));

const server = http.createServer(app);
server.listen(port);

console.log("http server listening on %d", port);

const wss = new WebSocketServer({server: server});
console.log("websocket server created");


const PERIOD = process.argv[2] || 2550;

console.log(`SensorTag を探しています...`);

SensorTag.discover(tag => {
  const sensorInfo = `[${tag.type}][${tag.id}]`;

  console.log(`${sensorInfo} SensorTag を発見しました。`);

  tag.on('disconnect', () => {
    console.log(`プログラムを終了します。`);
    process.exit(0);
  });

  console.log(`${sensorInfo} SensorTag へ接続します...`);

  tag.connectAndSetUp(error => {
    console.log(`${sensorInfo} SensorTag へ接続しました。`);
    tag.enableHumidity(error => {
      console.log(`${sensorInfo} SensorTag の情報取得周期を${PERIOD}msに変更します。`);
      tag.setHumidityPeriod(PERIOD, error => {

        var ev = new EventEmitter;

        console.log(`${sensorInfo} SensorTag の情報を取得します。`);

        tag.notifyHumidity(listenHumidity);
        tag.notifySimpleKey(listenSimpleKey);

        wss.on("connection", ws => {
          console.log("websocket connection open");

          ev.on('send', (data) => {
            ws.send(JSON.stringify(data), () => {  });
          });

          ws.on("close", () => {
            console.log("websocket connection close");
          })
        })

        function listenHumidity(error) {
          tag.on('humidityChange', (temperature, humidity) => {
            console.log(`${sensorInfo} 温度: ${temperature.toFixed(1)} °C`);
            console.log(`${sensorInfo} 湿度: ${humidity.toFixed(1)} %`);

            ev.emit('send', {
              temperature: temperature.toFixed(1),
              humidity: humidity.toFixed(1)
            });
          });
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
