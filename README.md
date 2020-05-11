# Steam Viewbot

There are many iterations of this code, I *think* this is the latest one. I forgot it even existed but since one of the old ones has been leaked I might as well release this.

Over all iterations we maybe used it like ten times back in early 2019.

On official servers these viewers push your Matchmaking game (Valve Competitive 5v5 only) to the top of the GOTV watch list. You can also boost other peoples matches by simply joining their GOTV server. Overall it takes 2-3 minutes for the viewers to first show up. Expect this to get fixed soon.

# Requirements

Your target **MUST** be broadcasting on Steam publicly. There are two methods of broadcasting on Steam:

- Through Steam directly (Settings -> Broadcasting -> Anyone can watch my games)
- Through your favorite broadcasting software
  1. Join [this](https://steamcommunity.com/groups/storebroadcastbeta) group
  2. Go [here](https://steamcommunity.com/broadcast/upload) and setup your broadcast

To be able to broadcast you **MUST** be a [non-limited user](https://support.steampowered.com/kb_article.php?ref=3330-IAGK-7663).

# Installation

1. Install [NodeJS](https://nodejs.org/) & [Git](https://git-scm.com/downloads)
2. Open a command prompt (Close and Re-open if already opened)
3. Run `git clone --recursive https://github.com/BeepIsla/steam-viewbot.git`
4. Run `cd steam-viewbot`
5. Adjust the `config.json` to your liking
6. Run `node index.js`

# How does it work?

This version sends an HTTP request to Steam for wanting to watch a Steam Broadcast, this creates a new viewer and gives you some tokens. Viewers expire if you don't send a heatbeat after ~90 seconds (If I remember correctly), so we use a Steam connection and protobufs to send keep alives for all of our viewers. From testing this seems to max out at ~30K (Again, if I remember correctly) which doesn't really make sense according to math but whatever, bad code I guess.

The Steam connection is an anonymous Steam logon, we use Steam because sending keep alives through that is MUCH faster and more efficent than creating an entirely new HTTP request (Thank you protobufs).

I was also testing around with zipping up multiple protobuf requests and sending them as one single packet but sadly this doesn't seem to be possible, or I did something wrong.

# Config

- `target`: SteamID64 of your viewbot target
- `heartbeatInterval`: Delay in milliseconds between sending heartbeats
- `maxViewers`: Maximum amount of viewers you want
- `workers`: How many workers we want, a worker creates viewers
- `delayBetweenWorkerRequest`: Delay in milliseconds between creating a new viewer
- `maxRequestsInFlightPerWorker`: Maximum amount of in-flight requests allowed per worker
- `proxy`
  - `enabled`: Enable proxies or not? I don't know if I ever tested this but its irrelevant anyways
  - `maxErrors`: Maximum amount of errors a proxy is allowed to have before switching, if we reach the end of the proxy list it will wrap back around to the first one
  - `files`: Array of file locations or URLs to fetch proxies from
