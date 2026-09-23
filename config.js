window.GPU_BOOKING_CONFIG = {
  // If left as placeholders, the site tries to infer these from <owner>.github.io/<repo>/.
  githubOwner: "YOUR_GITHUB_USERNAME_OR_ORG",
  githubRepo: "gpu-booking",

  machineName: "Shared GPU Workstation",
  timeZone: "Europe/Rome",

  // Rename/add/remove GPUs to match the workstation.
  gpus: ["GPU 0", "GPU 1", "GPU 2", "GPU 3"],

  // Calendar settings.
  startHour: 8,
  endHour: 22,
  slotMinutes: 60,
  daysShown: 7,
  weekStartsOn: 1, // Monday
  maxBookingHours: 8,

  // Keep this short: it is shown beside the booking grid.
  etiquette: [
    "Book only the time you reasonably expect to use.",
    "Release/cancel a booking by closing its GitHub issue.",
    "If your run finishes early, please close the issue so the slot is visibly free.",
    "For unusually long or multi-GPU runs, coordinate with the group first."
  ]
};
