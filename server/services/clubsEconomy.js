export function positiveMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than zero.");
  return Math.round(amount * 100) / 100;
}

export function nonNegativeMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Amount must be zero or greater.");
  return Math.round(amount * 100) / 100;
}

export function activeCaptainApprovalComplete(captainIds, approvalIds) {
  const captains = [...new Set((captainIds || []).map(String))];
  const approvals = new Set((approvalIds || []).map(String));
  return captains.length > 0 && captains.every(id => approvals.has(id));
}

export function validateRetention(memberIds, retainedPlayerIds, captainIds) {
  const members = new Set((memberIds || []).map(String));
  const retained = [...new Set((retainedPlayerIds || []).map(String))];
  if (members.size !== 4 || retained.length !== 2 || retained.some(id => !members.has(id))) {
    throw new Error("A four-player club must retain exactly two of its current players.");
  }
  const captains = new Set((captainIds || []).map(String));
  if (![...retained].some(id => captains.has(id))) {
    throw new Error("At least one existing captain must be retained at contract renewal.");
  }
  return retained;
}
