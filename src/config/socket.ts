import { io, Socket } from "socket.io-client";

let socket: Socket;
console.log(process.env.NEXT_PUBLIC_API_URL);
export const getSocket = (): Socket => {
  if (socket) {
    return socket;
  }
  console.log("yes");
  socket = io(process.env.NEXT_PUBLIC_API_URL, {
    autoConnect: false,
  });
  return socket;
};