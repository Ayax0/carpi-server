import { SerialPort } from "serialport";
import GPS from "gps";
import { Server as IOServer } from "socket.io";
import http from "http";

const gps = new GPS();

const gps_port = new SerialPort({ path: "/dev/ttyUSB1", baudRate: 115200 });
const at_port = new SerialPort({ path: "/dev/ttyUSB3", baudRate: 115200 });

at_port.write("AT+CGPSCOLD\r");
gps_port.on("data", (data) => gps.updatePartial(data));

const server = http.createServer();
const socket = new IOServer(server);

gps.on("data", (data) => socket.emit("gps", { ...data, ...gps.state }));

socket.listen(3000);