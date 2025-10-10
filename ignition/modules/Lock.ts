// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseEther } from "viem";
// import type { Lock } from "../../typechain-types/contracts/Lock"; // Temporarily comment out or remove until path is verified

interface LockModuleResults {
  lock: any; // Temporarily use any until Lock type is resolved
}

const JAN_1ST_2030: number = 1893456000;
const ONE_GWEI: bigint = parseEther("0.001");

const LockModule = buildModule("LockModule", (m) => {
  const unlockTime = m.getParameter("unlockTime", JAN_1ST_2030);
  const lockedAmount = m.getParameter("lockedAmount", ONE_GWEI);

  const lock = m.contract("Lock", [unlockTime], {
    value: lockedAmount,
  });

  return { lock: lock };
});

export default LockModule;
