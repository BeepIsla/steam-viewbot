const fs = require("fs");
const URL = require("url");
const request = require("request");

let proxies = [];
let proxyIndex = 0;

module.exports = class Helper {
	static chunkArray(ary, chunkSize) {
		let tempArray = [];

		for (let index = 0; index < ary.length; index += chunkSize) {
			let myChunk = ary.slice(index, index + chunkSize);
			tempArray.push(myChunk);
		}

		return tempArray;
	}

	static fetchText(url) {
		return new Promise((resolve, reject) => {
			request(url, (err, res, body) => {
				if (err) {
					reject(err);
					return;
				}

				resolve(body.toString());
			});
		});
	}

	static isURL(url) {
		try {
			new URL.URL(url);
			return true;
		} catch {
			return false;
		}
	}

	static getProxy() {
		return proxies[proxyIndex++] || proxies[proxyIndex = 0];
	}

	static parseProxies(paths) {
		return new Promise(async (resolve, reject) => {
			for (let file of paths) {
				let text = null;
				if (this.isURL(file)) {
					text = await this.fetchText(file).catch(() => { });
					if (!text) {
						continue;
					}
				} else {
					if (!fs.existsSync(file)) {
						continue;
					}

					text = fs.readFileSync(file).toString();
				}

				proxies.push(...this.matchProxies(text || ""));
			}

			resolve(proxies);
		});
	}

	static matchProxies(text) {
		let matches = text.match(/(\d+(\.|:))+\d+/gm);
		let validProxies = [];
		for (let match of (matches || [])) {
			let port = Number(match.split(":").pop());
			let parts = match.split(".").map(p => Number(p));

			if (port < 0 || port > 65535) {
				continue;
			}

			if (parts.length !== 4) {
				continue;
			}

			let valid = true;
			for (let part of parts) {
				if (part < 0 || part > 255) {
					valid = false;
					break;
				}
			}

			if (!valid) {
				continue;
			}

			validProxies.push(match.toString());
		}

		return validProxies;
	}
}
