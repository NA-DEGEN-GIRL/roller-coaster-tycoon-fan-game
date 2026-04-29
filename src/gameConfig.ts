export const gameConfig = {
  economy: {
    startingCash: 250000,
    parkAdmissionFee: 10,
    rideDefaults: {
      carousel: {
        ticketPrice: 2.5,
        excitement: 44,
        intensity: 18,
        nauseaRating: 8,
        popularity: 62,
      },
    },
    guestDecision: {
      admissionValue: 44,
      minimumHappinessToStay: 18,
      lowCashExitThreshold: 3,
      queuePatiencePenalty: 5.2,
      nauseaPenalty: 0.22,
      minimumRideScore: 0,
      rejectionCooldown: 14,
    },
    buildCosts: {
      path: 12,
      queuePath: 18,
      carousel: 3200,
      rideEntrance: 120,
      rideExit: 120,
      firTree: 35,
      cherryTree: 45,
      bench: 22,
    },
    refundRates: {
      path: 0.45,
      queuePath: 0.45,
      carousel: 0.35,
      rideEntrance: 0.35,
      rideExit: 0.35,
      firTree: 0.25,
      cherryTree: 0.25,
      bench: 0.25,
    },
  },
} as const;
