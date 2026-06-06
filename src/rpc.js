import { JsonRpcProvider } from 'ethers';

export async function callRpc(rpcUrl, method, params = []) {
  const provider = new JsonRpcProvider(rpcUrl);
  return await provider.send(method, params);
}

export async function getAiStatus(rpcUrl) {
  return await callRpc(rpcUrl, 'eth_aiStatus', []);
}
