import 'babel-polyfill'
import {Server as WebSocketServer} from 'ws'
import http from 'http'
import express from 'express'
import request from 'request';
import {createClient} from 'redis'
import SensorTag from 'sensortag'

const redis = createClient();
const app = express();
const port = process.env.PORT || 3000;
const PERIOD = process.argv[2] || 1000 * 5;

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

  // let doConnectAndSetUp = tag => {
  //   return new Promise((resolve, reject) => {
  //     tag.connectAndSetUp(error => {
  //       console.log(`${sensorInfo} SensorTag へ接続しました。`);
  //       if (error) {
  //         reject(error);
  //       } else {
  //         resolve(error);
  //       }
  //     });
  //   })
  // };
  //
  // let doEnableHumidity = tag => {
  //   return new Promise((resolve, reject) => {
  //     tag.enableHumidity(error => {
  //       console.log(`${sensorInfo} SensorTag の Humidity を有効化しました。`);
  //       if (error) {
  //         reject(error);
  //       } else {
  //         resolve(error);
  //       }
  //     });
  //   })
  // };
  //
  // let doSetHumidityPeriod = (tag, period) => {
  //   return new Promise((resolve, reject) => {
  //     tag.setHumidityPeriod(period, error => {
  //       console.log(`${sensorInfo} SensorTag の情報取得周期を ${period}ms に変更します。`);
  //       if (error) {
  //         reject(error);
  //       } else {
  //         resolve(error);
  //       }
  //     });
  //   })
  // };
  //
  // let doReadHumidity = tag => {
  //   return new Promise((resolve, reject) => {
  //     tag.readHumidity((error, temperature, humidity) => {
  //       console.log(`${sensorInfo} 温度: ${temperature.toFixed(1)} °C`);
  //       console.log(`${sensorInfo} 湿度: ${humidity.toFixed(1)} %`);
  //
  //       if (error) {
  //         reject(error);
  //       } else {
  //         resolve({temperature, humidity});
  //       }
  //     });
  //   })
  // };
  //
  // let doNotifySimpleKey = tag => {
  //   return new Promise((resolve, reject) => {
  //     tag.notifySimpleKey(error => {
  //       resolve(error);
  //     });
  //   })
  // }
  //
  // (async () => {
  //   let connects = [];
  //   await doConnectAndSetUp(tag);
  //   await doEnableHumidity(tag);
  //   await doSetHumidityPeriod(tag, PERIOD);
  //   await doNotifySimpleKey(tag);
  //
  //   tag.on('simpleKeyChange', (left, right) => {
  //     console.log(`${sensorInfo} 左: ${left} 右: ${right}`);
  //     if (left && right) {
  //       console.log(`${sensorInfo} SensorTag から切断します。`);
  //       tag.disconnect();
  //     }
  //   });
  //
  //   readData(tag, PERIOD);
  //
  //   wss.on("connection", ws => {
  //     console.log("websocket connection open");
  //     connects.push(ws);
  //     console.log('connects: %d', connects.length);
  //     ws.send({'kamata': 'nampei'}, () => {});
  //
  //     // redis.get('sensordata', (err, result) => {
  //     //   if (err) {
  //     //     return err;
  //     //   }
  //     //   if (result) {
  //     //     ws.send(result, () => {});
  //     //   }
  //     // });
  //
  //     ws.on("close", () => {
  //       console.log("websocket connection close");
  //       closeConnection(ws);
  //     })
  //
  //     function closeConnection(conn) {
  //       connects = connects.filter(function (connect, i) {
  //           return (connect === conn) ? false : true;
  //       });
  //       console.log('connects: %d', connects.length);
  //     }
  //   });
  //
  //   function readData(tag, period) {
  //     setInterval(async () => {
  //       const data = await doReadHumidity(tag);
  //
  //       connects.forEach(function(ws) {
  //
  //         let humidityData = {
  //           date: Date.now(),
  //           temperature: data.temperature.toFixed(1),
  //           humidity: data.humidity.toFixed(1)
  //         };
  //
  //         let sensordata = JSON.stringify(humidityData);
  //         // redis.set('sensordata', sensordata);
  //         // ws.send({'kamata': 'nampei'}, () => {});
  //       });
  //     }, period);
  //   }
  //
  //
  // })();

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

            connects.forEach(ws => {

              let humidityData = {
                date: Date.now(),
                temperature: temperature.toFixed(1),
                humidity: humidity.toFixed(1)
              };

              let sensordata = humidityData;

              ws.send(JSON.stringify({type: 'update', sensordata}), () => {});

              sensordataset.push(sensordata);

              redis.set('sensordataset', JSON.stringify(sensordataset));
            });
          });
        }, PERIOD);

        tag.notifySimpleKey(listenSimpleKey);

        wss.on("connection", ws => {
          console.log("websocket connection open");
          connects.push(ws);
          console.log('connects: %d', connects.length);

          redis.get('sensordataset', (err, result) => {
            if (err) {
              return err;
            }
            if (result) {
              sensordataset = JSON.parse(result);
              ws.send(JSON.stringify({type: 'init', sensordataset}), () => {});
            }
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
