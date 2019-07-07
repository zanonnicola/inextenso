import { NowRequest, NowResponse } from "@now/node";
import { RedisClient } from "redis";
const redis = require("redis");
const { promisify } = require("util");

const isDev = process.env.NODE_ENV !== "production";

const REDIS_URL = isDev ? "127.0.0.1" : process.env.REDIS_URL;
const REDIS_PSW = process.env.REDIS_PSW;
const REDIS_PORT = isDev ? 6379 : 14506;

type Rates = "1" | "2" | "3" | "4" | "5";
interface IPayload {
  ip?: Set<string>;
  feedback: { [k in Rates]?: number };
}
// http POST :3000/rate id==11 rate==5

const client: RedisClient = redis.createClient(REDIS_PORT, REDIS_URL, {
  no_ready_check: isDev ? false : true
});

const getAsync = promisify(client.get).bind(client);
const setAsync = promisify(client.set).bind(client);

const getUserIP = (req: NowRequest) => {
  if (req.headers["x-forwarded-for"]) {
    return (req.headers["x-forwarded-for"] as string).split(",")[0];
  }
  return req.connection.remoteAddress;
};

const saveData = async (
  currentObj: string,
  id: number,
  rate: number,
  req?: NowRequest
): Promise<string> => {
  if (currentObj !== null) {
    const payload: IPayload = JSON.parse(currentObj);
    if (payload.feedback.hasOwnProperty(rate)) {
      payload.feedback[rate]++;
    } else {
      payload.feedback[rate] = 0;
    }
    payload.ip.add(getUserIP(req));
    return await setAsync(id, JSON.stringify(payload));
  } else {
    const payload: IPayload = {
      ip: new Set([getUserIP(req)]),
      feedback: {
        [rate]: 0
      }
    };
    return await setAsync(id, JSON.stringify(payload));
  }
};

export default async (req: NowRequest, res: NowResponse) => {
  console.log(req.body, req.method);
  const { id, rate }: { id: number; rate: number } = JSON.parse(req.body);
  if (!id || !rate) {
    return res.status(400).send("id or rate are missing from query parameters");
  }
  if (req.method !== "POST") {
    return res.status(404).send("Not found");
  }

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
    return res.status(500).send(`Error: ${err}`);
  });
  const currentObj = await getAsync(id);
  try {
    const response: string = await saveData(currentObj, id, Number(rate), req);
    console.log(response, currentObj, id);
    return res.status(200).json({
      data: {
        status: response
      }
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(500).send(`Error: ${error.message}`);
    } else {
      throw error;
    }
  }
};
