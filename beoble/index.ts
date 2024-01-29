import fs from 'fs'
import axios, { AxiosInstance } from 'axios'
import { Wallet, ethers } from 'ethers'
import { SocksProxyAgent } from 'socks-proxy-agent'
import UserAgent from 'user-agents'
import { v4 as uuidv4 } from 'uuid'
import WebSocket from 'ws'
import { chatroom_id } from '../config'
import { logger } from '../logger/logger'
import { generateNickname, sleep, getRefferalCode, getImage } from './features'
import { getRandomGreeting } from './greeting'
import FormData from 'form-data';
import path from 'path'
export class BeobleAcc {
  publicKey: string
  address: string
  userAgent = new UserAgent({ platform: 'Win32' }).toString()
  API: AxiosInstance
  proxy: string
  wallet: Wallet
  userData: any
  id: any
  access_token = ''
  errors = 0
  constructor(privateKey: string, proxy: string) {
    this.wallet = new ethers.Wallet(privateKey)
    this.publicKey = this.wallet.publicKey
    this.address = this.wallet.address

    this.proxy = `socks5://${proxy}`
    let httpsAgent = new SocksProxyAgent(this.proxy)
    let httpAgent = httpsAgent

    this.API = axios.create({
      baseURL: 'https://api.beoble.app',
      httpAgent,
      httpsAgent,
      headers: {
        'Accept': '*/*',
        'User-Agent': this.userAgent,
      },
    })
  }

  getInvites = async () => {
    const response = await this.API.get(`/v1/user/point?user_id=${this.id}`)
    const invites = response?.data.data.allowed_referral_count
    let data
    try {
      data = JSON.parse(
        await fs.promises.readFile('./beoble/invites.json', 'utf-8')
      )
    } catch (error) {
      data = []
    }

    if (data.length) {
      let find
      for (const wallet of data) {
        if (wallet.id === this.id) {
          wallet.invites = invites
          find = true
          break
        }
      }
      if (!find) {
        data.push({
          wallet: this.address,
          id: this.id,
          invites,
        })
      }
    } else {
      data = [
        {
          wallet: this.address,
          id: this.id,
          invites,
        },
      ]
    }

    await fs.promises.writeFile('./beoble/invites.json', JSON.stringify(data))
  }

