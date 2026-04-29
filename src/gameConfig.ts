export const gameConfig = {
  economy: {
    startingCash: 250000,
    buildCosts: {
      path: 12,
      queuePath: 18,
      carousel: 3200,
      rideEntrance: 120,
      rideExit: 120,
      firTree: 35,
    },
    refundRates: {
      path: 0.45,
      queuePath: 0.45,
      carousel: 0.35,
      rideEntrance: 0.35,
      rideExit: 0.35,
      firTree: 0.25,
    },
  },
} as const;
