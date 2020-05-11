const Worker = require("worker_threads");
const request = require("request");
const keepAlive = setInterval(() => { }, 5 * 60 * 1000);
const data = Worker.workerData;
let inFlight = 0;

Worker.parentPort.on("message", (msg) => {
	switch (msg.type) {
		case "killWorker": {
			clearInterval(keepAlive);
			break;
		}
		case "createViewer": {
			if (inFlight > data.maxInFlight) {
				break;
			}
			inFlight++;

			request({
				url: "https://steamcommunity.com/broadcast/getbroadcastmpd/",
				qs: msg.query,
				proxy: data.proxy,
				timeout: 2000
			}, (err, res, body) => {
				inFlight--;

				if (err) {
					Worker.parentPort.postMessage({
						type: "requestError",
						message: err.message
					});
					return;
				}

				try {
					let json = JSON.parse(body);
					if (json.success !== "ready") {
						Worker.parentPort.postMessage({
							type: "notReady",
							status: json.success
						});
						return;
					}

					if (!json.broadcastid || !json.viewertoken) {
						Worker.parentPort.postMessage({
							type: "missingParams",
							hasBroadcastID: Boolean(json.broadcastid),
							hasViewerToken: Boolean(json.viewertoken)
						});
						return;
					}

					Worker.parentPort.postMessage({
						type: "ready",
						broadcastID: json.broadcastid,
						viewerToken: json.viewertoken,
						viewers: json.num_viewers
					});
				} catch {
					Worker.parentPort.postMessage({
						type: "parseError",
						body: body
					});
				}
			});
			break;
		}
		default: {
			break;
		}
	}
});
