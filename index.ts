import fs from 'fs'
import { CronJob } from 'cron'
import { BeobleAcc } from './beoble'
import { sleep } from './beoble/features'

const start = async () => {
  const keys = await fs.promises.readFile('./wallets.txt', 'utf-8')
  const proxies = await fs.promises.readFile('./proxy.txt', 'utf-8')

  const keysArray = keys.split('\n')
  const proxiesArray = proxies.split('\n')

  // eslint-disable-next-line @typescript-eslint/prefer-for-of
  for (let i = 0; i < proxiesArray.length; i++) {
    const wallet = new BeobleAcc(keysArray[i], proxiesArray[i])
    try {
      await wallet.login()
      await sleep(500)
      await wallet.follow()
      await sleep(500)
      await wallet.dailyQuests()
      await sleep(500)
      await wallet.claimPoints()
      await sleep(500)
    } catch (error) {
      console.log(error)
    }
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
