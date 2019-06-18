import { NowRequest, NowResponse } from '@now/node'
const redis = require("redis");
const { promisify } = require("util");

const isDev = process.env.NODE_ENV !== "production";

const REDIS_URL = isDev ? "127.0.0.1" : process.env.REDIS_URL;
const REDIS_PSW = process.env.REDIS_PSW;
const REDIS_PORT = isDev ? 6379 : 14506;

const client = redis.createClient(REDIS_PORT, REDIS_URL, {
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
    res.end(`Error: ${err}`);
  });
  const { id, rate } = req.query;
  if (!id) {
    return res.status(400).send('id is missing from query parameters')
  }
  const response = await setAsync(id, rate);
  return res.status(200).send(
    JSON.stringify({
      data: {
        status: response
      }
    })
  );
}
