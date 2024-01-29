import fs from 'fs'
import { CronJob } from 'cron'
import { BeobleAcc } from './beoble'
import { sleep } from './beoble/features'
import { threads } from './config';

async function processAccount(key:string, proxy:string) {
  const wallet = new BeobleAcc(key, proxy);

  try {
    await wallet.login();
    await sleep(500);
    await wallet.follow();
    await sleep(500);
    await wallet.dailyQuests();
    await sleep(500);
    await wallet.claimPoints();
    await sleep(500);

  } catch (error) {
    console.error(`Error processing account: ${wallet.address}`);
  }
}

async function start() {
  try {
    const keys = await fs.promises.readFile('./wallets.txt', 'utf-8');
    const proxies = await fs.promises.readFile('./proxy.txt', 'utf-8');

    const keysArray = keys.split('\n');
    const proxiesArray = proxies.split('\n');

    for (let i = 0; i < keysArray.length; i += threads) {
      const batchKeys = keysArray.slice(i, i + threads);
      const batchProxies = proxiesArray.slice(i, i + threads);

      const batchTasks = batchKeys.map((key, index) => processAccount(key, batchProxies[index]));

      await Promise.all(batchTasks);
    }
    console.log("Complete")
  } catch (error) {
    console.error('Error reading files:', error);
  }
}

start()
//start scipt every day in 10:00 am
CronJob.from({
  cronTime: '0 10 * * *',
  onTick: () => {
    start()
  },
  start: true,
})
