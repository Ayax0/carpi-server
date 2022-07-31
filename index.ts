import { SerialPort } from "serialport";
import GPS from "gps";
import { createServer } from "http";
import { Server as IOServer } from "socket.io";

const gps = new GPS();

const gps_port = new SerialPort({ path: "/dev/ttyUSB1", baudRate: 115200 });
const at_port = new SerialPort({ path: "/dev/ttyUSB3", baudRate: 115200 });

gps_port.on("open", () => console.log("gps_port connected"));
at_port.on("open", () => console.log("at_port connected"));

at_port.write("AT+CGPSCOLD\r", () => console.log("gps initialized"));

gps_port.on("data", (data) => gps.updatePartial(data));

const server = createServer();
const socket = new IOServer(server, { cors: { origin: "*" } });

gps.on("data", (data) => socket.emit("gps", { ...data, ...gps.state }));

socket.on("connected", () => console.log("new socket connection"));

server.listen(3000, () => console.log("server is running"));