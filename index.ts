import { SerialPort } from "serialport";
import GPS from "gps";
import { createServer } from "http";
import { Server as IOServer } from "socket.io";
import express from "express";
import cors from "cors";
import fs from "fs";
import HMC5883L from "compass-hmc5883l";
import alsa from "alsa-volume";

console.log(alsa.getVolume("default", "Master"));
console.log(alsa.getVolumeRange("default", "Master"));

const gps = new GPS();
const rest = express();
const volumeRange = alsa.getVolumeRange("default", "Master");

rest.use(cors({ origin: ["http://localhost", "http://localhost:8080"] }));

// const gps_port = new SerialPort({ path: "/dev/ttyUSB1", baudRate: 115200 });
const gps_port = new SerialPort({ path: "/dev/ttyS0", baudRate: 460800 })
// const at_port = new SerialPort({ path: "/dev/ttyUSB3", baudRate: 115200 });

gps_port.on("open", () => console.log("gps_port connected"));
// at_port.on("open", () => console.log("at_port connected"));

// at_port.write("AT+CGPSCOLD\r", () => console.log("gps initialized"));

gps_port.on("data", (data) => {
    try {
        gps.updatePartial(data);
    } catch(error) {
        console.log("failed parsing gps");
    }
});

const server = createServer(rest);
const socket = new IOServer(server, { cors: { origin: "*" } });

socket.on("connected", () => console.log("new socket connection"));

var record_state = false;
var record_data = [];
var last_timestamp = 0;
gps.on("data", (data) => {
    socket.emit("gps", { ...data, ...gps.state });

    if(record_state) {
        const timestamp = Date.now();
        const timeout = timestamp - last_timestamp;
        record_data.push({ timeout, data: { ...data, ...gps.state } });
        last_timestamp = timestamp;
    }
});

// const compass = new HMC5883L(1);
// setInterval(() => {
//     compass.getHeadingDegrees('y', 'x', (err, heading) => {
//         if(err) return console.log(err);
//         socket.emit("heading", heading);
//     });
// }, 100);

rest.post("/record", (req, res) => {
    if(record_state) return res.status(500).send("already recording");
    console.log("start recording");
    record_state = true;
    last_timestamp = Date.now();
    res.sendStatus(200);
});

rest.put("/record", (req, res) => {
    if(!record_state) return res.status(500).send("not recording");
    console.log("stop recording");
    fs.writeFileSync("./recordings/" + Date.now() + ".json", JSON.stringify(record_data, null, 2));
    record_state = false;
    record_data = [];
    last_timestamp = 0;
    res.sendStatus(200);
});

rest.get("/volume", (req, res) => {
    res.json({ volume: Math.round(alsa.getVolume("default", "Master") / ((volumeRange.max - volumeRange.min) / 100)) });
});

rest.post("/volume", express.json(), (req, res) => {
    if(!req.body.volume) return res.status(400).send("invalide request");
    if(!Number.isInteger(req.body.volume)) return res.status(400).send("volume is not an integer");
    if(req.body.volume < 0 || req.body.volume > 100) return res.status(500).send("volume must be a value between 0 and 100");
    alsa.setVolume("default", "Master", volumeRange.min + ((volumeRange.max - volumeRange.min) / 100) * req.body.volume);
    res.json({ volume: alsa.getVolume("default", "Master") });
});

server.listen(3000, () => console.log("server is running"));