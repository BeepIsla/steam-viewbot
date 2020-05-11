// Modules
const path = require("path");
const WorkerThreads = require("worker_threads");
const SteamUser = require("steam-user");
const Protobufs = require("./helpers/Protobufs.js");
const Helper = require("./helpers/Helper.js");
const config = require("./config.json");

// Instances
const steam = new SteamUser();
const protos = new Protobufs([
	{
		name: "steam",
		protos: [
			path.join(__dirname, "protobufs", "steam", "steammessages_broadcast.steamclient.proto")
		]
	}
]);

// Adjust config
config.maxViewers = config.maxViewers || Number.MAX_SAFE_INTEGER;

// Global Variables
let viewerTokens = [];
let broadcastID = null;
let lastViewerCount = null;
let workers = new Array(config.workers).fill(0).map((_, index) => {
	return createWorker(index);
});

// Worker handlers
function createWorker(index) {
	let worker = new WorkerThreads.Worker("./helpers/Worker.js", {
		workerData: {
			proxy: Helper.getProxy(),
			maxInFlight: config.maxRequestsInFlightPerWorker
		}
	});
	worker.on("error", workerError.bind(undefined, worker, index));
	worker.on("exit", workerExit.bind(undefined, worker, index));
	worker.on("message", workerMessage.bind(undefined, worker, index));
	worker.on("online", workerOnline.bind(undefined, worker, index));
	return worker;
}

function workerMessage(worker, index, msg) {
	switch (msg.type) {
		case "requestError": {
			if (["ETIMEDOUT", "ESOCKETTIMEDOUT"].includes(msg.message)) {
				// These are likely proxy errors so lets switch proxy if we error too often
				if (!worker.errors) {
					worker.errors = 1;
				} else {
					worker.errors++;
				}

				if (worker.errors < config.proxy.maxErrors) {
					break;
				}

				worker.postMessage({
					type: "killWorker"
				});
				break;
			}

			console.error(msg.message);
			break;
		}
		case "notReady": {
			console.log("Broadcaster is not yet ready [" + msg.status + "]");
			break;
		}
		case "missingParam": {
			console.log("Has Broadcast ID: " + msg.hasBroadcastID + " | Has Viewer Token: " + msg.hasViewerToken);
			break;
		}
		case "ready": {
			if (!broadcastID) {
				broadcastID = msg.broadcastID;
			}

			viewerTokens.push(msg.viewerToken);
			lastViewerCount = msg.viewers;
			// console.log("Added viewer " + msg.viewerToken + "[" + msg.viewers + "]");
			break;
		}
		case "parseError": {
			console.log("Failed to parse Steam response");
			break;
		}
		default: {
			break;
		}
	}
}

function workerOnline(worker, index) {
	console.log("Worker " + index + " online");
}

function workerError(worker, index, error) {
	console.error(error);
}

function workerExit(worker, index, exitCode) {
	console.log("Worker " + index + " exited with code: " + exitCode);

	if (worker.allowDeath) {
		return;
	}

	workers.splice(index, 1, createWorker(index));
}

// Add viewers on an interval consistently
async function startAddingViewers() {
	while (viewerTokens.length < config.maxViewers) {
		// Send request to create a viewer and wait for the response then wait our defined delay
		for (let i = 0; i < workers.length; i++) {
			if ((viewerTokens.length + (i + 1)) > config.maxViewers) {
				continue;
			}

			workers[i].postMessage({
				type: "createViewer",
				query: {
					steamid: config.target
				}
			});

			await new Promise(p => setTimeout(p, workers.length / config.delayBetweenWorkerRequest));
		}
	}

	// Log - Don't remove excessive viewers these come from in-flight HTTP request, nothing we can do.
	console.log("Required viewcount of " + config.maxViewers + " reached - Killing " + workers.length + " worker" + (workers.length === 1 ? "" : "s"));

	// Kill all workers as they are no longer required
	workers.forEach((worker) => {
		worker.allowDeath = true;

		worker.postMessage({
			type: "killWorker"
		});
	});
}

// Steam Events
steam.logOn();
steam.on("loggedOn", async () => {
	console.log("Logged onto Steam anonymously");

	if (config.proxy.enabled) {
		let proxies = await Helper.parseProxies(config.proxy.files);
		console.log("Found " + proxies.length + " prox" + (proxies.length === 1 ? "y" : "ies"));
	} else {
		console.log("Not using proxies");
	}

	startAddingViewers();

	setInterval(async () => {
		// Make sure we don't have too many viewer tokens
		viewerTokens.splice(0, viewerTokens.length - config.maxViewers);

		// Group tokens into nice bits and pieces
		let groupSize = Math.ceil(viewerTokens.length / config.heartbeatInterval);
		let groups = Helper.chunkArray(viewerTokens, groupSize);
		let delayBetweenRequests = config.heartbeatInterval / groups.length;
		console.log(new Date().toLocaleString() + " -> " + lastViewerCount);
		console.log("Sending heartbeat for " + viewerTokens.length + " tokens split into " + groups.length + " groups of size " + groupSize + ", sending with a delay of " + delayBetweenRequests + "ms");

		for (let i = 0; i < groups.length; i++) {
			for (let j = 0; j < groups[i].length; j++) {
				let buf = protos.encodeProto("CBroadcast_HeartbeatBroadcast_Notification", {
					steamid: config.target,
					broadcast_id: broadcastID,
					viewer_token: groups[i][j]
				});

				steam._send({
					msg: 151,
					proto: {
						target_job_name: "Broadcast.HeartbeatBroadcast#1"
					}
				}, buf);
			}

			await new Promise(p => setTimeout(p, delayBetweenRequests));
		}
	}, config.heartbeatInterval);
});

steam.on("error", (err) => {
	console.error(err);
});
