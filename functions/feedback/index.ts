import { NowRequest, NowResponse } from '@now/node';
import { RedisClient } from 'redis';
const redis = require("redis");
const { promisify } = require("util");

const isDev = process.env.NODE_ENV !== "production";

const REDIS_URL = isDev ? "127.0.0.1" : process.env.REDIS_URL;
const REDIS_PSW = process.env.REDIS_PSW;
const REDIS_PORT = isDev ? 6379 : 14506;

// http POST :3000/rate id==11 rate==5

const client: RedisClient = redis.createClient(REDIS_PORT, REDIS_URL, {
	no_ready_check: isDev ? false : true
});

const getAsync = promisify(client.get).bind(client);
const mgetAsync = promisify(client.mget).bind(client);
const keysAsync = promisify(client.keys).bind(client);

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
		return res.status(500).send(`Error: ${err}`);
	});
	if (req.method !== 'GET') {
		return res.status(404).send('Not found');
	}

	const { key } = <{ key: string }> req.query;
	if (key) {
		// get single key
		try {
			const response: string | null = await getAsync(key);
			return res.status(200).send(
				JSON.stringify({
					data: {
						[key]: response
					}
				})
			);
		} catch (error) {
			if (error instanceof Error) {
				return res.status(500).send(`Error: ${error.message}`);
			} else {
				throw error;
			}
		}
	}
	// get all keys
	try {
		const hrstart = process.hrtime()
		
		const keys: string[] = await keysAsync('*');
		const values = await mgetAsync(keys);
		
		const hrend = process.hrtime(hrstart)
		console.info('Execution time (hr): %ds %dms', hrend[0], hrend[1] / 1000000)
		return res.status(200).send(
			JSON.stringify({
			  data: {
				keys: keys,
				values: values
			  }
			})
		  );
	} catch (error) {
		if (error instanceof Error) {
			return res.status(500).send(`Error: ${error.message}`);
		} else {
			throw error;
		}
	}
}
