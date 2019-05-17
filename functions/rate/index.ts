import { IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
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

export default function(req: IncomingMessage, res: ServerResponse) {
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
  interface Query {
    id?: string;
    rate?: string;
  }
  async function rate() {
    const { query }: { query: any } = parse(req.url, true);
    console.log(query);
    if (query !== null) {
      const { id, rate } = query;
      const response = await setAsync(id, rate);
      res.end(
        JSON.stringify({
          data: {
            status: response
          }
        })
      );
    } else {
      return;
    }
  }
  rate();
}
