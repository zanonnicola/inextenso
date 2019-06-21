import { NowRequest, NowResponse } from '@now/node';
import { RedisClient } from 'redis';
import { AnyRecord } from 'dns';
const redis = require("redis");
const { promisify } = require("util");

const isDev = process.env.NODE_ENV !== "production";

const REDIS_URL = isDev ? "127.0.0.1" : process.env.REDIS_URL;
const REDIS_PSW = process.env.REDIS_PSW;
const REDIS_PORT = isDev ? 6379 : 14506;

type Rates = '1' | '2' | '3' | '4' | '5'
interface IPayload {
  ip?: string;
  feedback: {
    [k in Rates]?: number;
  }
}

const client: RedisClient = redis.createClient(REDIS_PORT, REDIS_URL, {
  no_ready_check: isDev ? false : true
});

const getAsync = promisify(client.get).bind(client);
const setAsync = promisify(client.set).bind(client);

export default async (req: NowRequest, res: NowResponse) => {
  if (!isDev) {
    client.auth(REDIS_PSW, err => {
      if (err) throw err;
    });
  }
  client.on("connect", () => {
    console.log(`connected to redis`);
  });
  client.on("error", err => {
    console.log(`Error: ${err}`);
    res.status(500).send(`Error: ${err}`);
  });
  const { id, rate } = <{ id: string, rate: string }>req.query;
  if (!id) {
    return res.status(400).send('id is missing from query parameters')
  }
  let response: string;
  const currentObj = await getAsync(id);
  console.log(currentObj);
  if (currentObj !== null) {
    const payload = JSON.parse(currentObj);
    if (payload.feedback.hasOwnProperty(rate)) {
      payload.feedback[rate]++;
    } else {
      payload.feedback[rate] = 0;
    }
    response = await setAsync(id, JSON.stringify(payload));
  } else {
    const payload: IPayload = {
      feedback: {
        [rate]: 0
      }
    }
    response = await setAsync(id, JSON.stringify(payload));
  }
  return res.status(200).send(
    JSON.stringify({
      data: {
        status: response
      }
    })
  );
}
