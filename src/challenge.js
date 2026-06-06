import { randomBytes } from 'node:crypto';
import { getAddress, verifyMessage } from 'ethers';
import { CHALLENGE_TTL_MS } from './constants.js';

const challenges = new Map();

function makeNonce() {
  return randomBytes(32).toString('hex');
}

export function createChallenge(minerAddress) {
  const address = getAddress(minerAddress);
  const nonce = makeNonce();
  const issuedAt = Date.now();
  const message = [
    'CypherAI official backend registration',
    'miner=' + address,
    'nonce=' + nonce,
    'issuedAt=' + issuedAt,
  ].join('\n');

  challenges.set(address.toLowerCase(), { address, nonce, issuedAt, message });
  return { address, nonce, issuedAt, message, expiresAt: issuedAt + CHALLENGE_TTL_MS };
}

export function consumeChallenge(minerAddress, signature) {
  const address = getAddress(minerAddress);
  const key = address.toLowerCase();
  const challenge = challenges.get(key);
  if (!challenge) throw new Error('missing registration challenge');
  if (Date.now() - challenge.issuedAt > CHALLENGE_TTL_MS) {
    challenges.delete(key);
    throw new Error('registration challenge expired');
  }

  const recovered = getAddress(verifyMessage(challenge.message, signature));
  if (recovered !== address) throw new Error('invalid miner signature');

  challenges.delete(key);
  return challenge;
}
