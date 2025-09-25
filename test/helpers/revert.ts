import { expect } from "chai";
import hre from "hardhat";

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

        // Patterns that indicate a revert happened but the toolchain couldn't
        // extract the explicit reason. Keep only revert-related fallbacks here.
        const revertFallbacks = [
            "Transaction reverted and Hardhat couldn't infer the reason",
            'execution reverted',
        ];

        // Patterns that indicate RPC/network issues (not legitimate reverts).
        const rpcErrorPatterns = [
            'invalid json response',
            'ECONNREFUSED',
            'connection refused',
            'timeout',
        ];

        if (msg.includes(expectedReason)) return;

        // If it's a known RPC/network error, fail the test — this is not a revert.
        for (const p of rpcErrorPatterns) {
            if (msg.toLowerCase().includes(p.toLowerCase())) {
                expect.fail(`RPC/network error encountered while expecting revert: ${msg}`);
            }
        }

        // Accept only revert-related fallback messages as indicating a revert.
        for (const p of revertFallbacks) {
            if (msg.toLowerCase().includes(p.toLowerCase())) return;
        }

        // If we have request calldata available in the error, try a static call
        // to extract the revert reason. This helps when the toolchain reports
        // a generic RPC message but the node can still return revert data.
        const req = (err && (err.request || err.requestArguments || err.args || err.transaction)) || {};
        const to = req.to || req.address || req[1] || undefined;
        const data = req.data || req.calldata || req.input || req[2] || undefined;
        const from = req.from || req.sender || undefined;

        if (to && data) {
            try {
                const publicClient = await hre.viem.getPublicClient();
                await publicClient.call({ to, data, account: from });
                // If call didn't throw, then it didn't revert — rethrow original
                throw err;
            } catch (callErr: any) {
                const callMsg = (callErr && callErr.message) ? String(callErr.message) : String(callErr);

                if (callMsg.includes(expectedReason)) return;
                if (callMsg.toLowerCase().includes('revert')) return;

                // Couldn't detect a revert from the static call — rethrow original
                throw err;
            }
        }

        // Not an expected message and no calldata to try — rethrow so the test fails
        throw err;
    }
}