  login = async () => {
    const data_ = await this.API.get(
      `/v1/auth/login/message?wallet_address=${this.address}`
    )
    const message = data_.data.data.message_to_sign
    const signature = await this.wallet.signMessage(message)
    await sleep(500)

    const response = await this.API.post('/v1/auth/login', {
      wallet_address: this.wallet.address,
      signature,
      chain_type: 'ETHEREUM',
    })
    await sleep(500)

    const refreshResponse = await this.API.post(
      `/v1/auth/login/refresh`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${response.data.data.refresh_token}`,
          'Accept': '*/*',
          'User-Agent': this.userAgent,
        },
      }
    )
    await sleep(500)

    this.access_token = refreshResponse.data.data.access_token
    this.API.defaults.headers.common[
      'Authorization'
    ] = `Bearer ${this.access_token}`
    logger.log('info', `${this.address}`)
    await this.getRegistr()
    await this.registr()
    await sleep(1000)
    await this.getInvites()
  }

  getRegistr = async () => {
    this.userData = await this.API.get(
      `/v1/user?wallet_address=${this.wallet.address}`
    )
    this.id = this.userData.data.data[0].id
  }

  registr = async () => {
    if (this.userData.data.data[0].representative_media.main_profile === null) {
      // const img_path:any = await getImage()
      // const formData = new FormData();
      // const avatarFileContent = fs.readFileSync(path.join(__dirname, img_path));
      // formData.append('upload_file', avatarFileContent, {
      //   filename: `${uuidv4()}.jpg`,
      //   contentType: 'image/jpeg',
      // });
      // formData.append('upload_type', 'USER');
      // const response = await this.API.post('https://api.beoble.app/v1/file/upload', formData, {
      //   headers: {
      //     'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundaryPTyA6BErvPbZslVB',
      //     'Referer': 'https://beoble.app/',
      //   },
      // })
      // const imgLink = response.data.data  
      // await fs.promises.unlink(path.join(__dirname, img_path));
      await this.API.put(`/v1/user/${this.id}/profile`, {
        representative_media: {
          image_source: `https://cdn.beoble.app/beoble_assets/png/default_profiles/default_cat_${
            Math.floor(Math.random() * 6) + 1
          }.png`,
          update_type: 'ADD',
          representative_media_type: 'MAIN_PROFILE',
        },
      })
      await sleep(1000)
      logger.log('info', 'Profile Image add')
    }

    const resp = await this.API.get(`/v1/user/point?user_id=${this.id}`)
    logger.log('info', `points ${resp.data.data.cached_total_points}`)
    if (resp.data.data.cached_total_points < 1) {
      await this.API.put(`/v1/user/${this.id}/point/referrer`, {
        referrer_user_id: await getRefferalCode(),
      }).catch(() => logger.log('error', 'Add refcode'))
      await sleep(1000)
      logger.log('info', 'Add reffcode')
    }

    if (!this.userData.data.data[0].public_key) {
      await this.API.put(
        `/v1/user/${this.id}`,

        {
          public_key: this.publicKey,
        }
      )
      logger.log('info', 'Pubkey add')
      await sleep(500)
    }

    const name = generateNickname()
    if (this.userData.data.data[0].name.length > 50) {
      await this.API.put(`/v1/user/${this.id}`, {
        name,
      })
      logger.log('info', `hadnle @${name}`)
      await sleep(800)
    }
    if (this.userData.data.data[0].display_name.length > 15) {
      await this.API.put(
        `/v1/user/${this.id}`,

        {
          display_name: name,
        }
      )
      logger.log('info', `Display name ${name}`)
      await sleep(500)
    }
  }

  follow = async () => {
    const response = await this.API.get(
      '/v1/community/recommendation/user?limit=10'
    )

    sleep(1000)
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const target_user_id = response.data.data[5].id
    await this.API.put(`https://api.beoble.app/v1/user/${this.id}/follow`, {
      target_user_id,
    })
    logger.log('done', 'Follow Quests')
  }

  dailyQuests = async () => {
    await this.API.put(
      `https://api.beoble.app/v1/user/${this.id}/chatroom/membership`,
      {
        chatroom_id,
        membership_action: 'ADD',
      }
    ).catch(() => {})

    const agent = new SocksProxyAgent(this.proxy)
    const ws = new WebSocket(
      `wss://api.beoble.app/v1/user/01e49e9c-de95-46f6-bfab-101b55f65dd6?dapp_id=d3fc9c57-bb77-4bd5-bdcf-cd855f6daf60&auth_token=${this.access_token}`,
      { agent }
    )

    ws.on('error',(e) => {
      console.log(e)
      if(this.errors < 2) {
        this.errors += 1
        this.dailyQuests()
      }
    })

    await new Promise((res) => {
      ws.on('open', () => {
        res(null)
      })
    })

    const response = await this.API.get(
      `https://api.beoble.app/v1/user/chatroom?user_id=${this.id}&limit=50&show_keys=true`
    )
    const _ = response.data.data.filter(
      (data: any) =>
        data.chatroom_setting.permission_setting.MEMBER[0] === 'SEND_CHAT'
    )
    const chats = _.map((data: any) => data.id)
    ws.on('message', (data: WebSocket.Data) => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const data_ = JSON.parse(String(data))
      let i = 0
      if (data_.message_type === 'NEW_CHAT' && i < 30) {
        const message = {
          action_type: 'REACT',
          data: {
            chatroom_id: data_.chatroom_id,
            chat_id: data_.data.id,
            reaction: 'u+1f44d',
          },
          request_id: uuidv4(),
        }

        ws.send(JSON.stringify(message))
        i++
      }
    })

    ws.on('error',(e) => {
      console.log(e)
    })

    const message = {
      action_type: 'SEND_CHAT',
      data: {
        creator_user_id: this.id,
        chatroom_id: '27ef1535-538d-4081-96d5-eb3048d88a7e',
        text: getRandomGreeting(),
      },
      request_id: uuidv4(),
    }

    ws.send(JSON.stringify(message))
    await sleep(1000)

    for (let i = 0; i < 30; i++) {
      const message = {
        action_type: 'SEND_CHAT',
        data: {
          creator_user_id: this.id,
          chatroom_id: chats[Math.floor(Math.random() * chats.length)],
          text: getRandomGreeting(),
        },
        request_id: uuidv4(),
      }

      ws.send(JSON.stringify(message))
      await sleep(500)
    }

    ws.close()
    logger.log('done', 'Daily Quests')
  }

  claimPoints = async () => {
    const resp = await this.API.get(`/v1/user/achievement?user_id=${this.id}`)

    const data = resp.data.data.claimable_user_achievements
    let points = 0
    await sleep(500)
    for (const claimData of data) {
      if (claimData.claimable_status === 'CLAIMABLE') {
        await this.API.put(`/v1/user/${this.id}/achievement/claimed`, {
          achievement_id: claimData.user_achievement_id,
        })
          // eslint-disable-next-line no-loop-func
          .then(() => (points += claimData.claimable_point))
          .catch(() => {})
        await sleep(500)
      }
    }
    logger.log('claim', `${points} points`)
  }
}
