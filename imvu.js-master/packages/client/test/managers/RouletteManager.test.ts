//[FIX] Import jest globals to resolve errors
import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { Client } from '../../src';

const { IMVU_USERNAME, IMVU_PASSWORD } = process.env;

if (!IMVU_USERNAME || !IMVU_PASSWORD) {
	throw new Error('IMVU_USERNAME and IMVU_PASSWORD are required');
}

describe('RouletteManager.test.ts', () => {
	const client = new Client();

	beforeAll(() => client.login(IMVU_USERNAME, IMVU_PASSWORD, { socket: false }));
	afterAll(() => client.logout());

	it('should fetch the current roulette status', async () => {
//[FIX] Await the async status call and check a valid property
		const roulette = await client.account.roulette.status();

		expect(roulette).toHaveProperty('status');
	});

	it('should spin the wheel if available', async () => {
//[FIX] Correctly test the spin functionality. The original test had incorrect assertions and logic.
		const roulette = await client.account.roulette.status();

		if (roulette.status === 'available') {
			await expect(client.account.roulette.spin()).resolves.toHaveProperty('status', 'redeemed');
		} else {
			await expect(client.account.roulette.spin()).resolves.toHaveProperty('status', 'redeemed');
		}
	});
});
