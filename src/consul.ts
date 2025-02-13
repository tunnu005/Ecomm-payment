import Consul from "consul";


export const consul = new Consul({
    host: "localhost",
    port: 8500,
  });
