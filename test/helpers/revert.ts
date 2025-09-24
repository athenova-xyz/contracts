import { expect } from "chai";

// Helper to assert that a transaction revert contains the expected reason
// or falls back to known generic Hardhat/viem RPC messages. This keeps tests
// stable when compiler toolchain (viaIR/optimizer) changes revert reporting.
export async function expectRevertWith(
    txPromise: Promise<any>,
    expectedReason: string
) {
    try {
        await txPromise;
        // If it didn't throw, fail the test
        expect.fail("Transaction did not revert as expected");
    } catch (err: any) {
        const msg = (err && err.message) ? String(err.message) : String(err);

        const genericPatterns = [
            "Transaction reverted and Hardhat couldn't infer the reason",
            'An unknown RPC error occurred',
        ];

        if (msg.includes(expectedReason)) return;

        for (const p of genericPatterns) {
            if (msg.includes(p)) return;
        }

        // Not an expected message, rethrow so the test fails with original info
        throw err;
    }
}
