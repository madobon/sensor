import SensorTag from 'sensortag'

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
        console.log(`${sensorInfo} SensorTag の情報を取得します。`);
        tag.notifyHumidity(listenHumidity);
        tag.notifySimpleKey(listenSimpleKey);
      });
    });
  });

  function listenHumidity(error) {
    tag.on('humidityChange', (temperature, humidity) => {
      console.log(`${sensorInfo} 温度: ${temperature.toFixed(1)} °C`);
      console.log(`${sensorInfo} 湿度: ${humidity.toFixed(1)} %`);
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
